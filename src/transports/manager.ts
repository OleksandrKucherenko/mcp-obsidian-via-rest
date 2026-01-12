import { debug } from "debug"

import { createStdioTransport } from "./stdio.transport.js"
import type { HttpConfig, SseConfig, StdioConfig, TransportConfig, TransportContext } from "./types.js"

const log = debug("mcp:transports:manager")

// Transport factory types
type StdioTransportFactory = (server: unknown) => TransportContext
type HttpTransportFactory = (config: HttpConfig, server: unknown) => Promise<TransportContext>
type SseTransportFactory = (config: SseConfig, server: unknown) => Promise<TransportContext>

// Default transport factories (lazy loaded)
let defaultHttpTransportFactory: HttpTransportFactory | null = null
let defaultSseTransportFactory: SseTransportFactory | null = null

// Lazy loader for HTTP transport (will be implemented in Phase 3)
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

// Lazy loader for SSE transport (will be implemented in Phase 4)
async function loadSseTransport(): Promise<SseTransportFactory | null> {
  if (!defaultSseTransportFactory) {
    try {
      const module = await import("./sse.transport.js")
      defaultSseTransportFactory = module.createSseTransport
    } catch {
      log("SSE transport not implemented yet")
      defaultSseTransportFactory = null
    }
  }
  return defaultSseTransportFactory
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
  sse: TransportStatusEntry
}

/** Optional transport factories for dependency injection (useful for testing). */
export interface TransportFactories {
  stdio?: StdioTransportFactory
  http?: HttpTransportFactory
  sse?: SseTransportFactory
}

/**
 * Manages multiple transport lifecycles based on configuration.
 *
 * This class is responsible for starting and stopping transports
 * based on the provided configuration. It handles errors gracefully
 * and provides status information for each transport.
 *
 * For testing purposes, transport factories can be injected via the
 * third constructor parameter.
 */
export class TransportManager {
  private config: TransportConfig
  private server: unknown
  private factories: TransportFactories
  private contexts: Map<string, TransportContext> = new Map()

  constructor(config: TransportConfig, server: unknown, factories: TransportFactories = {}) {
    this.config = config
    this.server = server
    this.factories = factories
  }

  /**
   * Start all enabled transports based on configuration.
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

    // Start SSE transport if enabled
    if (this.config.sse.enabled) {
      await this.startSseTransport()
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
      sse: {
        running: this.contexts.has("sse"),
        enabled: this.config.sse.enabled,
      },
    }
  }

  private async startStdioTransport(): Promise<void> {
    try {
      log("Starting stdio transport...")
      const factory = this.factories.stdio || createStdioTransport
      const context = factory(this.server)
      this.contexts.set("stdio", context)
      log("Stdio transport started")
    } catch (error) {
      log("Failed to start stdio transport: %O", error)
    }
  }

  private async startHttpTransport(): Promise<void> {
    try {
      log("Starting HTTP transport...")
      const factory = this.factories.http || (await loadHttpTransport())
      if (!factory) {
        log("HTTP transport not available, skipping...")
        return
      }
      const context = await factory(this.config.http, this.server)
      this.contexts.set("http", context)
      log("HTTP transport started")
    } catch (error) {
      log("Failed to start HTTP transport: %O", error)
    }
  }

  private async startSseTransport(): Promise<void> {
    try {
      log("Starting SSE transport...")
      const factory = this.factories.sse || (await loadSseTransport())
      if (!factory) {
        log("SSE transport not available, skipping...")
        return
      }
      const context = await factory(this.config.sse, this.server)
      this.contexts.set("sse", context)
      log("SSE transport started")
    } catch (error) {
      log("Failed to start SSE transport: %O", error)
    }
  }
}
