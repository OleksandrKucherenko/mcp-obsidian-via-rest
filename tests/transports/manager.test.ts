import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { TransportManager, type TransportFactories } from "../../src/transports/manager"
import type { TransportConfig, TransportContext } from "../../src/transports/types"

// Mock server type for tests
type MockServer = {
  connect: (transport: unknown) => Promise<void>
}

describe("TransportManager", () => {
  let manager: TransportManager
  let mockServer: MockServer
  let mockFactories: TransportFactories

  // Track mock transport contexts
  const mockStdioContexts: Array<{ close: () => Promise<void> }> = []
  const mockHttpContexts: Array<{ close: () => Promise<void> }> = []
  const mockSseContexts: Array<{ close: () => Promise<void> }> = []

  // Create mock transport context
  const createMockContext = (
    tracker: Array<{ close: () => Promise<void> }>,
  ): { close: () => Promise<void> } => {
    const context = {
      close: mock(async () => {
        const index = tracker.indexOf(context)
        if (index > -1) {
          tracker.splice(index, 1)
        }
      }),
    }
    tracker.push(context)
    return context
  }

  // Mock transport factories (will be set in beforeEach)
  let mockStdioFactory: ReturnType<typeof mock>
  let mockHttpFactory: ReturnType<typeof mock>
  let mockSseFactory: ReturnType<typeof mock>

  beforeEach(() => {
    // Clear all mock trackers
    mockStdioContexts.length = 0
    mockHttpContexts.length = 0
    mockSseContexts.length = 0

    // Create fresh mocks for each test
    mockStdioFactory = mock(() => createMockContext(mockStdioContexts))
    mockHttpFactory = mock(async () => createMockContext(mockHttpContexts))
    mockSseFactory = mock(async () => createMockContext(mockSseContexts))

    // Transport factories for dependency injection
    mockFactories = {
      stdio: mockStdioFactory,
      http: mockHttpFactory,
      sse: mockSseFactory,
    }

    // Create fresh mock server
    mockServer = {
      connect: mock(async () => Promise.resolve()),
    }
  })

  afterEach(async () => {
    if (manager) {
      await manager.stopTransports()
    }
  })

  test("should start enabled transports based on config", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: false, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    // Verify stdio and http transports were created
    expect(mockStdioContexts.length).toBe(1)
    expect(mockHttpContexts.length).toBe(1)
    // SSE should not be created
    expect(mockSseContexts.length).toBe(0)
  })

  test("should skip disabled transports", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: false, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: false, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    // Only stdio should be created
    expect(mockStdioContexts.length).toBe(1)
    expect(mockHttpContexts.length).toBe(0)
    expect(mockSseContexts.length).toBe(0)
  })

  test("should start all transports when all enabled", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: true, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    // All transports should be created
    expect(mockStdioContexts.length).toBe(1)
    expect(mockHttpContexts.length).toBe(1)
    expect(mockSseContexts.length).toBe(1)
  })

  test("should stop all running transports", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: true, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    // Verify all transports started
    expect(mockStdioContexts.length).toBe(1)
    expect(mockHttpContexts.length).toBe(1)
    expect(mockSseContexts.length).toBe(1)

    // Stop all transports
    await manager.stopTransports()

    // Verify all transports were closed and removed from trackers
    expect(mockStdioContexts.length).toBe(0)
    expect(mockHttpContexts.length).toBe(0)
    expect(mockSseContexts.length).toBe(0)
  })

  test("should return transport status", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: false, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    const status = manager.getStatus()

    expect(status).toEqual({
      stdio: { running: true, enabled: true },
      http: { running: true, enabled: true },
      sse: { running: false, enabled: false },
    })
  })

  test("should handle transport initialization errors gracefully", async () => {
    // Mock stdio factory to throw error
    mockStdioFactory.mockImplementation(() => {
      throw new Error("Stdio transport failed to initialize")
    })

    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: true, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)

    // Should not throw, should handle error gracefully
    await manager.startTransports()

    // Stdio should fail, but http and sse should still start
    expect(mockStdioContexts.length).toBe(0)
    expect(mockHttpContexts.length).toBe(1)
    expect(mockSseContexts.length).toBe(1)

    // Status should show stdio as not running despite being enabled
    const status = manager.getStatus()
    expect(status.stdio).toEqual({ running: false, enabled: true })
    expect(status.http).toEqual({ running: true, enabled: true })
    expect(status.sse).toEqual({ running: true, enabled: true })
  })

  test("should cleanup all resources on stop", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: true, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    // Get reference to close methods
    const stdioClose = mockStdioContexts[0]?.close
    const httpClose = mockHttpContexts[0]?.close
    const sseClose = mockSseContexts[0]?.close

    await manager.stopTransports()

    // Verify all close methods were called
    expect(stdioClose).toHaveBeenCalled()
    expect(httpClose).toHaveBeenCalled()
    expect(sseClose).toHaveBeenCalled()
  })

  test("should handle stop when no transports are running", async () => {
    const config: TransportConfig = {
      stdio: { enabled: false },
      http: { enabled: false, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: false, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)

    // Should not throw even when no transports are running
    await manager.stopTransports()

    const status = manager.getStatus()
    expect(status).toEqual({
      stdio: { running: false, enabled: false },
      http: { running: false, enabled: false },
      sse: { running: false, enabled: false },
    })
  })

  test("should allow re-starting transports after stopping", async () => {
    const config: TransportConfig = {
      stdio: { enabled: true },
      http: { enabled: false, port: 3000, host: "0.0.0.0", path: "/mcp" },
      sse: { enabled: false, path: "/sse" },
    }

    manager = new TransportManager(config, mockServer, mockFactories)
    await manager.startTransports()

    expect(mockStdioContexts.length).toBe(1)

    await manager.stopTransports()
    expect(mockStdioContexts.length).toBe(0)

    // Start again
    await manager.startTransports()
    expect(mockStdioContexts.length).toBe(1)
  })
})
