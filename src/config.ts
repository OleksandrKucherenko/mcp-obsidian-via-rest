import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { debug } from "debug"
import { config } from "dotenv"
import { expand } from "dotenv-expand"
import findConfig from "find-config"
import JSON5 from "json5"
import { z } from "zod/v4"
import type { ObsidianConfig } from "./client/types"
import type { AppConfig, ObsidianAPI as ObsidianAPIConfig, Transport } from "./config.types"

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string
    API_HOST: string
    API_PORT: string
    API_URLS: string
    MCP_TRANSPORTS: string
    MCP_HTTP_PORT: string
    MCP_HTTP_HOST: string
    MCP_HTTP_PATH: string
    MCP_SSE_PATH: string
    API_TEST_TIMEOUT: string
    API_RETRY_INTERVAL: string
    NODE_ENV: string
  }
}

const NODE_ENV = process.env.NODE_ENV ?? "development"
const CWD = process.cwd()
const ROOT = (findConfig(".env", { cwd: CWD }) ?? "").replace(/\.env$/, "")
const DEFAULTS = "configs/config.default.jsonc"
const JSON_CONFIG = `{ "apiKey": "${process.env.API_KEY}", "host": "https://127.0.0.1", "port": 27124 }`
const isTest = NODE_ENV !== "test"

const log = debug("mcp:config")

export const schema = z.object({
  apiKey: z.string(),
  host: z.string(),
  port: z.number(),
})

export const schemaEnv = z.object({
  API_KEY: z.string(),
  API_HOST: z.string(),
  API_PORT: z.string(),
  API_URLS: z.string().optional(),
})

/** Get list of environment files for loading. */
export const environmentFiles = (cwd?: string): string[] => {
  const files = [
    `.env.${NODE_ENV}.local`,
    isTest && ".env.local" /* NOTE (olku): do not load local for TEST executions. */,
    `.env.${NODE_ENV}`,
    ".env",
  ].filter(Boolean) as string[]

  return files
    .map((file) => path.resolve(cwd ?? ROOT ?? CWD, file)) // resolve path
    .filter((path) => existsSync(path)) // filter existing files
}

/** Load environment files.
 * @param cwd - current working directory for .env file search. */
export const loadEnvironment = (cwd?: string) => {
  const files = environmentFiles(cwd)
  if (files.length === 0) log("No .env* environment files found")

  for (const path of files) {
    const parsed = expand(config({ path }))
    log("loaded : %o %o", path, Object.keys(parsed?.parsed ?? {}))
  }

  return files
}

export const composeBaseURL = (host: string, port: number): string => {
  const hasProtocol = host.includes("https://") || host.includes("http://")
  const hasPort = /:\d+$/.test(host)

  let baseURL = host
  if (!hasPort) baseURL += `:${port}`
  if (!hasProtocol) baseURL = `http://${baseURL}`

  return baseURL
}

/**
 * Parse URLs from API_URLS environment variable.
 * Supports JSON array format: `["url1", "url2"]`
 * Fallback to semicolon-separated: `url1;url2`
 */
export const parseUrls = (urlsEnv?: string): string[] => {
  if (!urlsEnv) {
    return []
  }

  // Try JSON array format first
  if (urlsEnv.trim().startsWith("[")) {
    try {
      return JSON5.parse(urlsEnv) as string[]
    } catch {
      // If JSON parsing fails, fall through to semicolon parsing
    }
  }

  // Fallback to semicolon-separated format
  return urlsEnv
    .split(";")
    .map((url) => url.trim())
    .filter(Boolean)
}

/**
 * Parse transport configuration from MCP_TRANSPORTS environment variable.
 * Format: comma-separated list of transport names (e.g., "stdio,http,sse")
 */
export const parseTransports = (transportsEnv?: string): Set<string> => {
  // Handle undefined, null, empty string, and string "undefined"
  if (!transportsEnv || transportsEnv === "undefined" || transportsEnv === "null") {
    return new Set(["stdio"]) // Default to stdio for backward compatibility
  }

  const enabled = transportsEnv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  return new Set(enabled.length > 0 ? enabled : ["stdio"])
}

/**
 * Create transport configuration based on enabled transports.
 */
export const createTransportConfig = (enabledTransports: Set<string>, env: NodeJS.ProcessEnv): Transport.Config => {
  const hasTransport = (name: string) => enabledTransports.has(name)

  return {
    stdio: {
      enabled: hasTransport("stdio"),
    },
    http: {
      enabled: hasTransport("http"),
      port: Number.parseInt(env.MCP_HTTP_PORT ?? "3000", 10),
      host: env.MCP_HTTP_HOST ?? "0.0.0.0",
      path: env.MCP_HTTP_PATH ?? "/mcp",
    },
    sse: {
      enabled: hasTransport("sse"),
      path: env.MCP_SSE_PATH ?? "/sse",
    },
  }
}

/**
 * Load application configuration with support for multi-URL and transport configuration.
 * @returns Complete application configuration
 */
export const loadAppConfig = (configFilePath?: string): AppConfig => {
  loadEnvironment()

  // Load config file first
  const configFile = configFilePath && existsSync(configFilePath) ? configFilePath : DEFAULTS
  log(`Loading config: %o`, configFile)

  // Load default config or fallback to hardcoded configuration
  const configContent = existsSync(configFile) ? readFileSync(configFile, "utf-8") : JSON_CONFIG
  const config = schema.parse(JSON5.parse(configContent))
  log("Default config: %o", config)

  const parsed = {
    API_KEY: process.env.API_KEY ?? config.apiKey,
    API_HOST: process.env.API_HOST ?? config.host,
    API_PORT: process.env.API_PORT ?? `${config.port}`,
    API_URLS: process.env.API_URLS,
  }

  // Guard against undefined values for dotenv-expand
  const safeParsed = Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v !== undefined))

  const { parsed: resolved } = expand({ parsed: safeParsed })
  const configEnv = schemaEnv.parse(resolved)

  log(`Expands config: %o`, configEnv)

  // Validate API key (minimum 32 characters)
  if (!/^[a-zA-Z0-9]{32,}$/.test(configEnv.API_KEY)) {
    log("Invalid API key, expected at least 32 characters")
  }

  const apiKey = configEnv.API_KEY
  const apiUrls = parseUrls(configEnv.API_URLS)
  const apiHost = configEnv.API_HOST
  const apiPort = Number.parseInt(configEnv.API_PORT, 10)

  // Determine URLs: use API_URLS if provided, otherwise construct from API_HOST + API_PORT
  let urls: string[]
  let baseURL: string
  let host: string
  let port: number

  if (apiUrls.length > 0) {
    // Use API_URLS
    urls = apiUrls
    baseURL = urls[0] // Use first URL as primary
    // Extract host and port from first URL for backward compatibility
    const url = new URL(baseURL)
    host = `${url.protocol}//${url.hostname}`
    port = Number.parseInt(url.port, 10) || (url.protocol === "https:" ? 443 : 80)
  } else {
    // Use legacy API_HOST + API_PORT format
    host = apiHost
    port = apiPort
    baseURL = composeBaseURL(host, port)
    urls = [baseURL]
  }

  // Transport configuration
  const enabledTransports = parseTransports(process.env.MCP_TRANSPORTS)
  const transports = createTransportConfig(enabledTransports, process.env)

  // Self-healing configuration
  const testTimeout = Number.parseInt(process.env.API_TEST_TIMEOUT ?? "2000", 10)
  const retryInterval = Number.parseInt(process.env.API_RETRY_INTERVAL ?? "30000", 10)

  const obsidianConfig: ObsidianAPIConfig.Config = {
    urls,
    apiKey,
    host,
    port,
    baseURL,
    testTimeout,
    retryInterval,
  }

  const appConfig: AppConfig = {
    obsidian: obsidianConfig,
    transports,
  }

  log("Runtime config: %o", {
    apiKey: `${apiKey.substring(0, 8)}...`,
    urls,
    transports: {
      stdio: transports.stdio.enabled,
      http: transports.http.enabled,
      sse: transports.sse.enabled,
    },
    testTimeout,
    retryInterval,
  })

  return appConfig
}

/**
 * Load legacy Obsidian configuration for backward compatibility.
 * @returns Obsidian configuration
 */
export const loadConfiguration = (configFilePath?: string): ObsidianConfig => {
  const appConfig = loadAppConfig(configFilePath)
  const { obsidian } = appConfig

  return {
    apiKey: obsidian.apiKey,
    host: obsidian.host,
    port: obsidian.port,
    baseURL: obsidian.baseURL,
  }
}

export const diagnostics = async () => {
  const excludes = ["key", "pass", "secret", "token"]
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !excludes.some((e) => k.toLowerCase().includes(e))),
  )

  log("Node.js version: %s", process.version)
  log("Bun version: %s", globalThis.Bun?.version ?? "N/A")
  log("process.argv: %O", process.argv)
  log("process.cwd: %s", process.cwd())
  log("process.getuid: %s", typeof process.getuid === "function" ? process.getuid() : "N/A")
  log("process.getgid: %s", typeof process.getgid === "function" ? process.getgid() : "N/A")
  log("process.env (partial): %O", env)
  log("stdin isTTY: %s", process.stdin.isTTY ?? "N/A")
  log("stdout isTTY: %s", process.stdout.isTTY ?? "N/A")
  log("stderr isTTY: %s", process.stderr.isTTY ?? "N/A")
  log("stdin readable: %s", process.stdin.readable)
  log("stdout writable: %s", process.stdout.writable)
  log("stderr writable: %s", process.stderr.writable)
  log("stdin paused: %s", process.stdin.isPaused?.() ?? "unknown")
}
