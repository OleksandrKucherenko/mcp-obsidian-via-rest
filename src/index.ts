#!/usr/bin/env bun

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { debug } from "debug"
import { dedent } from "ts-dedent"
import { z } from "zod"
import fs from "node:fs/promises"

import PackageJson from "../package.json" assert { type: "json" }
import { ObsidianAPI } from "./client/obsidian-api.js"
import { diagnostics, loadConfiguration } from "./config.js"
import { intercept } from "./stdio.js"

const log = debug("mcp:server")

const HEALTH_FILE_PATH = "/tmp/mcp_healthy"
const HEALTH_INTERVAL_MS = 5_000 // 5 seconds

const configuration = loadConfiguration()

const transport = new StdioServerTransport(intercept.stdin, intercept.stdout)

const server = new McpServer({
  name: PackageJson.name,
  version: PackageJson.version,
  capabilities: {
    resources: {},
    tools: {},
  },
})

const api = new ObsidianAPI(configuration)

server.tool(
  "get_note_content", // name
  "Get content of the obsidian note by file path", // description
  { filePath: z.string() }, // shape
  async ({ filePath }) => {
    const note = await api.readNote(filePath)

    const meta = {
      tags: note.metadata?.tags ?? [],
      size: note.metadata?.stat?.size ?? 0,
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

server.tool(
  "obsidian_search", // name
  dedent`Search for notes using a query string`, // description
  { query: z.string() }, // shape
  async ({ query }) => {
    const notes = await api.searchNotes(query)

    return {
      content: notes.map((note) => ({ type: "text", text: note.path })),
    }
  },
)

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

// declared resources
server.resource(
  "obsidian",
  new ResourceTemplate("obsidian://{name}", { list: undefined }),
  // handler
  async (uri, { name }) => {
    // Resource requested: obsidian://Skills%2FJavaScript%2FCORS.md: Skills/JavaScript/CORS.md
    log(`Resource requested: ${uri.href}: ${decodeURIComponent(name as string)}`)
    const note = await api.readNote(decodeURIComponent(name as string))

    return { contents: [{ uri: uri.href, text: note.content, mimeType: "text/markdown" }] }
  },
)

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

diagnostics()
  // test REST API connection and server status
  .then(() => api.getServerInfo())
  .then((info) => {
    log(`Obsidian API: %O`, info)
    log(`MCP Server: ${PackageJson.name} / ${PackageJson.version} starting on stdio`)

    return server.connect(transport)
  })
  .then(() => {
    log("is connected: %o", server.isConnected())
  })
  .catch((error) => {
    log(`Obsidian API error: %O`, error)

    clearInterval(timer)
    process.exit(1)
  })
