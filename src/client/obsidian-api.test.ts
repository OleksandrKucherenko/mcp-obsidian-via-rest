import { afterEach, beforeEach, describe, expect, it, jest, mock, spyOn } from "bun:test"
import axios from "axios"
import { composeBaseURL } from "../config.ts"
import { ObsidianAPI } from "./obsidian-api.ts"
import type { ObsidianConfig } from "./types.ts"

const configPartial: Omit<ObsidianConfig, "baseURL"> = {
  apiKey: "test-api-key",
  port: 55555,
  host: "127.0.0.1",
}

const config: ObsidianConfig = {
  ...configPartial,
  baseURL: composeBaseURL(configPartial.host, configPartial.port),
}

mock.module("axios-retry", () => ({ default: jest.fn() }))
mock.module("axios-debug-log", () => ({ addLogger: jest.fn() }))
mock.module("axios", async () => {
  return {
    default: {
      create: jest.fn(() => ({
        get: jest.fn(),
        put: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
      })),
      isAxiosError: jest.fn((error) => error && error.response !== undefined),
      actual: axios,
    },
  }
})

describe("ObsidianAPI - Unit Tests", () => {
  // biome-ignore lint/suspicious/noExplicitAny: necessary for dynamic API response
  let axiosCreateSpy: any

  beforeEach(() => {
    axiosCreateSpy = spyOn(axios, "create")
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("constructor", () => {
    it("should create an axios client with the correct configuration", () => {
      // GIVEN: api client created
      const _api = new ObsidianAPI(config)

      // WHEN: constructor is called

      // THEN: axios client is created with the correct configuration
      expect(axiosCreateSpy).toHaveBeenCalledTimes(1)

      const createCall = axiosCreateSpy.mock.calls[0][0]
      expect(createCall.baseURL).toBe("http://127.0.0.1:55555")
      expect(createCall.headers.Authorization).toBe("Bearer test-api-key")
      expect(createCall.headers["Content-Type"]).toBe("application/json")
      expect(createCall.proxy).toBe(false)

      // Check that httpsAgent is defined (for self-signed certificates)
      expect(createCall.httpsAgent).toBeDefined()
    })

    it("should handle https URLs correctly", () => {
      // GIVEN: creating api client with custom config
      const host = "https://localhost"
      const port = 55556
      const httpsConfig = { ...config, host, port, baseURL: composeBaseURL(host, port) }

      // WHEN: constructor is called
      const _api = new ObsidianAPI(httpsConfig)

      // THEN: axios client is created with the correct configuration
      const createCall = axiosCreateSpy.mock.calls[0][0]
      expect(createCall.baseURL).toBe("https://localhost:55556")
    })
  })

  describe("listNotes", () => {
    it("should retrieve all markdown files", async () => {
      // GIVEN: api client created
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      // AND: mock server is running
      const data = {
        files: ["note1.md", "note2.md", "file.txt", "folder/note3.md"],
      }
      mockClient.get.mockResolvedValue({ data })

      // WHEN: listNotes is called
      const result = await api.listNotes()

      // THEN: correct files are returned
      expect(result).toEqual(["note1.md", "note2.md", "folder/note3.md"])
    })

    it("should filter by folder when provided", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      expect(axiosCreateSpy).toHaveBeenCalledTimes(1) // be sure that mock reseted propoerly from prev runs

      const mockClient = axiosCreateSpy.mock.results[0].value

      const data = {
        files: ["note1.md", "folder/note2.md", "folder/subfolder/note3.md"],
      }
      mockClient.get.mockResolvedValue({ data })

      // WHEN: listNotes is called with folder
      const result = await api.listNotes("folder")

      // THEN: correct files are returned
      expect(result).toEqual(data.files)
    })

    it("should handle empty response", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      const data = {}
      mockClient.get.mockResolvedValue({ data })

      // WHEN: listNotes is called
      const result = await api.listNotes()

      // THEN: empty array is returned
      expect(result).toEqual([])
    })
  })

  describe("readNote", () => {
    it("should retrieve a note by path", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      const path = "folder/note.md"
      const content = "Note content"
      const metadata = { tags: ["test"], stat: { ctime: 1, mtime: 1, size: 1 } }
      const data = { path, content, ...metadata }
      mockClient.get.mockResolvedValue({ data })

      // WHEN: readNote is called
      const result = await api.readNote(path)

      // THEN: correct note is returned
      expect(result).toEqual({ path, content, metadata })
    })
  })

  describe("writeNote", () => {
    it("should save a note with the given content", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      const path = "folder/note.md"
      const content = "Updated content"
      mockClient.put.mockResolvedValue({})

      // WHEN: writeNote is called
      await api.writeNote(path, content)

      // THEN: note is saved
      expect(mockClient.put).toHaveBeenCalledWith(
        "/vault/folder%2Fnote.md", // path
        "Updated content", // content
        {
          // extras
          headers: {
            "Content-Type": "text/markdown",
          },
          timeout: 5000, // Write operations have longer timeout
        },
      )
    })
  })

  describe("searchNotes", () => {
    it("should search for notes matching the query", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      const query = "test query"
      const apiResponse = [
        {
          filename: "note1.md",
          score: 0.75,
          matches: [{ context: "content1" }],
        },
        {
          filename: "note2.md",
          score: 0.5,
          matches: [{ context: "content2" }],
        },
      ]
      const expectedResults = [
        {
          path: "note1.md",
          content: "content1",
          metadata: { score: 0.75 },
        },
        {
          path: "note2.md",
          content: "content2",
          metadata: { score: 0.5 },
        },
      ]

      mockClient.post.mockResolvedValue({ data: apiResponse })

      // WHEN: searchNotes is called
      const result = await api.searchNotes(query)

      // THEN: correct notes are returned
      expect(result).toEqual(expectedResults)
    })
  })

  describe("getMetadata", () => {
    it("should retrieve metadata for a note", async () => {
      // GIVEN: mock server is running
      const api = new ObsidianAPI(config)
      const mockClient = axiosCreateSpy.mock.results[0].value

      const path = "folder/note.md"
      const metadata = { tags: ["test"], created: "2025-03-23" }

      mockClient.get.mockResolvedValue({ data: metadata })

      // WHEN: getMetadata is called
      const result = await api.getMetadata(path)

      // THEN: correct metadata is returned
      // @ts-expect-error
      expect(result).toEqual(metadata)
    })
  })
})
