import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { debug } from "debug"

import { intercept } from "../stdio.js"
import type { StdioTransportContext } from "./types.js"

const log = debug("mcp:transports:stdio")

/**
 * Create a stdio transport wrapper that manages MCP server stdio communication.
 *
 * This function creates a stdio transport using intercepted stdin/stdout streams
 * for debugging purposes, connects the server to it, and returns a context with
 * cleanup capabilities.
 *
 * @param server - The MCP server instance to connect to the transport
 * @returns A context object with a close method for cleanup
 */
export function createStdioTransport(server: McpServer): StdioTransportContext {
  const transport = new StdioServerTransport(intercept.stdin, intercept.stdout)

  // Connect the server to the transport
  server.connect(transport).catch((error) => {
    log("Failed to connect server to stdio transport: %O", error)
    throw error
  })

  log("MCP Server connected to stdio transport")

  // Return context with cleanup method
  return {
    close: async (): Promise<void> => {
      log("Closing stdio transport")
      // Stdio transport doesn't have explicit close method in MCP SDK
      // The cleanup is handled by process exit
    },
  }
}
