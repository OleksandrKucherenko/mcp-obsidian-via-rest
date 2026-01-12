import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "bun"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import type { HttpConfig, HttpTransportContext } from "./types.js"

const log = debug("mcp:transports:http")

/**
 * JSON-RPC 2.0 request interface
 */
interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: unknown
}

/**
 * JSON-RPC 2.0 response interface
 */
interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Create and configure an HTTP transport for MCP server.
 *
 * This function creates a Hono app with CORS middleware, sets up
 * a health endpoint, and implements a basic MCP JSON-RPC endpoint.
 *
 * Note: Full MCP JSON-RPC protocol support requires additional implementation.
 * The current implementation provides the structure and basic endpoint
 * that can be extended with full protocol support.
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

  // MCP JSON-RPC endpoint
  // This provides a basic MCP endpoint structure.
  // Full MCP protocol support will be implemented in a future update.
  app.post(config.path, async (c) => {
    try {
      const body = await c.json<JsonRpcRequest>()

      // Validate JSON-RPC request format
      if (!body.jsonrpc || body.jsonrpc !== "2.0") {
        return c.json<JsonRpcResponse>(
          {
            jsonrpc: "2.0",
            id: body.id || null,
            error: {
              code: -32600,
              message: "Invalid Request: jsonrpc version must be '2.0'",
            },
          },
          400,
        )
      }

      if (!body.method) {
        return c.json<JsonRpcResponse>(
          {
            jsonrpc: "2.0",
            id: body.id || null,
            error: {
              code: -32600,
              message: "Invalid Request: method is required",
            },
          },
          400,
        )
      }

      // For now, return a basic response indicating the endpoint is available
      // Full MCP protocol support will require integration with the server's
      // internal request handling methods
      log(`Received MCP request: ${body.method}`)

      return c.json<JsonRpcResponse>({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          _comment: "MCP JSON-RPC endpoint is available. Full protocol support coming soon.",
          _method: body.method,
          _note: "This is a placeholder response. Full MCP protocol implementation will be added in Phase 3.2+",
        },
      })
    } catch (error) {
      log("Error processing MCP request: %O", error)

      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return c.json<JsonRpcResponse>(
          {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error: Invalid JSON",
            },
          },
          400,
        )
      }

      // Handle other errors
      return c.json<JsonRpcResponse>(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : String(error),
          },
        },
        500,
      )
    }
  })

  // Set content-type for JSON responses
  app.use("*", async (c, next) => {
    await next()
    if (c.req.headers.get("content-type")?.includes("application/json")) {
      c.header("content-type", "application/json")
    }
  })

  // Start the HTTP server using Bun's built-in serve
  const serverUrl = `http://${config.host}:${config.port}`
  const bunServer = serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  })

  log(`HTTP transport started on ${serverUrl}`)
  log(`MCP endpoint available at ${serverUrl}${config.path}`)

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
