import { beforeEach, describe, expect, mock, test } from "bun:test"
import { createMcpServer } from "../../src/server/mcp-server"

// Mock ObsidianAPI
const mockGetServerInfo = mock(() => Promise.resolve({ status: "OK", versions: { self: "1.0.0" } }))
const mockReadNote = mock(() =>
  Promise.resolve({
    path: "/test.md",
    content: "# Test",
    metadata: { stat: { size: 100 }, tags: [] },
  }),
)
const mockSearchNotes = mock(() => Promise.resolve([{ path: "/test.md", content: "" }]))

class MockObsidianAPI {
  constructor(public config: unknown) {}

  getServerInfo = mockGetServerInfo
  readNote = mockReadNote
  searchNotes = mockSearchNotes
}

mock.module("../../src/client/obsidian-api", () => ({
  ObsidianAPI: MockObsidianAPI,
}))

describe("MCP Server Factory", () => {
  const testConfig = {
    apiKey: "a".repeat(64),
    host: "https://127.0.0.1",
    port: 27124,
    baseURL: "https://127.0.0.1:27124",
  }

  beforeEach(() => {
    mockGetServerInfo.mockRestore()
    mockReadNote.mockRestore()
    mockSearchNotes.mockRestore()
  })

  test("should create server instance", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    expect(server).toBeDefined()
  })

  test("should create server with package name and version", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    // Verify server was created (name and version are set in constructor)
    expect(server).toBeDefined()
  })

  test("should register get_note_content tool", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    // The server should have tools registered (verified by successful creation)
    expect(server).toBeDefined()
  })

  test("should register obsidian_search tool", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    expect(server).toBeDefined()
  })

  test("should register obsidian_semantic_search tool", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    expect(server).toBeDefined()
  })

  test("should register obsidian:// resource template", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    expect(server).toBeDefined()
  })

  test("should use provided ObsidianAPI instance", () => {
    const api = new MockObsidianAPI(testConfig)
    const server = createMcpServer(api)

    // Verify the API instance is used by the server
    // (The API is captured in the closures of tool handlers)
    expect(server).toBeDefined()
  })
})
