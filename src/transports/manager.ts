import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { debug } from "debug"

import { createStdioTransport } from "./stdio.transport.js"
import type { HttpConfig, TransportConfig, TransportContext } from "./types.js"

const log = debug("mcp:transports:manager")

// Transport factory types
type StdioTransportFactory = (server: McpServer) => TransportContext
type HttpTransportFactory = (config: HttpConfig, server: McpServer) => Promise<TransportContext>

// Server factory type - creates a new MCP server instance with tools/resources
type ServerFactory = () => McpServer

// Default transport factories (lazy loaded)
let defaultHttpTransportFactory: HttpTransportFactory | null = null

// Lazy loader for HTTP transport
async function loadHttpTransport(): Promise<HttpTransportFactory | null> {
  if (!defaultHttpTransportFactory) {
    try {
      const module = await import("./http.transport.js")
      defaultHttpTransportFactory = module.createHttpTransport
    } catch {
      log("HTTP transport not implemented yet")
      defaultHttpTransportFactory = null
    }
  }
  return defaultHttpTransportFactory
}

/** Transport status information. */
export interface TransportStatusEntry {
  /** Whether the transport is currently running. */
  running: boolean
  /** Whether the transport is enabled in configuration. */
  enabled: boolean
}

/** Complete transport status for all transports. */
export interface TransportStatus {
  stdio: TransportStatusEntry
  http: TransportStatusEntry
}

/** Optional transport factories for dependency injection (useful for testing). */
export interface TransportFactories {
  stdio?: StdioTransportFactory
  http?: HttpTransportFactory
}

/**
 * Manages multiple transport lifecycles based on configuration.
 *
 * This class creates separate MCP server instances for each transport,
 * allowing multiple transports to run simultaneously without interference.
 * Each transport gets its own server instance with tools/resources registered.
 *
 * For testing purposes, transport factories can be injected via the
 * third constructor parameter.
 */
export class TransportManager {
  private config: TransportConfig
  private serverFactory: ServerFactory
  private factories: TransportFactories
  private contexts: Map<string, TransportContext> = new Map()
  private servers: Map<string, McpServer> = new Map()

  constructor(config: TransportConfig, serverFactory: ServerFactory, factories: TransportFactories = {}) {
    this.config = config
    this.serverFactory = serverFactory
    this.factories = factories
  }

  /**
   * Start all enabled transports based on configuration.
   *
   * Each transport gets its own MCP server instance with tools/resources
   * registered, allowing multiple transports to work simultaneously.
   *
   * Errors during transport initialization are logged but don't
   * prevent other transports from starting.
   */
  async startTransports(): Promise<void> {
    log("Starting transports...")

    // Start stdio transport if enabled
    if (this.config.stdio.enabled) {
      await this.startStdioTransport()
    }

    // Start HTTP transport if enabled
    if (this.config.http.enabled) {
      await this.startHttpTransport()
    }

    log("Transports started: %O", Array.from(this.contexts.keys()))
  }

  /**
   * Stop all running transports and cleanup resources.
   */
  async stopTransports(): Promise<void> {
    log("Stopping all transports...")

    const stopPromises: Array<Promise<void>> = []

    for (const [name, context] of this.contexts) {
      if (context) {
        log("Stopping transport: %s", name)
        stopPromises.push(
          context.close().catch((error) => {
            log("Error stopping transport %s: %O", name, error)
          }),
        )
      }
    }

    await Promise.all(stopPromises)
    this.contexts.clear()
    this.servers.clear()

    log("All transports stopped")
  }

  /**
   * Get the current status of all transports.
   *
   * @returns Status information for all transports
   */
  getStatus(): TransportStatus {
    return {
      stdio: {
        running: this.contexts.has("stdio"),
        enabled: this.config.stdio.enabled,
      },
      http: {
        running: this.contexts.has("http"),
        enabled: this.config.http.enabled,
      },
    }
  }

  private async startStdioTransport(): Promise<void> {
    try {
      log("Starting stdio transport...")
      // Create a new server instance for stdio transport
      const server = this.serverFactory()
      this.servers.set("stdio", server)

      const factory = this.factories.stdio || createStdioTransport
      const context = factory(server)
      this.contexts.set("stdio", context)
      log("Stdio transport started")
    } catch (error) {
      log("Failed to start stdio transport: %O", error)
    }
  }

  private async startHttpTransport(): Promise<void> {
    try {
      log("Starting HTTP transport...")
      // Create a new server instance for HTTP transport
      const server = this.serverFactory()
      this.servers.set("http", server)

      const factory = this.factories.http || (await loadHttpTransport())
      if (!factory) {
        log("HTTP transport not available, skipping...")
        return
      }
      const context = await factory(this.config.http, server)
      this.contexts.set("http", context)
      log("HTTP transport started")
    } catch (error) {
      log("Failed to start HTTP transport: %O", error)
    }
  }
}
