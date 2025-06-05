#!/usr/bin/env bun

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod/v4"
import { debug } from "debug"
import { dedent } from "ts-dedent"

import PackageJson from "../package.json" assert { type: "json" }
import { ObsidianAPI } from "./client/obsidian-api.js"
import { loadConfiguration } from "./config.js"

const logger = debug("mcp:server")

const configuration = loadConfiguration()

const server = new McpServer({
  name: PackageJson.name,
  version: PackageJson.version,
})

const api = new ObsidianAPI(configuration)

// @ts-expect-error
server.tool(
  "get_note_content", // name
  "Get content of the obsidian note by file path", // description
  { filePath: z.string() }, // shape
  async ({ filePath }) => {
    const note = await api.readNote(filePath)

    return {
      contents: [
        { type: "text", text: filePath },
        { type: "text", text: note.content },
        { type: "text", text: JSON.stringify(note.metadata) },
      ],
    }
  },
)

// @ts-expect-error Typescript cannot infer the return type, too deep
server.tool(
  "obsidian_search", // name
  dedent`Search for notes using a query string`, // description
  { query: z.string() }, // shape
  async ({ query }) => {
    const notes = await api.searchNotes(query)

    return {
      contents: notes.map((note) => ({
        type: "text",
        text: note.path,
      })),
    }
  },
)

// @ts-expect-error Typescript cannot infer the return type, too deep
server.tool(
  "obsidian_semantic_search",
  dedent`Search for notes using a query string`,
  { query: z.string() },
  async ({ query }) => {
    const notes = await api.searchNotes(query)

    return {
      contents: notes.map((note) => ({
        type: "text",
        text: note.path,
      })),
    }
  },
)

// declared resources
server.resource(
  "obsidian",
  new ResourceTemplate("obsidian://{name}", { list: undefined }),
  // handler
  async (uri, { name }) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: `Content of the ${name}`,
        },
      ],
    }
  },
)

// test REST API connection and server status
api
  .getServerInfo()
  .then((info) => {
    logger(`Obsidian API: %O`, info)

    logger(`MCP Server: ${PackageJson.name} / ${PackageJson.version} starting on stdio`)
    const transport = new StdioServerTransport(process.stdin, process.stdout)
    return server.connect(transport)
  })
  .then(() => {
    logger("is connected: %o", server.isConnected())
    // Initial newline to signal ready
    // process.stdout.write(`${PackageJson.name} running on stdio\n`)
    // process.stdout.write(`\n`)
  })
  .catch((error) => {
    logger(`Obsidian API error: %O`, error)
    process.exit(1)
  })
