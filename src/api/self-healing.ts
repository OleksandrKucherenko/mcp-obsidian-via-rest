import { debug } from "debug"
import { selectBestUrl, testUrlsInParallel, type URLTestResult } from "./url-tester"
import { ObsidianAPI } from "../client/obsidian-api"
import type { IObsidianAPI, Note, ObsidianConfig } from "../client/types"

const log = debug("mcp:self-healing")

/** Extended configuration for self-healing API. */
export interface SelfHealingConfig extends ObsidianConfig {
  urls: string[]
  testTimeout: number
  retryInterval: number
}

/** Health status of the self-healing connection. */
export interface HealthStatus {
  healthy: boolean
  url: string
  lastCheck: Date
  reconnectCount: number
}

/**
 * Self-healing Obsidian API client that automatically:
 * - Tests multiple URLs on initialization and selects the fastest
 * - Monitors connection health
 * - Attempts reconnection with fallback URLs on failure
 */
export class SelfHealingObsidianAPI {
  private api: ObsidianAPI
  private config: SelfHealingConfig
  private currentUrl: string
  private monitoringTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private isReconnecting = false
  private reconnectCount = 0
  private lastHealthCheck: Date = new Date()

  constructor(config: SelfHealingConfig) {
    // Initialize with the first URL (will be updated after URL testing)
    this.config = config
    this.currentUrl = config.urls[0]
    this.api = new ObsidianAPI({
      apiKey: config.apiKey,
      host: new URL(config.urls[0]).hostname,
      port: parseInt(new URL(config.urls[0]).port || "27124", 10),
      baseURL: config.urls[0],
    })
  }

  /**
   * Initialize the self-healing API by testing all URLs and selecting the best one.
   */
  async initialize(): Promise<void> {
    log("Initializing self-healing API with %d URLs", this.config.urls.length)

    // Test all URLs in parallel
    const results = await testUrlsInParallel(this.config.urls, this.config.apiKey, this.config.testTimeout)

    // Select the best URL
    const bestUrl = selectBestUrl(results)

    if (!bestUrl) {
      throw new Error("No working Obsidian API URL found")
    }

    this.currentUrl = bestUrl
    log("Selected best URL: %s", this.currentUrl)

    // Update the API client with the selected URL
    this.updateApiClient()

    // Start health monitoring
    this.startMonitoring()

    // Verify connection
    try {
      await this.api.getServerInfo()
      log("Successfully connected to Obsidian API at %s", this.currentUrl)
    } catch (error) {
      log("Failed to connect to Obsidian API: %O", error)
      throw new Error(`Failed to connect to Obsidian API at ${this.currentUrl}`)
    }
  }

  /**
   * Update the underlying API client with the current URL.
   */
  private updateApiClient(): void {
    const url = new URL(this.currentUrl)
    this.api = new ObsidianAPI({
      apiKey: this.config.apiKey,
      host: url.hostname,
      port: parseInt(url.port || "27124", 10),
      baseURL: this.currentUrl,
    })
  }

  /**
   * Start periodic health monitoring.
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
    }

    // Check health every retryInterval
    this.monitoringTimer = setInterval(async () => {
      await this.checkHealth()
    }, this.config.retryInterval)

    log("Started health monitoring (interval: %dms)", this.config.retryInterval)
  }

  /**
   * Check the health of the current connection.
   */
  private async checkHealth(): Promise<void> {
    this.lastHealthCheck = new Date()

    try {
      await this.api.getServerInfo()
      log("Health check passed for %s", this.currentUrl)
    } catch (error) {
      log("Health check failed for %s: %O", this.currentUrl, error)
      // Trigger reconnection attempt
      await this.attemptReconnect()
    }
  }

  /**
   * Attempt to reconnect to an alternative URL.
   */
  async attemptReconnect(): Promise<void> {
    // Prevent reconnection storms
    if (this.isReconnecting) {
      log("Reconnection already in progress, skipping")
      return
    }

    this.isReconnecting = true
    this.reconnectCount++

    log("Attempting reconnection (attempt #%d)", this.reconnectCount)

    try {
      // Test all URLs except the current one
      const otherUrls = this.config.urls.filter((url) => url !== this.currentUrl)

      if (otherUrls.length === 0) {
        log("No alternative URLs available")
        return
      }

      const results = await testUrlsInParallel(otherUrls, this.config.apiKey, this.config.testTimeout)

      const bestUrl = selectBestUrl(results)

      if (bestUrl) {
        log("Switching to alternative URL: %s", bestUrl)
        this.currentUrl = bestUrl
        this.updateApiClient()
        this.reconnectCount = 0

        // Verify the new connection
        await this.api.getServerInfo()
        log("Successfully reconnected to %s", this.currentUrl)
      } else {
        log("No working alternative URLs found")
      }
    } catch (error) {
      log("Reconnection attempt failed: %O", error)
    } finally {
      this.isReconnecting = false
    }
  }

  /**
   * Get the current health status.
   */
  getHealth(): HealthStatus {
    return {
      healthy: this.reconnectCount === 0,
      url: this.currentUrl,
      lastCheck: this.lastHealthCheck,
      reconnectCount: this.reconnectCount,
    }
  }

  /**
   * Get the current connection URL.
   */
  getConnectionUrl(): string {
    return this.currentUrl
  }

  /**
   * Get the underlying ObsidianAPI client for API calls.
   */
  getApiClient(): ObsidianAPI {
    return this.api
  }

  /**
   * Cleanup resources and stop monitoring.
   */
  destroy(): void {
    log("Destroying self-healing API")

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = null
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.isReconnecting = false
  }

  /**
   * Read a note from Obsidian.
   * Implements IObsidianAPI interface.
   */
  async readNote(filePath: string): Promise<Note> {
    return this.api.readNote(filePath)
  }

  /**
   * Search for notes in Obsidian.
   * Implements IObsidianAPI interface.
   */
  async searchNotes(query: string): Promise<Note[]> {
    return this.api.searchNotes(query)
  }
}
