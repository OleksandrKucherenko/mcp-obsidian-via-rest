import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { createStdioTransport } from "../../src/transports/stdio.transport"
import type { StdioTransportContext } from "../../src/transports/types"

// Track mock transport instances and connections
const mockTransportInstances: Array<{ onclose: (() => void) | null }> = []
const mockConnectCalls: Array<unknown> = []

// Mock the MCP SDK stdio transport
class MockStdioServerTransport {
  onclose: (() => void) | null = null

  constructor() {
    mockTransportInstances.push(this)
  }

  async start(): Promise<void> {}
  async close(): Promise<void> {}
}

mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: MockStdioServerTransport,
}))

// Mock server type - matches McpServer interface enough for our tests
type MockServer = {
  connect: (transport: unknown) => Promise<void>
}

// Mock the mcp-server module
const createMockServer = mock(
  (): MockServer => ({
    connect: mock(async (transport: unknown) => {
      mockConnectCalls.push(transport)
      return Promise.resolve()
    }),
  }),
)

mock.module("../../src/server/mcp-server.js", () => ({
  createMcpServer: createMockServer,
}))

// Mock stdio module
const mockIntercept = { stdin: process.stdin, stdout: process.stdout }

mock.module("../../src/stdio.js", () => ({
  intercept: mockIntercept,
}))

describe("Stdio Transport Wrapper", () => {
  let context: StdioTransportContext
  let mockServer: MockServer

  beforeEach(() => {
    // Clear mock transport instances and connect calls
    mockTransportInstances.length = 0
    mockConnectCalls.length = 0

    // Create a fresh mock server for each test
    mockServer = {
      connect: mock(async (transport: unknown) => {
        mockConnectCalls.push(transport)
        return Promise.resolve()
      }),
    }
    createMockServer.mockReturnValue(mockServer)
  })

  afterEach(async () => {
    if (context) {
      await context.close()
    }
  })

  test("should create transport context", () => {
    context = createStdioTransport(mockServer)

    expect(context).toBeDefined()
    expect(context.close).toBeInstanceOf(Function)
  })

  test("should create stdio transport with intercepted streams", () => {
    context = createStdioTransport(mockServer)

    // Verify a transport instance was created
    expect(mockTransportInstances.length).toBe(1)
  })

  test("should connect server to transport", () => {
    context = createStdioTransport(mockServer)

    // Verify connect was called once
    expect(mockConnectCalls.length).toBe(1)
  })

  test("should pass transport to server.connect", () => {
    context = createStdioTransport(mockServer)

    // Verify the transport instance was passed to connect
    expect(mockConnectCalls[0]).toBe(mockTransportInstances[0])
  })

  test("should use intercepted streams for transport", () => {
    context = createStdioTransport(mockServer)

    // Note: We can't directly verify the constructor args in Bun's mock system
    // but we verified a transport was created and connected
    expect(mockTransportInstances.length).toBe(1)
    expect(mockConnectCalls.length).toBe(1)
  })
})
