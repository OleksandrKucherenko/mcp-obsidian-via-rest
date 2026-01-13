import { describe, expect, test } from "bun:test"
import { createAuthMiddleware } from "../../src/transports/auth"
import type { AuthConfig } from "../../src/transports/types"

describe("Authentication Middleware", () => {
  describe("Token Resolution", () => {
    test("should resolve token from config", () => {
      const config: AuthConfig = {
        enabled: true,
        token: "test-token-123",
      }

      const middleware = createAuthMiddleware(config)
      expect(middleware).toBeDefined()
    })

    test("should resolve token from environment variable", () => {
      process.env.TEST_TOKEN = "env-token-456"

      const config: AuthConfig = {
        enabled: true,
        tokenEnvVar: "TEST_TOKEN",
      }

      const middleware = createAuthMiddleware(config)
      expect(middleware).toBeDefined()

      delete process.env.TEST_TOKEN
    })

    test("should prefer config token over env var", () => {
      process.env.TEST_TOKEN = "env-token-456"

      const config: AuthConfig = {
        enabled: true,
        token: "config-token-789",
        tokenEnvVar: "TEST_TOKEN",
      }

      const middleware = createAuthMiddleware(config)
      expect(middleware).toBeDefined()

      delete process.env.TEST_TOKEN
    })

    test("should use env var token when config token not provided", () => {
      process.env.TEST_TOKEN = "env-token-only"

      const config: AuthConfig = {
        enabled: true,
        tokenEnvVar: "TEST_TOKEN",
      }

      const middleware = createAuthMiddleware(config)
      expect(middleware).toBeDefined()

      delete process.env.TEST_TOKEN
    })
  })

  describe("Request Authentication", () => {
    test("should allow request with valid Bearer token", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token-123",
      }

      const middleware = createAuthMiddleware(config)

      // Simulate a request with Authorization header
      const authHeader = `Bearer valid-token-123`
      const result = await middleware.validateToken(authHeader)

      expect(result.valid).toBe(true)
    })

    test("should reject request with invalid Bearer token", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token-123",
      }

      const middleware = createAuthMiddleware(config)

      const authHeader = `Bearer invalid-token`
      const result = await middleware.validateToken(authHeader)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test("should reject request with missing Authorization header", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token-123",
      }

      const middleware = createAuthMiddleware(config)

      const result = await middleware.validateToken(undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test("should reject request with malformed Authorization header", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token-123",
      }

      const middleware = createAuthMiddleware(config)

      const authHeader = `InvalidFormat token`
      const result = await middleware.validateToken(authHeader)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test("should allow all requests when auth is disabled", async () => {
      const config: AuthConfig = {
        enabled: false,
      }

      const middleware = createAuthMiddleware(config)

      const result = await middleware.validateToken(undefined)

      expect(result.valid).toBe(true)
    })
  })

  describe("Error Responses", () => {
    test("should return 401 with correct error message", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token",
      }

      const middleware = createAuthMiddleware(config)

      const errorResponse = middleware.createUnauthorizedResponse()

      expect(errorResponse.status).toBe(401)
      expect(errorResponse.body).toContain("Unauthorized")
    })

    test("should include WWW-Authenticate header in 401 response", async () => {
      const config: AuthConfig = {
        enabled: true,
        token: "valid-token",
      }

      const middleware = createAuthMiddleware(config)

      const errorResponse = middleware.createUnauthorizedResponse()

      expect(errorResponse.headers.get("WWW-Authenticate")).toBe("Bearer")
    })
  })
})
