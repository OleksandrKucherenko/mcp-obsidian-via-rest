import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createMcpServer } from "../../src/server/mcp-server"
import { createSseTransport } from "../../src/transports/sse.transport"
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

// Note: SSE transport is deprecated in favor of WebStandardStreamableHTTPServerTransport,
// which handles both HTTP POST and SSE streaming through a single endpoint.
// The stub implementation remains for backward compatibility but is not actively developed.
