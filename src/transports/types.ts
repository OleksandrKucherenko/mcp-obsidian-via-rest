import { z } from "zod/v4"

/** Transport lifecycle context. */
export interface TransportContext {
  /** Close the transport and cleanup resources. */
  close(): Promise<void>
}

/** Stdio transport-specific context. */
export interface StdioTransportContext extends TransportContext {}

/** HTTP transport-specific context. */
export interface HttpTransportContext extends TransportContext {}

/** SSE transport-specific context. */
export interface SseTransportContext extends TransportContext {}

/** Authentication configuration for transports. */
export interface AuthConfig {
  /** Enable authentication for this transport. */
  enabled: boolean
  /** Bearer token for authentication. */
  token?: string
  /** Environment variable name containing the token. */
  tokenEnvVar?: string
}

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
  /** Authentication configuration. */
  auth?: AuthConfig
}

/** SSE transport configuration. */
export interface SseConfig {
  enabled: boolean
  path: string
  /** Authentication configuration. */
  auth?: AuthConfig
}

/** Complete transport configuration. */
export interface TransportConfig {
  stdio: StdioConfig
  http: HttpConfig
  sse: SseConfig
}

/** Zod validation schemas for transport configuration. */
export namespace Schema {
  /** Authentication configuration schema. */
  export const authConfig = z
    .object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      tokenEnvVar: z.string().optional(),
    })
    .strict()

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
      auth: authConfig.optional(),
    })
    .strict()

  /** SSE transport schema. */
  export const sseConfig = z
    .object({
      enabled: z.boolean(),
      path: z.string().default("/sse"),
      auth: authConfig.optional(),
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
