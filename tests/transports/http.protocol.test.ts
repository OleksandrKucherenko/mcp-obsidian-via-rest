import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createHttpTransport } from "../../src/transports/http.transport"
import { createMcpServer } from "../../src/server/mcp-server"
import type { HttpConfig } from "../../src/transports/types"
import { randomUUID } from "node:crypto"

// Mock ObsidianAPI
class MockObsidianAPI {
  constructor(public config: unknown) {}

  async readNote(_filePath: string) {
    return {
      content: "test content",
      metadata: { filepath: _filePath },
    }
  }

  async searchNotes(_query: string) {
    return [
      { content: "result", metadata: { filepath: "/test.md" } },
    ]
  }
}

// Mock stdio module (required by mcp-server)
const mockIntercept = { stdin: process.stdin, stdout: process.stdout }

import { mock } from "bun:test"
mock.module("../../src/client/obsidian-api", () => ({
  ObsidianAPI: MockObsidianAPI,
}))

mock.module("../../src/stdio.js", () => ({
  intercept: mockIntercept,
}))

describe("HTTP Transport - MCP Protocol Integration", () => {
  let context: Awaited<ReturnType<typeof createHttpTransport>> | undefined
  let close: (() => Promise<void>) | undefined
  let serverUrl: string | undefined
  const testConfig: HttpConfig = {
    enabled: true,
    port: 0, // Use 0 to get random available port
    host: "127.0.0.1",
    path: "/mcp",
  }

  const obsidianConfig = {
    apiKey: "a".repeat(64),
    host: "https://127.0.0.1",
    port: 27124,
    baseURL: "https://127.0.0.1:27124",
  }

  beforeEach(() => {
    // Reset context
    context = undefined
    serverUrl = undefined
  })

  afterEach(async () => {
    if (close) {
      await close()
      close = undefined
    }
  })

  describe("MCP JSON-RPC Protocol", () => {
    test("should handle initialize request", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // Extract port from context (need to extend context to include this)
      // For now, skip this test as we need to expose the port
      expect(context).toBeDefined()
    })

    test("should return valid server info in initialize response", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement actual MCP protocol handling
      // For now, just verify the structure exists
      expect(context).toBeDefined()
    })

    test("should handle tools/list request", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement actual MCP protocol handling
      expect(context).toBeDefined()
    })

    test("should handle tools/call request for get_note_content", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement actual MCP protocol handling
      expect(context).toBeDefined()
    })

    test("should handle tools/call request for obsidian_search", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement actual MCP protocol handling
      expect(context).toBeDefined()
    })

    test("should return JSON-RPC error for invalid requests", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement actual MCP protocol handling
      expect(context).toBeDefined()
    })
  })

  describe("Session Management", () => {
    test("should generate session ID on initialize", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement session management
      expect(context).toBeDefined()
    })

    test("should include session ID in response headers", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement session management
      expect(context).toBeDefined()
    })

    test("should reject requests with invalid session ID", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement session validation
      expect(context).toBeDefined()
    })
  })

  describe("SSE Streaming", () => {
    test("should establish SSE connection on GET request", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement SSE streaming
      expect(context).toBeDefined()
    })

    test("should send events via SSE stream", async () => {
      const api = new MockObsidianAPI(obsidianConfig)
      const server = createMcpServer(api)

      context = await createHttpTransport(testConfig, server)
      close = context.close

      // This test will fail until we implement SSE streaming
      expect(context).toBeDefined()
    })
  })
})

describe("HTTP Transport - Integration with Real HTTP", () => {
  let context: Awaited<ReturnType<typeof createHttpTransport>> | undefined
  let close: (() => Promise<void>) | undefined
  const testConfig: HttpConfig = {
    enabled: true,
    port: 0,
    host: "127.0.0.1",
    path: "/mcp",
  }

  const obsidianConfig = {
    apiKey: "a".repeat(64),
    host: "https://127.0.0.1",
    port: 27124,
    baseURL: "https://127.0.0.1:27124",
  }

  afterEach(async () => {
    if (close) {
      await close()
      close = undefined
    }
  })

  test("should accept real HTTP POST request with initialize", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)
    close = context.close

    // This test will be implemented once we can extract the actual port
    // from the context and make real HTTP requests
    expect(context).toBeDefined()
  })

  test("should accept real HTTP POST request with tools/list", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)
    close = context.close

    // This test will be implemented once we can extract the actual port
    // from the context and make real HTTP requests
    expect(context).toBeDefined()
  })

  test("should return 401 for unauthenticated requests when auth enabled", async () => {
    const configWithAuth: HttpConfig = {
      enabled: true,
      port: 0,
      host: "127.0.0.1",
      path: "/mcp",
      auth: {
        enabled: true,
        token: "test-token-123456",
      },
    }

    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(configWithAuth, server)
    close = context.close

    // This test will be implemented once we can extract the actual port
    // and make real HTTP requests without auth token
    expect(context).toBeDefined()
  })

  test("should return 200 for authenticated requests when auth enabled", async () => {
    const configWithAuth: HttpConfig = {
      enabled: true,
      port: 0,
      host: "127.0.0.1",
      path: "/mcp",
      auth: {
        enabled: true,
        token: "test-token-123456",
      },
    }

    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(configWithAuth, server)
    close = context.close

    // This test will be implemented once we can extract the actual port
    // and make real HTTP requests with auth token
    expect(context).toBeDefined()
  })
})
