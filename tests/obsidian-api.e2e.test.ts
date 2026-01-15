import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test"
import { execSync } from "node:child_process"
import https from "node:https"
import axios from "axios"
import { debug } from "debug"
import { dedent as de } from "ts-dedent"

import { ObsidianAPI } from "../src/client/obsidian-api.ts"
import type { ObsidianConfig } from "../src/client/types.ts"

// ref: https://github.com/sindresorhus/is-wsl/blob/main/index.js
const _isWSL = () => process.platform === "linux" && process.env.WSL_DISTRO_NAME

const extractGatewayIp = () => {
  return process.platform === "darwin"
    ? "127.0.0.1"
    : execSync("ip route show | grep -i default | awk '{ print $3}'").toString().trim()
}

const API_KEY = process.env.API_KEY ?? "<secret>"
const API_PORT = Number(process.env.API_PORT ?? 27124)

const buildConfigFromHost = (host: string, port: number): ObsidianConfig => {
  const normalizedHost = host.endsWith("/") ? host.slice(0, -1) : host
  return {
    apiKey: API_KEY,
    port,
    host: normalizedHost,
    baseURL: `${normalizedHost}:${port}`,
  }
}

const buildConfigFromUrl = (rawUrl: string): ObsidianConfig | null => {
  try {
    const url = new URL(rawUrl)
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80
    const host = `${url.protocol}//${url.hostname}`
    return buildConfigFromHost(host, port)
  } catch {
    return null
  }
}

const parseApiUrls = (): string[] => {
  const raw = process.env.API_URLS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []
  } catch {
    return []
  }
}

mock.module("axios", async () => {
  if ("actual" in axios) return axios.actual
  return axios
})

// Helper function to check if host is available
async function isHostAvailable(url: string): Promise<boolean> {
  try {
    // Create an axios instance that doesn't reject unauthorized SSL certificates
    // and fails fast for quick availability check
    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      timeout: 500, // 500ms timeout - fail fast
      // Disable retries for availability check
      "axios-retry": {
        retries: 0,
      },
    })

    await instance.get(url)
    return true
  } catch (error: unknown) {
    if (error !== null && typeof error === "object" && "message" in error) {
      const errorCode = axios.isAxiosError(error) ? error.code : "UNKNOWN"
      console.error(`e2e testing host is not available. Error: ${errorCode}`)
    }

    if (axios.isAxiosError(error) && error.response) {
      // If we get any response, the host is available even if it returns an error code
      return true
    }
    return false
  }
}

describe("ObsidianAPI - E2E Tests", async () => {
  const candidates: ObsidianConfig[] = []
  const apiUrls = parseApiUrls()
  if (apiUrls.length > 0) {
    for (const url of apiUrls) {
      const config = buildConfigFromUrl(url)
      if (config) candidates.push(config)
    }
  } else {
    if (process.env.API_HOST) {
      candidates.push(buildConfigFromHost(process.env.API_HOST, API_PORT))
    }

    candidates.push(buildConfigFromHost("https://127.0.0.1", API_PORT))

    if (_isWSL() || process.env.WSL_GATEWAY_IP) {
      const gateway = process.env.WSL_GATEWAY_IP ?? extractGatewayIp()
      candidates.push(buildConfigFromHost(`https://${gateway}`, API_PORT))
    }
  }

  const uniqueCandidates = candidates.filter(
    (config, index, list) => list.findIndex((item) => item.baseURL === config.baseURL) === index,
  )

  // Check all candidates in parallel for faster detection
  let config: ObsidianConfig | undefined
  const availabilityChecks = uniqueCandidates.map(async (candidate) => ({
    candidate,
    available: await isHostAvailable(candidate.baseURL),
  }))

  const results = await Promise.all(availabilityChecks)
  const firstAvailable = results.find((result) => result.available)
  if (firstAvailable) {
    config = firstAvailable.candidate
  }

  const hostAvailable = !!config
  /** We'll conditionally skip the entire describe block if host is not available */
  const describeIf = hostAvailable ? describe : describe.skip

  let api: ObsidianAPI

  beforeAll(async () => {
    if (!hostAvailable) {
      const attempted = uniqueCandidates.map((candidate) => candidate.baseURL).join(", ")
      console.error(
        `\n⛔ ERROR: Obsidian REST API server is not available at ${attempted || "the expected URLs"}\nPlease make sure the server is running before executing E2E tests.\n`,
      )
    } else {
      debug("mcp:e2e:config")("config: %o", config)
      // Initialize API only if host is available
      if (config) api = new ObsidianAPI(config)
    }
  })

  describeIf("API Connection", () => {
    it("should connect to the Obsidian REST API server", async () => {
      // This test passes if beforeAll successfully created the API instance
      expect(api).toBeDefined()
    })
  })

  describeIf("listNotes", () => {
    it("should retrieve notes from the vault", async () => {
      const notes = await api.listNotes()

      // We expect to get an array of notes (even if empty)
      expect(Array.isArray(notes)).toBe(true)

      // If there are notes, they should be markdown files
      if (notes.length > 0) {
        expect(notes.every((note) => note.endsWith(".md"))).toBe(true)
      }
    })
  })

  describeIf("readNote", () => {
    it("should retrieve a note if it exists", async () => {
      // First get a list of notes, then try to read the first one
      const notes = await api.listNotes()

      if (notes.length === 0) {
        // Skip this test if there are no notes
        return
      }

      const notePath = <string>notes[0]
      const note = await api.readNote(notePath)

      expect(note).toBeDefined()
      expect(note.path).toBe(notePath)
      expect(typeof note.content).toBe("string")
    })
  })

  describeIf("searchNotes", () => {
    it("should search for notes matching a query", async () => {
      // GIVEN: API instance

      // WHEN: search for a generic term that might match something
      const searchResults = await api.searchNotes("the")
      //console.log("Search results:", searchResults)

      // THEN: expected more than one result
      expect(Array.isArray(searchResults)).toBe(true)

      // AND: expected search results in specific structure
      const first = searchResults[0]
      expect(first).toEqual(
        expect.objectContaining({
          path: expect.any(String),
          content: expect.any(String),
          metadata: expect.objectContaining({
            score: expect.any(Number),
          }),
        }),
      )
    })
  })

  describeIf("getMetadata", () => {
    it("should retrieve metadata for a note if it exists", async () => {
      // First get a list of notes, then try to get metadata for the first one
      const folder = "Z - MCP Unit Testing"
      const notePath = "write note.md"

      const notes = await api.listNotes(folder)
      expect(notes).toContain(notePath)

      const metadata = await api.getMetadata(`${folder}/${notePath}`)
      //console.log("Metadata:", metadata)

      expect(metadata).toBeDefined()

      // metadata should be an object
      expect(typeof metadata).toBe("object")
      expect(metadata.path).toBe(`${folder}/${notePath}`)
      expect(metadata.tags).toEqual(expect.arrayContaining(["api", "unittests"]))
    })
  })

  describeIf("writeNote", () => {
    afterEach(() => {
      debug("e2e")("Skipping cleanup of test note")
    })

    it(
      "should write content to a test note and read it back",
      async () => {
        const folder = "Z - MCP Unit Testing"
        const testNotePath = "write note.md"
        const notePath = `${folder}/${testNotePath}`
        const testContent = de`
          # Test Note

          This is a test note created by the E2E tests on ${new Date().toISOString()}

          Tags: #api #unittests
        `

        // Write the test note
        await api.writeNote(notePath, testContent)

        // Read it back
        const note = await api.readNote(notePath)
        // console.log("Note:", note)

        expect(note.path).toBe(notePath)
        expect(note.content).toBe(testContent)
      },
      { timeout: 30000 }, // Write operations have 5s timeout with 5 retries
    )
  })
})
