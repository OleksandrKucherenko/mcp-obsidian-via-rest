import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"
import { dedent } from "ts-dedent"
import { z } from "zod"

import PackageJson from "../../package.json" with { type: "json" }
import type { IObsidianAPI } from "../client/types"

const log = debug("mcp:server")

/**
 * Create and configure an MCP server with Obsidian tools and resources.
 * @param api - The ObsidianAPI instance to use for tool/resource operations
 * @returns Configured McpServer instance
 */
export function createMcpServer(api: IObsidianAPI): McpServer {
  const server = new McpServer({
    name: PackageJson.name,
    version: PackageJson.version,
  })

  // Register get_note_content tool
  server.tool(
    "get_note_content",
    "Get content of the obsidian note by file path",
    { filePath: z.string() },
    async ({ filePath }) => {
      const note = await api.readNote(filePath)

      const meta = {
        tags: note.metadata?.tags ?? [],
        size: (note.metadata?.stat as { size?: number } | undefined)?.size ?? 0,
      }

      return {
        content: [
          { type: "text", text: filePath },
          { type: "text", text: `Resource templates name: ${filePath}` },
          { type: "text", text: note.content },
          { type: "text", text: JSON.stringify(meta) },
        ],
      }
    },
  )

  // Register obsidian_search tool
  server.tool(
    "obsidian_search",
    dedent`Search for notes using a query string`,
    { query: z.string() },
    async ({ query }) => {
      const notes = await api.searchNotes(query)

      return {
        content: notes.map((note) => ({ type: "text", text: note.path })),
      }
    },
  )

  // Register obsidian_semantic_search tool
  server.tool(
    "obsidian_semantic_search",
    dedent`Search for notes using a query string`,
    { query: z.string() },
    async ({ query }) => {
      const notes = await api.searchNotes(query)

      return {
        content: notes.map((note) => ({ type: "text", text: note.path })),
      }
    },
  )

  // Register obsidian:// resource template
  server.resource("obsidian", new ResourceTemplate("obsidian://{name}", { list: undefined }), async (uri, { name }) => {
    log(`Resource requested: ${uri.href}: ${decodeURIComponent(name as string)}`)
    const note = await api.readNote(decodeURIComponent(name as string))

    return { contents: [{ uri: uri.href, text: note.content, mimeType: "text/markdown" }] }
  })

  return server
}
