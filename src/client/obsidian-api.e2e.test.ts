import { execSync } from "node:child_process"
import https from "node:https"
import axios from "axios"
import { debug } from "debug"
import { dedent as de } from "ts-dedent"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { ObsidianAPI } from "./obsidian-api.ts"
import type { IObsidianAPI, ObsidianConfig } from "./types.ts"

// ref: https://github.com/sindresorhus/is-wsl/blob/main/index.js
const isWSL = () => process.platform === "linux" && process.env.WSL_DISTRO_NAME

// declare process.env variables
namespace NodeJS {
  interface ProcessEnv {
    WSL_DISTRO_NAME?: string
    WSL_GATEWAY_IP?: string
    API_KEY?: string
  }
}

const extractGatewayIp = () => execSync("ip route show | grep -i default | awk '{ print $3}'").toString().trim()

const locahostConfig: ObsidianConfig = {
  apiKey: process.env.API_KEY ?? "<secret>",
  port: 27124,
  host: "https://127.0.0.1",
}

const dockerConfig: ObsidianConfig = {
  apiKey: process.env.API_KEY ?? "<secret>",
  port: 27124,
  host: "https://host.docker.internal",
}

const wslConfig: ObsidianConfig = {
  apiKey: process.env.API_KEY ?? "<secret>",
  port: 27124,
  host: `https://${process.env.WSL_GATEWAY_IP ?? extractGatewayIp()}`,
}

// Helper function to check if host is available
async function isHostAvailable(url: string): Promise<boolean> {
  try {
    // Create an axios instance that doesn't reject unauthorized SSL certificates
    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      timeout: 1000, // 1 second timeout
    })

    await instance.get(url)
    return true
  } catch (error) {
    console.error("e2e testing host is not available. Error:", error.message)
    if (axios.isAxiosError(error) && error.response) {
      // If we get any response, the host is available even if it returns an error code
      return true
    }
    return false
  }
}

describe("ObsidianAPI - E2E Tests", async () => {
  const config: ObsidianConfig = isWSL() ? wslConfig : locahostConfig

  const hostAvailable = await isHostAvailable(`${config.host}:${config.port}`)
  /** We'll conditionally skip the entire describe block if host is not available */
  const describeIf = hostAvailable ? describe : describe.skip

  let api: IObsidianAPI

  beforeAll(async () => {
    debug("config")("config: %o", config)

    if (!hostAvailable) {
      console.error(
        `\n⛔ ERROR: Obsidian REST API server is not available at ${config.host}:${config.port}\nPlease make sure the server is running before executing E2E tests.\n`,
      )
    } else {
      // Initialize API only if host is available
      api = new ObsidianAPI(config)
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

      const notePath = notes[0]
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
      const notePath = "test file.md"

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

    it("should write content to a test note and read it back", async () => {
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

      expect(note.path).toBe(notePath)
      expect(note.content).toBe(testContent)
    })
  })
})
