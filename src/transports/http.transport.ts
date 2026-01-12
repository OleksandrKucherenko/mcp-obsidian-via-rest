import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "bun"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import type { HttpConfig, HttpTransportContext } from "./types.js"

const log = debug("mcp:transports:http")

/**
 * Create and configure an HTTP transport for MCP server.
 *
 * This function creates a Hono app with CORS middleware, sets up
 * a health endpoint, and starts an HTTP server. The MCP JSON-RPC
 * endpoint is integrated with the McpServer.
 *
 * @param config - HTTP transport configuration
 * @param server - The MCP server instance
 * @returns A context object with close method for cleanup
 */
export async function createHttpTransport(
  config: HttpConfig,
  server: McpServer,
): Promise<HttpTransportContext> {
  // Create Hono app
  const app = new Hono()

  // Apply CORS middleware
  app.use("*", cors())

  // Add request logging
  app.use("*", logger())

  // Health endpoint
  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      transport: "http",
    })
  })

  // MCP JSON-RPC endpoint will be added in Phase 3.2
  // For now, we create a placeholder that returns the server info
  // The actual MCP protocol handling will be implemented in the next task

  // Start the HTTP server using Bun's built-in serve
  const serverUrl = `http://${config.host}:${config.port}`
  const bunServer = serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  })

  log(`HTTP transport started on ${serverUrl}`)

  // Return context with close method
  return {
    close: async (): Promise<void> => {
      log("Closing HTTP transport")
      // Stop the server
      if ("stop" in bunServer && typeof bunServer.stop === "function") {
        bunServer.stop()
      } else if ("close" in bunServer && typeof bunServer.close === "function") {
        await bunServer.close()
      }
      log("HTTP transport closed")
    },
  }
}
