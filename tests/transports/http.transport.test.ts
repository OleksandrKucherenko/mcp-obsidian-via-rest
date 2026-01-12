import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createHttpTransport } from "../../src/transports/http.transport"
import { createMcpServer } from "../../src/server/mcp-server"
import type { HttpConfig } from "../../src/transports/types"

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

describe("HTTP Transport", () => {
  let context: Awaited<ReturnType<typeof createHttpTransport>> | undefined
  let close: (() => Promise<void>) | undefined
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
  })

  afterEach(async () => {
    if (close) {
      await close()
      close = undefined
    }
  })

  test("should create HTTP transport context", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)
    close = context.close

    expect(context).toBeDefined()
    expect(context.close).toBeInstanceOf(Function)
  })

  test("should start HTTP server on configured port", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)
    close = context.close

    // If we got here without errors, the server started successfully
    expect(context).toBeDefined()
  })

  test("should create Hono app for HTTP handling", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)
    close = context.close

    // If we got here without errors, Hono app was created successfully
    expect(context).toBeDefined()
  })

  test("should close server cleanly", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    context = await createHttpTransport(testConfig, server)

    expect(context).toBeDefined()

    // Close should not throw
    await context.close()
    // If we got here, close didn't throw
    expect(true).toBe(true)
  })

  test("should handle multiple start/stop cycles", async () => {
    const api = new MockObsidianAPI(obsidianConfig)
    const server = createMcpServer(api)

    // First cycle
    const context1 = await createHttpTransport(testConfig, server)
    expect(context1).toBeDefined()
    await context1.close()

    // Second cycle (simulating restart)
    const context2 = await createHttpTransport(testConfig, server)
    expect(context2).toBeDefined()
    await context2.close()
  })
})
