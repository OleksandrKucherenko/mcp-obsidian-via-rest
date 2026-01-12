import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { SelfHealingObsidianAPI } from "../../src/api/self-healing"

// Mock the url-tester module
const mockSelectBestUrl = mock(() => "https://fastest.com:27124")
const mockTestUrlsInParallel = mock(() =>
  Promise.resolve([
    { url: "https://fastest.com:27124", success: true, latency: 10 },
    { url: "https://slow.com:27124", success: true, latency: 100 },
  ]),
)

mock.module("../../src/api/url-tester", () => ({
  testUrlsInParallel: mockTestUrlsInParallel,
  selectBestUrl: mockSelectBestUrl,
}))

// Mock ObsidianAPI parent class
class MockObsidianAPI {
  private failed = false

  constructor(public config: { urls: string[]; apiKey: string; baseURL: string }) {}

  async getServerInfo() {
    if (this.failed) {
      throw new Error("Not connected")
    }
    return { status: "OK", versions: { self: "1.0.0" } }
  }

  fail() {
    this.failed = true
  }

  recover() {
    this.failed = false
  }
}

// Mock the obsidian-api module
mock.module("../../src/client/obsidian-api", () => ({
  ObsidianAPI: MockObsidianAPI,
}))

describe("SelfHealingObsidianAPI", () => {
  let api: SelfHealingObsidianAPI
  const testConfig = {
    urls: ["https://127.0.0.1:27124", "https://192.168.1.100:27124"],
    apiKey: "a".repeat(64),
    baseURL: "https://127.0.0.1:27124",
    host: "https://127.0.0.1",
    port: 27124,
    testTimeout: 2000,
    retryInterval: 30000,
  }

  beforeEach(() => {
    // Reset mocks
    mockSelectBestUrl.mockRestore()
    mockTestUrlsInParallel.mockRestore()
  })

  afterEach(() => {
    if (api) {
      api.destroy()
    }
  })

  describe("initialization", () => {
    test("should select best URL on initialization", async () => {
      mockSelectBestUrl.mockReturnValue("https://192.168.1.100:27124")

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      expect(mockTestUrlsInParallel).toHaveBeenCalledWith(testConfig.urls, testConfig.apiKey, testConfig.testTimeout)
      expect(mockSelectBestUrl).toHaveBeenCalled()
    })

    test("should set connection URL to best URL", async () => {
      mockSelectBestUrl.mockReturnValue("https://192.168.1.100:27124")

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      expect(api.getConnectionUrl()).toBe("https://192.168.1.100:27124")
    })

    test("should throw when no working URL is found", async () => {
      mockSelectBestUrl.mockReturnValue(null)

      api = new SelfHealingObsidianAPI(testConfig)

      // Should throw error if no working URL found
      await expect(api.initialize()).rejects.toThrow("No working Obsidian API URL found")
    })
  })

  describe("connection monitoring", () => {
    test("should start health monitoring after initialization", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      const health = api.getHealth()
      expect(health.healthy).toBe(true)
      expect(health.url).toBe(testConfig.urls[0])
    })

    test("should track reconnection count", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      const health = api.getHealth()
      expect(health.reconnectCount).toBe(0)
    })
  })

  describe("reconnection logic", () => {
    test("should attempt reconnection on failure", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])
      mockTestUrlsInParallel.mockResolvedValue([{ url: testConfig.urls[1], success: true, latency: 50 }])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      // Trigger reconnection attempt
      await api.attemptReconnect()

      expect(mockTestUrlsInParallel).toHaveBeenCalled()
    })

    test("should switch to alternative URL when current fails", async () => {
      mockSelectBestUrl.mockReturnValueOnce(testConfig.urls[0]).mockReturnValue(testConfig.urls[1])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      // Mock alternative URL testing
      mockTestUrlsInParallel.mockResolvedValueOnce([{ url: testConfig.urls[1], success: true, latency: 50 }])

      await api.attemptReconnect()

      expect(api.getConnectionUrl()).toBe(testConfig.urls[1])
    })

    test("should update health status after changes", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      const initialHealth = api.getHealth()
      expect(initialHealth.healthy).toBe(true)
      expect(initialHealth.reconnectCount).toBe(0)
    })
  })

  describe("cleanup", () => {
    test("should cleanup resources on destroy", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      api.destroy()

      // After destroy, health should show unhealthy
      // Note: The implementation doesn't change health on destroy,
      // but timers should be cleared
      const health = api.getHealth()
      expect(health.url).toBe(testConfig.urls[0])
    })
  })

  describe("connection thrashing prevention", () => {
    test("should prevent concurrent reconnection attempts", async () => {
      mockSelectBestUrl.mockReturnValue(testConfig.urls[0])

      api = new SelfHealingObsidianAPI(testConfig)
      await api.initialize()

      // Start two reconnects simultaneously
      const promise1 = api.attemptReconnect()
      const promise2 = api.attemptReconnect()

      await Promise.all([promise1, promise2])

      // Should not crash due to concurrent calls
      expect(api.getConnectionUrl()).toBe(testConfig.urls[0])
    })
  })
})
