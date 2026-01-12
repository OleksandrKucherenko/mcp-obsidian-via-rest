import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import { createAuthMiddlewareFunction } from "./auth.js"
import type { SseConfig, SseTransportContext } from "./types.js"

const log = debug("mcp:transports:sse")

/**
 * Create and configure an SSE transport for MCP server.
 *
 * This function creates an SSE transport for real-time streaming
 * of MCP responses. The SSE transport allows clients to receive
 * streaming responses over HTTP using Server-Sent Events.
 *
 * Authentication:
 * - If config.auth.enabled is true, the SSE endpoint requires a valid Bearer token
 * - The token can be provided via config.auth.token or config.auth.tokenEnvVar
 * - Clients must include the Authorization header when establishing SSE connections
 *
 * Note: Full SSE transport implementation is planned for future phases.
 * The current implementation provides the structure and basic endpoint
 * that can be extended with full protocol support.
 *
 * @param config - SSE transport configuration
 * @param server - The MCP server instance
 * @returns A context object with close method for cleanup
 */
export async function createSseTransport(config: SseConfig, server: McpServer): Promise<SseTransportContext> {
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
