import { debug } from "debug"
import { config } from "dotenv"
import { expand } from "dotenv-expand"
import findConfig from "find-config"
import JSON5 from "json5"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod/v4"

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string
    API_HOST: string
    API_PORT: string
    NODE_ENV: string
  }
}

const NODE_ENV = process.env.NODE_ENV ?? "development"
const CWD = process.cwd()
const ROOT = (findConfig(".env", { cwd: CWD }) ?? "").replace(/\.env$/, "")
const DEFAULTS = "configs/config.default.jsonc"
const isTest = NODE_ENV !== "test"

const logger = debug("mcp:config")

export const schema = z.object({
  apiKey: z.string(),
  host: z.string(),
  port: z.number(),
})

export const schemaEnv = z.object({
  API_KEY: z.string(),
  API_HOST: z.string(),
  API_PORT: z.string(),
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
  if (files.length === 0) logger("No .env* environment files found")

  for (const path of files) {
    const parsed = expand(config({ path }))
    logger("loaded : %o %o", path, Object.keys(parsed?.parsed ?? {}))
  }

  return files
}

export const loadConfiguration = (configFilePath?: string) => {
  loadEnvironment()

  // load config first
  const configFile = configFilePath && existsSync(configFilePath) ? configFilePath : DEFAULTS
  logger(`Loading config from ${configFile}`)

  const configContent = readFileSync(configFile, "utf-8")
  const config = schema.parse(JSON5.parse(configContent))

  const parsed = {
    API_KEY: process.env.API_KEY ?? config.apiKey,
    API_HOST: process.env.API_HOST ?? config.host,
    API_PORT: process.env.API_PORT ?? `${config.port}`,
  }

  const { parsed: resolved } = expand({ parsed })
  const configEnv = schemaEnv.parse(resolved)

  logger(`Parsed config: %o`, configEnv)

  // try to validate the apiKey from config, for matching pattern /^[a-zA-Z0-9]{32,}$/
  // default key size from Obsidian Local REST API plugin is 64 characters
  if (!/^[a-zA-Z0-9]{32,}$/.test(configEnv.API_KEY)) {
    logger("Invalid API key, expected at least 32 characters")
  }

  logger("server: %s:%d", config.host, config.port)

  return {
    apiKey: configEnv.API_KEY,
    host: configEnv.API_HOST,
    port: Number.parseInt(configEnv.API_PORT, 10),
  }
}
