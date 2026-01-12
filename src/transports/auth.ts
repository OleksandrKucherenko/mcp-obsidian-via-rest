import { debug } from "debug"
import type { MiddlewareHandler } from "hono"

import type { AuthConfig } from "./types.js"

const log = debug("mcp:transports:auth")

/**
 * Result of token validation.
 */
export interface AuthResult {
  /** Whether the token is valid. */
  valid: boolean
  /** Error message if validation failed. */
  error?: string
}

/**
 * HTTP response for unauthorized requests.
 */
export interface UnauthorizedResponse {
  /** HTTP status code. */
  status: number
  /** Response headers. */
  headers: Map<string, string>
  /** Response body. */
  body: string
}

/**
 * Authentication middleware for protecting HTTP and SSE transports.
 *
 * This middleware validates Bearer tokens from the Authorization header
 * against a configured token or environment variable.
 */
export class AuthMiddleware {
  private config: AuthConfig
  private resolvedToken: string | null = null

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * Resolve the authentication token from config or environment variable.
   * @returns The resolved token or null if not found
   */
  resolveToken(): string | null {
    // If already resolved, return cached value
    if (this.resolvedToken !== null) {
      return this.resolvedToken
    }

    // Priority 1: Use token from config
    if (this.config.token) {
      this.resolvedToken = this.config.token
      return this.resolvedToken
    }

    // Priority 2: Use token from environment variable
    if (this.config.tokenEnvVar) {
      const envToken = process.env[this.config.tokenEnvVar]
      if (envToken) {
        this.resolvedToken = envToken
        return this.resolvedToken
      }
    }

    log("No authentication token configured")
    return null
  }

  /**
   * Validate a Bearer token from the Authorization header.
   *
   * @param authHeader - The Authorization header value
   * @returns Validation result
   */
  async validateToken(authHeader: string | undefined | null): Promise<AuthResult> {
    // If auth is disabled, allow all requests
    if (!this.config.enabled) {
      return { valid: true }
    }

    // Check if Authorization header is present
    if (!authHeader) {
      log("Missing Authorization header")
      return {
        valid: false,
        error: "Missing Authorization header",
      }
    }

    // Parse Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      log("Invalid Authorization header format (expected 'Bearer <token>')")
      return {
        valid: false,
        error: "Invalid authorization header format. Expected: Bearer <token>",
      }
    }

    const token = authHeader.slice(7) // Remove "Bearer " prefix

    // Resolve expected token
    const expectedToken = this.resolveToken()
    if (!expectedToken) {
      log("No authentication token configured")
      return {
        valid: false,
        error: "Authentication not configured properly",
      }
    }

    // Compare tokens
    if (token === expectedToken) {
      log("Authentication successful")
      return { valid: true }
    }

    log("Authentication failed: invalid token")
    return {
      valid: false,
      error: "Invalid authentication token",
    }
  }

  /**
   * Create a standardized unauthorized response.
   *
   * @returns Response object with status, headers, and body
   */
  createUnauthorizedResponse(): UnauthorizedResponse {
    const headers = new Map<string, string>()
    headers.set("WWW-Authenticate", "Bearer")
    headers.set("Content-Type", "application/json")

    return {
      status: 401,
      headers,
      body: JSON.stringify({
        error: "Unauthorized",
        message: "Valid Bearer token required",
      }),
    }
  }
}

/**
 * Factory function to create an authentication middleware.
 *
 * @param config - Authentication configuration
 * @returns AuthMiddleware instance
 */
export function createAuthMiddleware(config: AuthConfig): AuthMiddleware {
  return new AuthMiddleware(config)
}

/**
 * Hono middleware function for authentication.
 *
 * This function creates a Hono middleware that validates Bearer tokens
 * on protected endpoints.
 *
 * @param config - Authentication configuration
 * @returns Hono middleware function
 */
export function createAuthMiddlewareFunction(config: AuthConfig): MiddlewareHandler {
  const auth = new AuthMiddleware(config)

  return async (c, next) => {
    // If auth is disabled, skip validation
    if (!config.enabled) {
      return next()
    }

    // Get Authorization header
    const authHeader = c.req.header("Authorization")

    // Validate token
    const result = await auth.validateToken(authHeader)

    if (!result.valid) {
      const errorResponse = auth.createUnauthorizedResponse()

      // Set headers
      for (const [key, value] of errorResponse.headers.entries()) {
        c.header(key, value)
      }

      return c.json(JSON.parse(errorResponse.body), 401)
    }

    // Token is valid, proceed to next handler
    return next()
  }
}
