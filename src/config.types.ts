import { z } from "zod/v4"

/** Transport configuration interfaces. */
export namespace Transport {
  /** Authentication configuration for transports. */
  export interface AuthConfig {
    enabled: boolean
    token?: string
  }

  /** Stdio transport configuration. */
  export interface StdioConfig {
    enabled: boolean
  }

  /** HTTP transport configuration.
   *
   * Note: HTTP transport includes built-in SSE streaming via
   * WebStandardStreamableHTTPServerTransport. The transport automatically
   * handles both HTTP POST (JSON-RPC) and HTTP GET (SSE) on the same endpoint.
   */
  export interface HttpConfig {
    enabled: boolean
    port: number
    host: string
    path: string
    auth?: AuthConfig
  }

  /** All transport configurations. */
  export interface Config {
    stdio: StdioConfig
    http: HttpConfig
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
  /** Authentication configuration schema. */
  export const authConfig = z
    .object({
      enabled: z.boolean(),
      token: z.string().optional(),
    })
    .strict()

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
    auth: authConfig.optional(),
  })

  /** Transports schema. */
  export const transports = z.object({
    stdio: stdioConfig,
    http: httpConfig,
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
