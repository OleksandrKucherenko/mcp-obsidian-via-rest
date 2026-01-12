import { describe, expect, mock, test } from "bun:test"
import { SelfHealingObsidianAPI } from "../../src/api/self-healing"
import { getHealthStatus } from "../../src/server/health"

// Mock the URL testing functions
mock.module("../../src/api/url-tester", () => ({
  testUrlsInParallel: async () => [{ url: "https://127.0.0.1:27124", success: true, latency: 50 }],
  selectBestUrl: (results: unknown[]) => (results[0] as { url: string } | undefined)?.url,
}))

// Mock ObsidianAPI (not IObsidianAPI, since that's just the interface)
class MockObsidianAPIImpl {
  constructor(public config: unknown) {}

  async getServerInfo() {
    return {
      version: "1.0.0",
      datetime: new Date().toISOString(),
    }
  }

  async readNote(_filePath: string) {
    return {
      content: "test content",
      metadata: { filepath: _filePath },
    }
  }

  async searchNotes(_query: string) {
    return [{ content: "result", metadata: { filepath: "/test.md" } }]
  }
}

mock.module("../../src/client/obsidian-api", () => ({
  ObsidianAPI: MockObsidianAPIImpl,
}))

describe("Health Monitoring", () => {
  test("should return healthy status when all systems operational", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    await selfHealingApi.initialize()

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.healthy).toBe(true)
    expect(health.obsidian.connected).toBe(true)
    expect(health.transports.stdio.running).toBe(true)
    expect(health.transports.http.running).toBe(true)
  })

  test("should return unhealthy when Obsidian disconnected", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    // Don't initialize - simulates disconnected state

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.healthy).toBe(false)
    expect(health.obsidian.connected).toBe(false)
  })

  test("should include Obsidian connection details", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    await selfHealingApi.initialize()

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.obsidian).toBeDefined()
    expect(health.obsidian.url).toBeDefined()
    expect(typeof health.obsidian.lastCheck).toBe("number")
  })

  test("should include all transport statuses", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    await selfHealingApi.initialize()

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.transports).toBeDefined()
    expect(health.transports.stdio).toBeDefined()
    expect(health.transports.http).toBeDefined()
  })

  test("should include uptime", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    await selfHealingApi.initialize()

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.uptime).toBeDefined()
    expect(typeof health.uptime).toBe("number")
    expect(health.uptime).toBeGreaterThanOrEqual(0)
  })

  test("should include last check timestamp", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    await selfHealingApi.initialize()

    const mockTransportManager = {
      getStatus: () => ({
        stdio: { enabled: true, running: true },
        http: { enabled: true, running: true },
      }),
    }

    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.timestamp).toBeDefined()
    expect(typeof health.timestamp).toBe("number")
  })

  test("should handle API errors gracefully", async () => {
    const selfHealingApi = new SelfHealingObsidianAPI({
      apiKey: "a".repeat(64),
      urls: ["https://127.0.0.1:27124"],
      port: 27124,
      host: "https://127.0.0.1",
      baseURL: "https://127.0.0.1:27124",
      testTimeout: 2000,
      retryInterval: 30000,
    })
    // Don't initialize - will cause getHealth to potentially fail

    const mockTransportManager = {
      getStatus: () => {
        throw new Error("Transport manager error")
      },
    }

    // Should not throw, should return unhealthy status
    const health = await getHealthStatus(selfHealingApi, mockTransportManager)

    expect(health.healthy).toBe(false)
    expect(health).toBeDefined()
  })
})
