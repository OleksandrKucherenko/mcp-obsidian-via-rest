import { describe, expect, test } from "bun:test"
import { z } from "zod"
import {
  type StdioConfig,
  type HttpConfig,
  type SseConfig,
  type TransportConfig,
  type TransportContext,
  Schema,
} from "../../src/transports/types"

describe("Transport Interfaces", () => {
  describe("Type Definitions", () => {
    test("should define TransportContext with close method", () => {
      const context: TransportContext = {
        close: async () => {},
      }

      expect(context.close).toBeInstanceOf(Function)
    })

    test("should type-check StdioConfig structure", () => {
      const config: StdioConfig = {
        enabled: true,
      }

      expect(config.enabled).toBe(true)
    })

    test("should type-check HttpConfig structure", () => {
      const config: HttpConfig = {
        enabled: true,
        port: 3000,
        host: "0.0.0.0",
        path: "/mcp",
      }

      expect(config.port).toBe(3000)
      expect(config.host).toBe("0.0.0.0")
      expect(config.path).toBe("/mcp")
    })

    test("should type-check SseConfig structure", () => {
      const config: SseConfig = {
        enabled: true,
        path: "/sse",
      }

      expect(config.path).toBe("/sse")
    })

    test("should type-check TransportConfig structure", () => {
      const config: TransportConfig = {
        stdio: { enabled: true },
        http: { enabled: false, port: 3000, host: "0.0.0.0", path: "/mcp" },
        sse: { enabled: false, path: "/sse" },
      }

      expect(config.stdio.enabled).toBe(true)
      expect(config.http.enabled).toBe(false)
      expect(config.sse.enabled).toBe(false)
    })
  })

  describe("Zod Validation Schemas", () => {
    describe("stdioConfig schema", () => {
      const schema = Schema.stdioConfig

      test("should validate valid stdio config", () => {
        const result = schema.safeParse({ enabled: true })
        expect(result.success).toBe(true)
      })

      test("should require enabled boolean field", () => {
        const result = schema.safeParse({})
        expect(result.success).toBe(false)
      })

      test("should reject non-boolean enabled", () => {
        const result = schema.safeParse({ enabled: "true" })
        expect(result.success).toBe(false)
      })
    })

    describe("httpConfig schema", () => {
      const schema = Schema.httpConfig

      test("should validate valid http config", () => {
        const result = schema.safeParse({
          enabled: true,
          port: 3000,
          host: "0.0.0.0",
          path: "/mcp",
        })
        expect(result.success).toBe(true)
      })

      test("should apply defaults for optional fields", () => {
        const result = schema.safeParse({ enabled: true })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.port).toBe(3000)
          expect(result.data.host).toBe("0.0.0.0")
          expect(result.data.path).toBe("/mcp")
        }
      })

      test("should reject invalid port number", () => {
        const result = schema.safeParse({
          enabled: true,
          port: -1,
          host: "0.0.0.0",
          path: "/mcp",
        })
        expect(result.success).toBe(false)
      })

      test("should reject port of 0", () => {
        const result = schema.safeParse({
          enabled: true,
          port: 0,
          host: "0.0.0.0",
          path: "/mcp",
        })
        expect(result.success).toBe(false)
      })
    })

    describe("sseConfig schema", () => {
      const schema = Schema.sseConfig

      test("should validate valid sse config", () => {
        const result = schema.safeParse({
          enabled: true,
          path: "/sse",
        })
        expect(result.success).toBe(true)
      })

      test("should apply default for path", () => {
        const result = schema.safeParse({ enabled: true })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.path).toBe("/sse")
        }
      })
    })

    describe("transports schema", () => {
      const schema = Schema.transports

      test("should validate complete transport config", () => {
        const result = schema.safeParse({
          stdio: { enabled: true },
          http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" },
          sse: { enabled: true, path: "/sse" },
        })
        expect(result.success).toBe(true)
      })

      test("should apply all defaults correctly", () => {
        const result = schema.safeParse({
          stdio: { enabled: false },
          http: { enabled: false },
          sse: { enabled: false },
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.http.port).toBe(3000)
          expect(result.data.http.host).toBe("0.0.0.0")
          expect(result.data.http.path).toBe("/mcp")
          expect(result.data.sse.path).toBe("/sse")
        }
      })
    })
  })
})
