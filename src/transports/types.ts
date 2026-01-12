import { z } from "zod/v4"

/** Transport lifecycle context. */
export interface TransportContext {
  /** Close the transport and cleanup resources. */
  close(): Promise<void>
}

/** Stdio transport-specific context. */
export interface StdioTransportContext extends TransportContext {}

/** Stdio transport configuration. */
export interface StdioConfig {
  enabled: boolean
}

/** HTTP transport configuration. */
export interface HttpConfig {
  enabled: boolean
  port: number
  host: string
  path: string
}

/** SSE transport configuration. */
export interface SseConfig {
  enabled: boolean
  path: string
}

/** Complete transport configuration. */
export interface TransportConfig {
  stdio: StdioConfig
  http: HttpConfig
  sse: SseConfig
}

/** Zod validation schemas for transport configuration. */
export namespace Schema {
  /** Stdio transport schema. */
  export const stdioConfig = z.object({
    enabled: z.boolean(),
  })

  /** HTTP transport schema. */
  export const httpConfig = z
    .object({
      enabled: z.boolean(),
      port: z.number().int().positive().default(3000),
      host: z.string().default("0.0.0.0"),
      path: z.string().default("/mcp"),
    })
    .strict()

  /** SSE transport schema. */
  export const sseConfig = z
    .object({
      enabled: z.boolean(),
      path: z.string().default("/sse"),
    })
    .strict()

  /** Complete transports schema. */
  export const transports = z
    .object({
      stdio: stdioConfig,
      http: httpConfig,
      sse: sseConfig,
    })
    .strict()
}
