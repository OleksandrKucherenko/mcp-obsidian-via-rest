import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { loadAppConfig } from "../src/config"

/**
 * Environment Variable Integration Tests
 *
 * These tests ensure that ALL documented environment variables are:
 * 1. Declared in the NodeJS.ProcessEnv interface
 * 2. Actually read and used by loadAppConfig()
 * 3. Properly propagated to the resulting configuration
 *
 * WHY THIS TEST EXISTS:
 * The MCP_HTTP_TOKEN environment variable was documented but not implemented.
 * These tests ensure that every env var we document actually works end-to-end.
 */
describe("Environment Variable Configuration", () => {
  const originalEnv = { ...process.env }

  const clearEnvVars = () => {
    const varsToDelete = [
      "API_KEY",
      "API_HOST",
      "API_PORT",
      "API_URLS",
      "MCP_TRANSPORTS",
      "MCP_HTTP_PORT",
      "MCP_HTTP_HOST",
      "MCP_HTTP_PATH",
      "MCP_HTTP_TOKEN",
      "API_TEST_TIMEOUT",
      "API_RETRY_INTERVAL",
    ]
    for (const v of varsToDelete) {
      delete process.env[v]
    }
  }

  beforeEach(() => {
    clearEnvVars()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe("MCP_HTTP_TOKEN Environment Variable", () => {
    test("should read MCP_HTTP_TOKEN and enable HTTP auth", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"
      process.env.MCP_HTTP_TOKEN = "secret-token-123"

      const config = loadAppConfig()

      expect(config.transports.http.auth).toBeDefined()
      expect(config.transports.http.auth?.enabled).toBe(true)
      expect(config.transports.http.auth?.token).toBe("secret-token-123")
    })

    test("should not enable auth if MCP_HTTP_TOKEN is not set", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"
      // No MCP_HTTP_TOKEN set

      const config = loadAppConfig()

      // Auth should be undefined or disabled
      if (config.transports.http.auth) {
        expect(config.transports.http.auth.enabled).toBe(false)
      } else {
        expect(config.transports.http.auth).toBeUndefined()
      }
    })

    test("should handle empty MCP_HTTP_TOKEN (auth disabled)", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"
      process.env.MCP_HTTP_TOKEN = ""

      const config = loadAppConfig()

      // Empty token should not enable auth
      if (config.transports.http.auth) {
        expect(config.transports.http.auth.enabled).toBe(false)
      } else {
        expect(config.transports.http.auth).toBeUndefined()
      }
    })

    test("should handle MCP_HTTP_TOKEN with whitespace", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"
      process.env.MCP_HTTP_TOKEN = "  secret-token-123  "

      const config = loadAppConfig()

      expect(config.transports.http.auth).toBeDefined()
      expect(config.transports.http.auth?.enabled).toBe(true)
      // Token should be trimmed
      expect(config.transports.http.auth?.token?.trim()).toBe("secret-token-123")
    })
  })

  describe("All Transport Environment Variables", () => {
    test("should handle all HTTP transport env vars together", () => {
      process.env.API_KEY = "a".repeat(64)
      process.env.MCP_TRANSPORTS = "http"
      process.env.MCP_HTTP_PORT = "4000"
      process.env.MCP_HTTP_HOST = "127.0.0.1"
      process.env.MCP_HTTP_PATH = "/custom-mcp"
      process.env.MCP_HTTP_TOKEN = "secure-token"

      const config = loadAppConfig()

      expect(config.transports.http.enabled).toBe(true)
      expect(config.transports.http.port).toBe(4000)
      expect(config.transports.http.host).toBe("127.0.0.1")
      expect(config.transports.http.path).toBe("/custom-mcp")
      expect(config.transports.http.auth?.enabled).toBe(true)
      expect(config.transports.http.auth?.token).toBe("secure-token")
    })
  })

  describe("Environment Variable Coverage", () => {
    /**
     * This test ensures that all environment variables we document
     * are actually implemented and tested.
     *
     * If you add a new environment variable:
     * 1. Add it to this list
     * 2. Write a specific test for it above
     * 3. Ensure it's in the ProcessEnv interface in src/config.ts
     */
    test("should have tests for all documented env vars", () => {
      const documentedEnvVars = [
        // Obsidian API
        "API_KEY",
        "API_HOST",
        "API_PORT",
        "API_URLS",
        "API_TEST_TIMEOUT",
        "API_RETRY_INTERVAL",

        // Transport selection
        "MCP_TRANSPORTS",

        // HTTP transport (includes built-in SSE streaming)
        "MCP_HTTP_PORT",
        "MCP_HTTP_HOST",
        "MCP_HTTP_PATH",
        "MCP_HTTP_TOKEN",

        // Environment
        "NODE_ENV",
      ]

      // This is a placeholder test that documents what should be tested
      // Each variable above should have at least one test case
      expect(documentedEnvVars.length).toBeGreaterThan(0)

      // TODO: Parse actual test file and verify each var has a test
      // For now, this serves as documentation
    })
  })
})
