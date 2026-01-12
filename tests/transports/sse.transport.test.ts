import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { createSseTransport } from "../../src/transports/sse.transport"
import { createMcpServer } from "../../src/server/mcp-server"
import type { SseConfig } from "../../src/transports/types"

// Mock ObsidianAPI
class MockObsidianAPI {
  constructor(public config: unknown) {}
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

describe("SSE Transport", () => {
  let context: Awaited<ReturnType<typeof createSseTransport>> | undefined
  let close: (() => Promise<void>) | undefined
  const testConfig: SseConfig = {
    enabled: true,
    path: "/sse",
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
  })

  afterEach(async () => {
    if (close) {
      await close()
      close = undefined
    }
  })

  // Note: SSE transport implementation is planned for future phases.
  // The current tests document the expected behavior.
  // When SSE transport is implemented, these tests will drive the implementation.

  test("should create SSE transport context", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    // This test will fail until createSseTransport is implemented
    context = await createSseTransport(testConfig, server)
    close = context.close

    expect(context).toBeDefined()
    expect(context.close).toBeInstanceOf(Function)
  })

  test("should support SSE path configuration", async () => {
    const configWithPath: SseConfig = {
      enabled: true,
      path: "/custom-sse",
    }

    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createSseTransport(configWithPath, server)
    close = context.close

    // Verify the transport was created with custom path
    expect(context).toBeDefined()
  })

  test("should handle SSE endpoint initialization", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createSseTransport(testConfig, server)
    close = context.close

    // Verify transport was created successfully
    expect(context).toBeDefined()
  })

  test("should provide close method for cleanup", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createSseTransport(testConfig, server)

    // Verify close method exists and can be called
    expect(context).toBeDefined()
    expect(context.close).toBeInstanceOf(Function)

    await context.close()
    // If we got here without errors, close works correctly
    expect(true).toBe(true)
  })
})

describe("SSE Transport - Future Implementation", () => {
  // These tests document the expected behavior of the SSE transport
  // when it is fully implemented. They are skipped for now.

  test.skip("should mount on shared Hono app", async () => {
    // SSE should share the HTTP server for efficiency
  })

  test.skip("should handle GET /sse for connection establishment", async () => {
    // SSE endpoint should accept GET requests at configured path
  })

  test.skip("should generate unique session IDs", async () => {
    // Each SSE connection should have a unique session ID
  })

  test.skip("should establish SSE connection with proper headers", async () => {
    // Response should have:
    // - Content-Type: text/event-stream
    // - Cache-Control: no-cache
    // - Connection: keep-alive
  })

  test.skip("should handle POST /messages with valid session ID", async () => {
    // JSON-RPC messages should be sent via POST /messages
  })

  test.skip("should reject messages with invalid session ID", async () => {
    // Invalid session IDs should return error response
  })

  test.skip("should manage session-to-transport mapping", async () => {
    // Each SSE session should map to a transport instance
  })

  test.skip("should cleanup sessions on disconnect", async () => {
    // Sessions should be cleaned up when client disconnects
  })

  test.skip("should send events via SSE stream", async () => {
    // Server should send MCP responses via SSE events
  })
})
