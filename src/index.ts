#!/usr/bin/env bun

import { debug } from "debug"
import fs from "node:fs/promises"

import PackageJson from "../package.json" assert { type: "json" }
import { SelfHealingObsidianAPI } from "./api/self-healing.js"
import { loadAppConfig } from "./config.js"
import { createMcpServer } from "./server/mcp-server.js"
import { TransportManager } from "./transports/manager.js"

const log = debug("mcp:server")

const HEALTH_FILE_PATH = "/tmp/mcp_healthy"
const HEALTH_INTERVAL_MS = 5_000 // 5 seconds

// Load application configuration (includes obsidian and transports config)
const appConfig = loadAppConfig()

// Create self-healing API (will select best URL on initialization)
const api = new SelfHealingObsidianAPI(appConfig.obsidian)

// Create MCP server with tools and resources
const server = createMcpServer(api)

// Create transport manager
let transportManager: TransportManager | null = null

// Health check for Docker container
let counter = 1 // print only one time
const timer = setInterval(() => {
  counter -= 1

  // create health file and then only update it last modification time
  ;(counter >= 0
    ? fs.writeFile(HEALTH_FILE_PATH, `${new Date().toISOString()}`, { flag: "w" })
    : fs.utimes(HEALTH_FILE_PATH, new Date(), new Date())
  )
    .then(() => {
      if (counter >= 0) log(`Heartbeat...`)
    })
    .catch((error) => {
      log(`Heartbeat failed: %O`, error)
    })
}, HEALTH_INTERVAL_MS)

// Initialize API (select best URL, start monitoring)
async function initialize() {
  try {
    // Initialize the self-healing API
    await api.initialize()

    const health = api.getHealth()
    log(`Obsidian API: %O`, health)

    // Create and start transports based on configuration
    transportManager = new TransportManager(appConfig.transports, server)
    await transportManager.startTransports()

    const transportStatus = transportManager.getStatus()
    log(`MCP Server: ${PackageJson.name} / ${PackageJson.version}`)
    log(`Transports: %O`, transportStatus)
  } catch (error) {
    log(`Initialization error: %O`, error)

    // Cleanup on error
    clearInterval(timer)
    if (transportManager) {
      await transportManager.stopTransports()
    }
    process.exit(1)
  }
}

// Handle graceful shutdown
async function shutdown() {
  log("Shutting down...")

  clearInterval(timer)

  if (transportManager) {
    await transportManager.stopTransports()
  }

  log("Shutdown complete")
  process.exit(0)
}

// Listen for shutdown signals
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
process.on("exit", () => {
  clearInterval(timer)
})

// Start the server
initialize()
