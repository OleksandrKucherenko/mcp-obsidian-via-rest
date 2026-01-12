import { z } from "zod/v4"

/** Transport configuration interfaces. */
export namespace Transport {
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

  /** All transport configurations. */
  export interface Config {
    stdio: StdioConfig
    http: HttpConfig
    sse: SseConfig
  }
}

/** Obsidian API configuration with self-healing support. */
export namespace ObsidianAPI {
  /** Configuration for Obsidian API connection. */
  export interface Config {
    urls: string[]
    apiKey: string
    host: string
    port: number
    baseURL: string
    testTimeout: number
    retryInterval: number
  }
}

/** Complete application configuration. */
export interface AppConfig {
  obsidian: ObsidianAPI.Config
  transports: Transport.Config
}

/** Zod schemas for validation. */
export namespace Schema {
  /** Stdio transport schema. */
  export const stdioConfig = z.object({
    enabled: z.boolean(),
  })

  /** HTTP transport schema. */
  export const httpConfig = z.object({
    enabled: z.boolean(),
    port: z.number().int().positive().default(3000),
    host: z.string().default("0.0.0.0"),
    path: z.string().default("/mcp"),
  })

  /** SSE transport schema. */
  export const sseConfig = z.object({
    enabled: z.boolean(),
    path: z.string().default("/sse"),
  })

  /** Transports schema. */
  export const transports = z.object({
    stdio: stdioConfig,
    http: httpConfig,
    sse: sseConfig,
  })

  /** Obsidian API configuration schema. */
  export const obsidianApi = z.object({
    urls: z.array(z.string().url()),
    apiKey: z.string().min(32),
    host: z.string(),
    port: z.number().int().positive(),
    baseURL: z.string().url(),
    testTimeout: z.number().int().positive().default(2000),
    retryInterval: z.number().int().positive().default(30000),
  })

  /** Complete app configuration schema. */
  export const appConfig = z.object({
    obsidian: obsidianApi,
    transports: transports,
  })
}
