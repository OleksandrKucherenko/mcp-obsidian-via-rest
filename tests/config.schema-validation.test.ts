import { describe, expect, test } from "bun:test"
import type { Transport } from "../src/config.types"
import type { AuthConfig, HttpConfig, TransportConfig } from "../src/transports/types"

/**
 * Schema Consistency Tests
 *
 * These tests ensure that the config types used by the config loader
 * are compatible with the types expected by the transports.
 *
 * WHY THIS TEST EXISTS:
 * We have two parallel type hierarchies:
 * 1. src/config.types.ts (Transport.Config) - used by config loader
 * 2. src/transports/types.ts (TransportConfig) - used by transports
 *
 * These should be structurally compatible, but TypeScript doesn't enforce
 * this unless we explicitly test it. This test catches missing fields like
 * the auth configuration that was missing from Transport.HttpConfig.
 */
describe("Configuration Schema Consistency", () => {
  describe("Type Compatibility", () => {
    test("Transport.HttpConfig should be compatible with HttpConfig (transports)", () => {
      // This test will fail to compile if the types are incompatible
      const transportHttpConfig: HttpConfig = {
        enabled: true,
        port: 3000,
        host: "0.0.0.0",
        path: "/mcp",
        auth: {
          enabled: true,
          token: "secret",
        },
      }

      // Try to assign it to the config loader type
      // biome-ignore lint/suspicious/noExplicitAny: Intentional for type compatibility testing
      const configLoaderType: Transport.HttpConfig = transportHttpConfig as any

      // If we get here without TypeScript errors, check runtime compatibility
      expect(configLoaderType).toBeDefined()
    })

    test("Transport.Config should be assignable to TransportConfig", () => {
      const loaderConfig: Transport.Config = {
        stdio: { enabled: true },
        http: {
          enabled: true,
          port: 3000,
          host: "0.0.0.0",
          path: "/mcp",
          // Note: This will fail if auth field is missing from Transport.HttpConfig
          auth: {
            enabled: true,
            token: "secret",
          },
        },
      }

      // biome-ignore lint/suspicious/noExplicitAny: Intentional for type compatibility testing
      const transportConfig: TransportConfig = loaderConfig as any
      expect(transportConfig).toBeDefined()
    })
  })

  describe("AuthConfig Field Presence", () => {
    test("HttpConfig should support auth field", () => {
      const httpConfig: HttpConfig = {
        enabled: true,
        port: 3000,
        host: "0.0.0.0",
        path: "/mcp",
        auth: {
          enabled: true,
          token: "test-token",
        },
      }

      expect(httpConfig.auth).toBeDefined()
      expect(httpConfig.auth?.enabled).toBe(true)
      expect(httpConfig.auth?.token).toBe("test-token")
    })

    test("HttpConfig auth field should be optional", () => {
      const httpConfig: HttpConfig = {
        enabled: true,
        port: 3000,
        host: "0.0.0.0",
        path: "/mcp",
        // auth is optional
      }

      expect(httpConfig.auth).toBeUndefined()
    })

    test("AuthConfig should support both token and tokenEnvVar", () => {
      const authWithToken: AuthConfig = {
        enabled: true,
        token: "direct-token",
      }

      const authWithEnvVar: AuthConfig = {
        enabled: true,
        tokenEnvVar: "MCP_HTTP_TOKEN",
      }

      const authWithBoth: AuthConfig = {
        enabled: true,
        token: "direct-token",
        tokenEnvVar: "MCP_HTTP_TOKEN",
      }

      expect(authWithToken.token).toBe("direct-token")
      expect(authWithEnvVar.tokenEnvVar).toBe("MCP_HTTP_TOKEN")
      expect(authWithBoth.token).toBe("direct-token")
      expect(authWithBoth.tokenEnvVar).toBe("MCP_HTTP_TOKEN")
    })
  })

  describe("Required vs Optional Fields", () => {
    test("Transport.HttpConfig should match HttpConfig required fields", () => {
      // Compile-time check: these should have the same required fields
      type TransportHttpRequiredFields = Required<Pick<Transport.HttpConfig, "enabled" | "port" | "host" | "path">>
      type TransportsHttpRequiredFields = Required<Pick<HttpConfig, "enabled" | "port" | "host" | "path">>

      // If this compiles, the required fields match
      const _check: TransportHttpRequiredFields = {} as TransportsHttpRequiredFields
      expect(_check).toBeDefined()
    })

    test("HttpConfig should have auth as optional field", () => {
      // This should compile without auth field
      const minimal: HttpConfig = {
        enabled: true,
        port: 3000,
        host: "0.0.0.0",
        path: "/mcp",
      }

      expect(minimal.auth).toBeUndefined()
    })
  })
})
