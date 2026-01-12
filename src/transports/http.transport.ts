import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "bun"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { randomUUID } from "node:crypto"
import { debug } from "debug"

import { createAuthMiddlewareFunction } from "./auth.js"
import { createRequestLogger } from "./hono-logger.js"
import type { HttpConfig, HttpTransportContext } from "./types.js"

const log = debug("mcp:transports:http")

/**
 * Create and configure an HTTP transport for MCP server.
 *
 * This function creates a Hono app with CORS middleware, sets up
 * a health endpoint, and integrates the MCP server using
 * WebStandardStreamableHTTPServerTransport for full MCP protocol support.
 *
 * Authentication:
 * - If config.auth.enabled is true, the MCP endpoint requires a valid Bearer token
 * - The token can be provided via config.auth.token or config.auth.tokenEnvVar
 * - The health endpoint is not protected by authentication
 *
 * The transport supports:
 * - MCP JSON-RPC protocol over HTTP POST
 * - Server-Sent Events (SSE) for streaming responses
 * - Session management with unique session IDs
 *
 * @param config - HTTP transport configuration
 * @param server - The MCP server instance
 * @returns A context object with close method for cleanup
 */
export async function createHttpTransport(config: HttpConfig, server: McpServer): Promise<HttpTransportContext> {
  // Create MCP streamable HTTP transport
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })

  // Connect MCP server to the transport
  await server.connect(transport)

  // Create Hono app
  const app = new Hono()

  // Apply CORS middleware
  app.use("*", cors())

  // Add request logging middleware using debug (writes to stderr)
  app.use("*", createRequestLogger())

  // Apply authentication middleware if enabled
  if (config.auth?.enabled) {
    log("HTTP transport authentication enabled")
    const authMiddleware = createAuthMiddlewareFunction(config.auth)

    // Protect MCP endpoint with authentication
    app.use(config.path, authMiddleware)
  } else {
    log("HTTP transport authentication disabled")
  }

  // Health endpoint (public, not protected)
  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      transport: "http",
      authEnabled: config.auth?.enabled ?? false,
    })
  })

  // MCP endpoint - handles GET (SSE), POST (JSON-RPC), DELETE (session cleanup)
  app.all(config.path, async (c) => {
    // Pass the raw Request to the transport for MCP protocol handling
    return transport.handleRequest(c.req.raw)
  })

  // Start the HTTP server using Bun's built-in serve
  const bunServer = serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  })

  // Get the actual port (may be different if port 0 was specified)
  const actualPort = (bunServer as { port: number }).port
  const serverUrl = `http://${config.host}:${actualPort}`

  log(`HTTP transport started on ${serverUrl}`)
  log(`MCP endpoint available at ${serverUrl}${config.path}`)
  if (config.auth?.enabled) {
    log(`MCP endpoint is protected with Bearer token authentication`)
  }

  // Return context with close method and server info
  return {
    url: serverUrl,
    port: actualPort,
    close: async (): Promise<void> => {
      log("Closing HTTP transport")
      // Close the transport (closes all SSE connections)
      await transport.close()
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
