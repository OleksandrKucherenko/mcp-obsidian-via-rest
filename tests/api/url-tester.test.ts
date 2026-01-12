import { beforeEach, describe, expect, test, mock } from "bun:test"
import { testUrlsInParallel, selectBestUrl } from "../../src/api/url-tester"

// Create a mock axios instance
const mockAxiosInstance = {
  get: mock(() => Promise.resolve({ data: { status: "OK" }, status: 200 })),
}

// Mock the axios module
mock.module("axios", () => ({
  default: {
    create: () => mockAxiosInstance,
  },
}))

describe("URL Testing", () => {
  const testApiKey = "a".repeat(64)
  const testUrls = ["https://127.0.0.1:27124", "https://192.168.1.100:27124", "https://example.com:27124"]

  beforeEach(() => {
    // Reset mock before each test
    mockAxiosInstance.get.mockRestore()
  })

  describe("testUrlsInParallel", () => {
    test("should test multiple URLs in parallel with Promise.all", async () => {
      // Mock all URLs to succeed
      mockAxiosInstance.get.mockImplementation(() =>
        Promise.resolve({
          data: { status: "OK" },
          status: 200,
        }),
      )

      const results = await testUrlsInParallel(testUrls, testApiKey, 2000)

      expect(results).toBeDefined()
      expect(results.length).toBe(3)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
    })

    test("should return success for working URLs", async () => {
      mockAxiosInstance.get.mockImplementation((url: string) =>
        Promise.resolve({
          data: { status: "OK" },
          status: 200,
        }),
      )

      const results = await testUrlsInParallel(testUrls, testApiKey, 2000)

      expect(results.every((r) => r.success)).toBe(true)
    })

    test("should return failure for unreachable URLs", async () => {
      mockAxiosInstance.get.mockImplementation(() => Promise.reject(new Error("Network error")))

      const results = await testUrlsInParallel(testUrls, testApiKey, 2000)

      expect(results.every((r) => !r.success)).toBe(true)
    })

    test("should measure latency for each URL", async () => {
      let callCount = 0
      mockAxiosInstance.get.mockImplementation(() => {
        callCount++
        // Simulate different latencies
        return Promise.resolve({
          data: { status: "OK" },
          status: 200,
        })
      })

      const results = await testUrlsInParallel(testUrls, testApiKey, 2000)

      expect(results.every((r) => r.latency !== undefined)).toBe(true)
      expect(results.every((r) => typeof r.latency === "number")).toBe(true)
    })

    test("should select fastest working URL from results", () => {
      const results = [
        { url: testUrls[0], success: true, latency: 100 },
        { url: testUrls[1], success: true, latency: 50 },
        { url: testUrls[2], success: true, latency: 200 },
      ]

      const best = selectBestUrl(results)

      expect(best).toBe(testUrls[1])
    })

    test("should return null if all URLs fail", () => {
      const results = [
        { url: testUrls[0], success: false, latency: 100 },
        { url: testUrls[1], success: false, latency: 50 },
        { url: testUrls[2], success: false, latency: 200 },
      ]

      const best = selectBestUrl(results)

      expect(best).toBeNull()
    })

    test("should handle timeout parameter gracefully", async () => {
      // Mock that simulates a timeout error
      mockAxiosInstance.get.mockImplementation(() => Promise.reject(new Error("timeout of 500ms exceeded")))

      const results = await testUrlsInParallel([testUrls[0]], testApiKey, 500)

      // Should handle the timeout error and return failure
      expect(results[0].success).toBe(false)
      expect(results[0].url).toBe(testUrls[0])
    })

    test("should handle mixed success and failure results", async () => {
      let callCount = 0
      mockAxiosInstance.get.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          return Promise.reject(new Error("Connection refused"))
        }
        return Promise.resolve({
          data: { status: "OK" },
          status: 200,
        })
      })

      const results = await testUrlsInParallel(testUrls, testApiKey, 2000)

      expect(results.length).toBe(3)
      expect(results.filter((r) => r.success).length).toBe(2)
      expect(results.filter((r) => !r.success).length).toBe(1)
    })
  })

  describe("selectBestUrl", () => {
    test("should select URL with lowest latency among successful ones", () => {
      const results = [
        { url: "https://fast.com:27124", success: true, latency: 10 },
        { url: "https://slow.com:27124", success: true, latency: 1000 },
        { url: "https://medium.com:27124", success: true, latency: 100 },
      ]

      const best = selectBestUrl(results)

      expect(best).toBe("https://fast.com:27124")
    })

    test("should ignore failed URLs even with low latency", () => {
      const results = [
        { url: "https://failed.com:27124", success: false, latency: 5 },
        { url: "https://slow.com:27124", success: true, latency: 1000 },
      ]

      const best = selectBestUrl(results)

      expect(best).toBe("https://slow.com:27124")
    })

    test("should return null for empty results array", () => {
      const best = selectBestUrl([])

      expect(best).toBeNull()
    })

    test("should handle all failed URLs", () => {
      const results = [
        { url: "https://failed1.com:27124", success: false, latency: 100 },
        { url: "https://failed2.com:27124", success: false, latency: 200 },
      ]

      const best = selectBestUrl(results)

      expect(best).toBeNull()
    })
  })
})
