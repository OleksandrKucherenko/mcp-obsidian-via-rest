import { debug } from "debug"

import type { SelfHealingObsidianAPI } from "../api/self-healing.js"
import type { TransportStatus } from "../transports/manager.js"

const log = debug("mcp:server:health")

/** Process start time for uptime calculation */
const PROCESS_START_TIME = Date.now()

/**
 * Obsidian health information
 */
export interface ObsidianHealth {
  /** Whether Obsidian API is connected */
  connected: boolean
  /** The URL being used for Obsidian API */
  url: string
  /** Timestamp of last health check */
  lastCheck: number
}

/**
 * Overall system health status
 */
export interface HealthStatus {
  /** Overall health status (all systems must be healthy) */
  healthy: boolean
  /** Obsidian API health */
  obsidian: ObsidianHealth
  /** Transport statuses (matches TransportStatus from manager) */
  transports: TransportStatus
  /** Process uptime in seconds */
  uptime: number
  /** Timestamp of this health check */
  timestamp: number
}

/**
 * Get comprehensive health status of the MCP server.
 *
 * @param api - The self-healing Obsidian API instance
 * @param transportManager - The transport manager instance
 * @returns Health status with all system information
 */
export async function getHealthStatus(
  api: SelfHealingObsidianAPI,
  transportManager: { getStatus(): TransportStatus },
): Promise<HealthStatus> {
  const timestamp = Date.now()

  // Get Obsidian health
  let obsidianHealth: ObsidianHealth
  try {
    const apiHealth = api.getHealth()
    obsidianHealth = {
      connected: apiHealth.healthy,
      url: apiHealth.url,
      lastCheck: apiHealth.lastCheck.getTime(),
    }
  } catch (error) {
    log("Error getting Obsidian health: %O", error)
    obsidianHealth = {
      connected: false,
      url: "unknown",
      lastCheck: timestamp,
    }
  }

  // Get transport statuses
  let transportsHealth: TransportStatus
  try {
    transportsHealth = transportManager.getStatus()
  } catch (error) {
    log("Error getting transport status: %O", error)
    transportsHealth = {
      stdio: { running: false, enabled: false },
      http: { running: false, enabled: false },
    }
  }

  // Calculate overall health (all systems must be healthy)
  const healthy = obsidianHealth.connected && transportsHealth.stdio.running && transportsHealth.http.running

  // Calculate uptime in seconds
  const uptime = Math.floor((timestamp - PROCESS_START_TIME) / 1000)

  return {
    healthy,
    obsidian: obsidianHealth,
    transports: transportsHealth,
    uptime,
    timestamp,
  }
}

/**
 * Create a simple health response for HTTP endpoints
 * (for backward compatibility with existing health endpoint)
 */
export interface SimpleHealthResponse {
  status: "healthy" | "unhealthy"
  timestamp: string
  transport: string
  authEnabled: boolean
}

/**
 * Convert full health status to simple HTTP response format
 */
export function toSimpleHealthResponse(health: HealthStatus, authEnabled: boolean): SimpleHealthResponse {
  return {
    status: health.healthy ? "healthy" : "unhealthy",
    timestamp: new Date(health.timestamp).toISOString(),
    transport: "http",
    authEnabled,
  }
}
