import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import type { SseConfig, SseTransportContext } from "./types.js"

const log = debug("mcp:transports:sse")

/**
 * Create and configure an SSE transport for MCP server.
 *
 * @deprecated SSE transport is deprecated in favor of WebStandardStreamableHTTPServerTransport,
 * which handles both HTTP POST and SSE streaming through a single endpoint at /mcp.
 *
 * The HTTP transport already supports streaming responses via Server-Sent Events,
 * making a separate SSE transport unnecessary. Use HTTP transport instead.
 *
 * This stub remains for backward compatibility but is not actively maintained.
 *
 * @param config - SSE transport configuration
 * @param _server - The MCP server instance (unused, kept for interface compatibility)
 * @returns A context object with close method for cleanup
 */
export async function createSseTransport(config: SseConfig, _server: McpServer): Promise<SseTransportContext> {
  log(`SSE transport configured with path: ${config.path}`)

  // Log authentication configuration
  if (config.auth?.enabled) {
    log("SSE transport authentication enabled")
    // When SSE is fully implemented, authentication will be applied:
    // const authMiddleware = createAuthMiddlewareFunction(config.auth)
    // app.use(config.path, authMiddleware)
  } else {
    log("SSE transport authentication disabled")
  }

  // SSE transport implementation is planned for future phases.
  // When implemented, this will:
  // 1. Mount SSE endpoints on a shared Hono app
  // 2. Apply authentication middleware if config.auth.enabled is true
  // 3. Handle GET /{path} for SSE connection establishment
  // 4. Generate unique session IDs for each connection
  // 5. Handle POST /messages for JSON-RPC requests
  // 6. Map sessions to transport instances
  // 7. Stream responses via SSE events
  // 8. Cleanup sessions on disconnect

  log("SSE transport: Basic structure created (full implementation pending)")

  // Return context with close method
  return {
    close: async (): Promise<void> => {
      log("Closing SSE transport")
      // Cleanup sessions and close connections
      log("SSE transport closed")
    },
  }
}
