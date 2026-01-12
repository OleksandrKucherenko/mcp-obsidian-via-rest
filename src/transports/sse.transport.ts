import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import type { SseConfig, SseTransportContext } from "./types.js"

const log = debug("mcp:transports:sse")

/**
 * Create and configure an SSE transport for MCP server.
 *
 * This function creates an SSE transport for real-time streaming
 * of MCP responses. The SSE transport allows clients to receive
 * streaming responses over HTTP using Server-Sent Events.
 *
 * Note: Full SSE transport implementation is planned for future phases.
 * The current implementation provides the structure and basic endpoint
 * that can be extended with full protocol support.
 *
 * @param config - SSE transport configuration
 * @param server - The MCP server instance
 * @returns A context object with close method for cleanup
 */
export async function createSseTransport(
  config: SseConfig,
  server: McpServer,
): Promise<SseTransportContext> {
  log(`SSE transport configured with path: ${config.path}`)

  // SSE transport implementation is planned for future phases.
  // When implemented, this will:
  // 1. Mount SSE endpoints on a shared Hono app
  // 2. Handle GET /{path} for SSE connection establishment
  // 3. Generate unique session IDs for each connection
  // 4. Handle POST /messages for JSON-RPC requests
  // 5. Map sessions to transport instances
  // 6. Stream responses via SSE events
  // 7. Cleanup sessions on disconnect

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
