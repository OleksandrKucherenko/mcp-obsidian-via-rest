#!/usr/bin/env bun

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { debug } from "debug"
import { dedent } from "ts-dedent"
import { PassThrough } from "node:stream"

import PackageJson from "../package.json" assert { type: "json" }
import { ObsidianAPI } from "./client/obsidian-api.js"
import { loadConfiguration } from "./config.js"

// Extend the debug type to include inspectOpts hidden property
declare module "debug" {
  interface Debugger {
    inspectOpts?: {
      depth?: number | null
      // breakLength?: number
      // [key: string]: unknown
    }
  }
}

const logger = debug("mcp:server")
const stdin = debug("mcp:push")
const stdout = debug("mcp:pull")

// print JSON/object deep hierarchies
stdin.inspectOpts = stdin.inspectOpts || {}
stdin.inspectOpts.depth = null
stdout.inspectOpts = stdout.inspectOpts || {}
stdout.inspectOpts.depth = null

const configuration = loadConfiguration()

const interceptStdin = new PassThrough()
const interceptStdout = new PassThrough()

// process.stdin.pipe(interceptStdin)
process.stdin.on("data", (data) => {
  const line = data.toString()

  try {
    // stdin(line)
    stdin("%O", JSON.parse(line))
  } catch (ignored) {}

  interceptStdin.write(data)
})

// interceptStdout.pipe(process.stdout)
interceptStdout.on("data", (data) => {
  const line = data.toString()

  try {
    const json = JSON.parse(line)

    // unpack error message from stringified JSON
    if ("error" in json && "message" in json.error) {
      stdout("ERROR: %O", JSON.parse(json.error.message))
    }

    stdout("%O", json)
  } catch (ignored) {}

  process.stdout.write(data)
})

const transport = new StdioServerTransport(interceptStdin, interceptStdout)

const server = new McpServer({
  name: PackageJson.name,
  version: PackageJson.version,
  capabilities: {
    resources: {},
    tools: {},
  },
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
    // Resource requested: obsidian://Skills%2FJavaScript%2FCORS.md: Skills/JavaScript/CORS.md
    logger(`Resource requested: ${uri.href}: ${decodeURIComponent(name as string)}`)
    const note = await api.readNote(decodeURIComponent(name as string))

    return { contents: [{ uri: uri.href, text: note.content }] }
  },
)

// test REST API connection and server status
api
  .getServerInfo()
  .then((info) => {
    logger(`Obsidian API: %O`, info)

    logger(`MCP Server: ${PackageJson.name} / ${PackageJson.version} starting on stdio`)
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
