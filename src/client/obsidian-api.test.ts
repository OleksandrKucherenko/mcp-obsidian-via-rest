import axios from "axios"
import nock from "nock"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ObsidianAPI } from "./obsidian-api.ts"
import type { IObsidianAPI, ObsidianConfig } from "./types.ts"

const config: ObsidianConfig = {
  apiKey: "test-api-key",
  port: 27124,
  host: "127.0.0.1",
}

describe("ObsidianAPI - Unit Tests", () => {
  let api: IObsidianAPI
  let baseURL: string
  let axiosCreateSpy: vi.MockInstance<ReturnType<typeof axios.create>, Parameters<typeof axios.create>>

  beforeEach(() => {
    axiosCreateSpy = vi.spyOn(axios, "create")
    baseURL = `http://${config.host}:${config.port}`
    api = new ObsidianAPI(config)
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    axiosCreateSpy.mockRestore()
    nock.cleanAll()
    nock.enableNetConnect()
  })

  describe("constructor", () => {
    it("should create an axios client with the correct configuration", () => {
      expect(axiosCreateSpy).toHaveBeenCalledTimes(1)
      const createCall = axiosCreateSpy.mock.calls[0][0]
      expect(createCall.baseURL).toBe("http://127.0.0.1:27124")
      expect(createCall.headers.Authorization).toBe("Bearer test-api-key")
      expect(createCall.headers["Content-Type"]).toBe("application/json")
      expect(createCall.proxy).toBe(false)
      // Check that httpsAgent is defined (for self-signed certificates)
      expect(createCall.httpsAgent).toBeDefined()
    })

    it("should handle https URLs correctly", () => {
      const httpsConfig = { ...config, host: "https://localhost" }
      new ObsidianAPI(httpsConfig)
      const createCall = (axios.create as ReturnType<typeof vi.fn>).mock.calls[1][0]
      expect(createCall.baseURL).toBe("https://localhost:27124")
    })
  })

  describe("listNotes", () => {
    it("should retrieve all markdown files", async () => {
      nock(baseURL)
        .get("/vault/")
        .reply(200, {
          files: ["note1.md", "note2.md", "file.txt", "folder/note3.md"],
        })
      const result = await api.listNotes()
      expect(result).toEqual(["note1.md", "note2.md", "folder/note3.md"])
    })

    it("should filter by folder when provided", async () => {
      nock(baseURL)
        .get("/vault/folder/")
        .reply(200, {
          files: ["note1.md", "folder/note2.md", "folder/subfolder/note3.md"],
        })
      const result = await api.listNotes("folder")
      expect(result).toEqual(["note1.md", "folder/note2.md", "folder/subfolder/note3.md"])
    })

    it("should handle empty response", async () => {
      nock(baseURL).get("/vault/").reply(200, {})
      const result = await api.listNotes()
      expect(result).toEqual([])
    })
  })

  describe("readNote", () => {
    it("should retrieve a note by path", async () => {
      const path = "folder/note.md"
      const content = "Note content"
      const metadata = { tags: ["test"] }
      nock(baseURL)
        .get("/vault/folder%2Fnote.md")
        .matchHeader("accept", "application/vnd.olrapi.note+json")
        .reply(200, { path, content, ...metadata })
      const result = await api.readNote(path)
      expect(result).toEqual({ path, content, metadata })
    })
  })

  describe("writeNote", () => {
    it("should save a note with the given content", async () => {
      const path = "folder/note.md"
      const content = "Updated content"
      nock(baseURL).put("/vault/folder%2Fnote.md", content).matchHeader("content-type", "text/markdown").reply(200, {})
      await api.writeNote(path, content)
    })
  })

  describe("searchNotes", () => {
    it("should search for notes matching the query", async () => {
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
        { path: "note1.md", content: "content1", metadata: { score: 0.75 } },
        { path: "note2.md", content: "content2", metadata: { score: 0.5 } },
      ]
      nock(baseURL).post("/search/simple/").query({ query, contextLength: 100 }).reply(200, apiResponse)
      const result = await api.searchNotes(query)
      expect(result).toEqual(expectedResults)
    })
  })

  describe("getMetadata", () => {
    it("should retrieve metadata for a note", async () => {
      const path = "folder/note.md"
      const metadata = { tags: ["test"], created: "2025-03-23" }
      nock(baseURL)
        .get("/vault/folder%2Fnote.md")
        .matchHeader("accept", "application/vnd.olrapi.note+json")
        .reply(200, metadata)
      const result = await api.getMetadata(path)
      expect(result).toEqual(metadata)
    })
  })
})
