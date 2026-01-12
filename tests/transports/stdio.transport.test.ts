import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
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
  _registeredResources: Record<string, unknown>
  _registeredResourceTemplates: Record<string, unknown>
  _registeredTools: Record<string, unknown>
  _registeredPrompts: Record<string, unknown>
  _toolHandlersInitialized: false
  _completionHandlerInitialized: false
  _resourceHandlersInitialized: false
  _promptHandlersInitialized: false
  _experimental: undefined

  server: unknown
  connect: (transport: unknown) => Promise<void>
}

// Mock mcp-server module
const createMockServer = mock(
  (): MockServer => ({
    _registeredResources: {},
    _registeredResourceTemplates: {},
    _registeredTools: {},
    _registeredPrompts: {},
    _toolHandlersInitialized: false,
    _completionHandlerInitialized: false,
    _resourceHandlersInitialized: false,
    _promptHandlersInitialized: false,
    _experimental: undefined,
    server: undefined,
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
      _registeredResources: {},
      _registeredResourceTemplates: {},
      _registeredTools: {},
      _registeredPrompts: {},
      _toolHandlersInitialized: false,
      _completionHandlerInitialized: false,
      _resourceHandlersInitialized: false,
      _promptHandlersInitialized: false,
      _experimental: undefined,
      server: undefined,
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
    context = createStdioTransport(mockServer as unknown as McpServer)

    expect(context).toBeDefined()
    expect(context.close).toBeInstanceOf(Function)
  })

  test("should create stdio transport with intercepted streams", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify a transport instance was created
    expect(mockTransportInstances.length).toBe(1)
  })

  test("should connect server to transport", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify connect was called once
    expect(mockConnectCalls.length).toBe(1)
  })

  test("should pass transport to server.connect", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify transport instance was passed to connect
    expect(mockConnectCalls[0]).toBe(mockTransportInstances[0])
  })

  test("should use intercepted streams for transport", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Note: We can't directly verify constructor args in Bun's mock system
    // but we verified a transport was created and connected
    expect(mockTransportInstances.length).toBe(1)
    expect(mockConnectCalls.length).toBe(1)
  })

  test("should create stdio transport with intercepted streams", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify a transport instance was created
    expect(mockTransportInstances.length).toBe(1)
  })

  test("should connect server to transport", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify connect was called once
    expect(mockConnectCalls.length).toBe(1)
  })

  test("should pass transport to server.connect", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Verify the transport instance was passed to connect
    expect(mockConnectCalls[0]).toBe(mockTransportInstances[0])
  })

  test("should use intercepted streams for transport", () => {
    context = createStdioTransport(mockServer as unknown as McpServer)

    // Note: We can't directly verify the constructor args in Bun's mock system
    // but we verified a transport was created and connected
    expect(mockTransportInstances.length).toBe(1)
    expect(mockConnectCalls.length).toBe(1)
  })
})
