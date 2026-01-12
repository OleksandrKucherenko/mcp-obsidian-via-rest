import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"

import { loadAppConfig } from "../src/config"

const TEST_ENV_FILES = [".env.test.local", ".env.test"]

describe("Configuration Loading - Multi-URL and Transports", () => {
  const originalEnv = { ...process.env }
  const testDir = process.cwd()

  // Clean up test environment files
  const cleanupTestFiles = () => {
    for (const file of TEST_ENV_FILES) {
      const filePath = join(testDir, file)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }
  }

  // Clear all API and MCP related environment variables
  const clearEnvVars = () => {
    // Delete all relevant environment variables
    const varsToDelete = [
      "API_KEY",
      "API_HOST",
      "API_PORT",
      "API_URLS",
      "MCP_TRANSPORTS",
      "MCP_HTTP_PORT",
      "MCP_HTTP_HOST",
      "MCP_HTTP_PATH",
      "MCP_SSE_PATH",
      "API_TEST_TIMEOUT",
      "API_RETRY_INTERVAL",
      "WSL_GATEWAY_IP",
    ]
    for (const v of varsToDelete) {
      delete process.env[v]
    }
  }

  beforeEach(() => {
    // Clean up before each test
    cleanupTestFiles()
    clearEnvVars()
  })

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv }
    cleanupTestFiles()
  })

  describe("Multi-URL Configuration", () => {
    test("should parse multi-URL JSON array from env variable", () => {
      process.env.API_KEY = "a".repeat(64) // Valid API key (64 chars)
      process.env.API_URLS = '["https://127.0.0.1:27124", "https://192.168.1.100:27124"]'

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.urls).toEqual(["https://127.0.0.1:27124", "https://192.168.1.100:27124"])
    })

    test("should parse semicolon-separated URLs as fallback", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_URLS = "https://127.0.0.1:27124;https://192.168.1.100:27124"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.urls).toEqual(["https://127.0.0.1:27124", "https://192.168.1.100:27124"])
    })

    test("should support legacy API_HOST + API_PORT format", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_HOST = "https://127.0.0.1"
      process.env.API_PORT = "27124"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.urls).toEqual(["https://127.0.0.1:27124"])
    })

    test("should default to localhost if no URLs provided", () => {
      process.env.API_KEY = "a".repeat(64)

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.urls).toEqual(["https://127.0.0.1:27124"])
    })

    test("should prioritize API_URLS over API_HOST + API_PORT", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_URLS = '["https://example.com:27124"]'
      process.env.API_HOST = "https://localhost"
      process.env.API_PORT = "9999"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.urls).toEqual(["https://example.com:27124"])
    })
  })

  describe("Transport Configuration", () => {
    test("should parse transport configuration from env", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "stdio,http"
      process.env.MCP_HTTP_PORT = "3000"
      process.env.MCP_HTTP_HOST = "0.0.0.0"
      process.env.MCP_HTTP_PATH = "/mcp"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.transports.stdio.enabled).toBe(true)
      expect(config.transports.http.enabled).toBe(true)
      expect(config.transports.http.port).toBe(3000)
      expect(config.transports.http.host).toBe("0.0.0.0")
      expect(config.transports.http.path).toBe("/mcp")
    })

    test("should default to stdio-only for backward compatibility", () => {
      process.env.API_KEY = "a".repeat(64)

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.transports.stdio.enabled).toBe(true)
      expect(config.transports.http.enabled).toBe(false)
    })

    test("should handle single transport in MCP_TRANSPORTS", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.transports.stdio.enabled).toBe(false)
      expect(config.transports.http.enabled).toBe(true)
    })

    test("should use default HTTP values when not specified", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.transports.http.enabled).toBe(true)
      expect(config.transports.http.port).toBe(3000)
      expect(config.transports.http.host).toBe("0.0.0.0")
      expect(config.transports.http.path).toBe("/mcp")
    })
  })

  describe("Self-Healing Configuration", () => {
    test("should parse self-healing configuration", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_URLS = '["https://127.0.0.1:27124", "https://192.168.1.100:27124"]'
      process.env.API_TEST_TIMEOUT = "2000"
      process.env.API_RETRY_INTERVAL = "30000"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.testTimeout).toBe(2000)
      expect(config.obsidian.retryInterval).toBe(30000)
    })

    test("should use default self-healing values when not specified", () => {
      process.env.API_KEY = "a".repeat(64)

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.testTimeout).toBe(2000)
      expect(config.obsidian.retryInterval).toBe(30000)
    })
  })

  describe("Backward Compatibility", () => {
    test("should maintain existing API_KEY behavior", () => {
      process.env.API_KEY = "a".repeat(64)

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.apiKey).toBe("a".repeat(64))
    })

    test("should maintain existing host/port/baseURL behavior for single URL", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_HOST = "https://127.0.0.1"
      process.env.API_PORT = "27124"

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.host).toBe("https://127.0.0.1")
      expect(config.obsidian.port).toBe(27124)
      expect(config.obsidian.baseURL).toBe("https://127.0.0.1:27124")
    })

    test("should derive baseURL from first URL when using API_URLS", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.API_URLS = '["https://example.com:27124", "https://backup.com:27124"]'

      const config = loadAppConfig()

      expect(config).toBeDefined()
      expect(config.obsidian.baseURL).toBe("https://example.com:27124")
    })
  })
})
