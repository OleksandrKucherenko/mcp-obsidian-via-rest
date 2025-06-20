import debug from "debug"
import { exec as cpExec } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { StartedDockerComposeEnvironment } from "testcontainers"

import type { ContainerStdio } from "./container.stdio"
import { extractComposeResources } from "./docker.compose"

// Promisify exec for async/await usage
const exec = promisify(cpExec)
const log = debug("mcp:e2e")

// Configuration for Docker cleanup behavior
interface CleanupConfig {
  cleanupOnFailure: boolean
  removeVolumes: boolean
  removeImages: boolean
  removeNetworks: boolean
}

// declare process.env variables
declare namespace NodeJS {
  interface ProcessEnv {
    CLEANUP_ON_FAILURE: string
    REMOVE_VOLUMES: string
    REMOVE_IMAGES: string
    REMOVE_NETWORKS: string
  }
}

// Get cleanup configuration from environment variables
const getCleanupConfig = (): CleanupConfig => {
  const isCI = process.env.CI === "true" || process.env.CI === "1" || !!process.env.CI

  return {
    cleanupOnFailure: process.env.CLEANUP_ON_FAILURE !== "false", // Default: true
    removeVolumes: process.env.REMOVE_VOLUMES !== "false", // Default: true
    removeImages: process.env.REMOVE_IMAGES !== "false", // Default: true
    removeNetworks: process.env.REMOVE_NETWORKS !== "false", // Default: true
  }
}

const cleanupConfig = getCleanupConfig()
let isShuttingDown = false

type CleanupArgs = {
  environment: StartedDockerComposeEnvironment
  forceCleanup?: boolean
  testsFailed?: boolean
}

type GracefulShutdownArgs = {
  forceCleanup?: boolean
  environment: StartedDockerComposeEnvironment
  mcpStdio?: ContainerStdio
  testsFailed?: boolean
}

export const cleanupNetworks = async () => {
  log("Cleaning up test networks...")

  try {
    // Get network names from compose file
    const { networkNames, projectName } = await extractComposeResources()

    // Remove networks defined in compose file
    for (const networkName of networkNames) {
      log(`Removing network: ${networkName}`)
      await exec(`docker network rm ${networkName} || true`)
    }

    // Find and remove all testcontainers networks matching our pattern
    const safeProjectName = projectName || "mcp-obsidian-via-rest"
    const { stdout: networks } = await exec(
      `docker network ls --format '{{.Name}}' | grep -E '(testcontainers.*${safeProjectName}|testcontainers.*mcp-test-net)' || true`,
    )

    const networkNamesToRemove = networks
      .trim()
      .split("\n")
      .filter((name) => name.length > 0)

    for (const networkName of networkNamesToRemove) {
      log(`Removing testcontainers network: ${networkName}`)
      await exec(`docker network rm ${networkName} || true`)
    }
  } catch (err) {
    log("Error cleaning up testcontainers networks:", err)
  }

  // Remove any orphaned networks created by testcontainers
  log("Removing any orphaned networks...")
  await exec("docker network prune -f || true")
}

export const cleanupVolumes = async () => {
  log("Cleaning up test volumes...")

  try {
    // Get volume names from compose file
    const { volumeNames, projectName } = await extractComposeResources()
    const safeProjectName = projectName || "mcp-obsidian-via-rest"

    // Remove named volumes from compose file
    for (const volumeName of volumeNames) {
      log(`Removing named volume: ${volumeName}`)
      await exec(`docker volume rm ${volumeName} || true`)
    }

    // Find volumes created by our test environment
    const testPattern = `testcontainers-${safeProjectName}|${safeProjectName.replace(/-/g, "")}`
    const { stdout: volumes } = await exec(
      `docker volume ls --format '{{.Name}}' | grep -E '(${testPattern}|testcontainers|[a-f0-9]{64})' || true`,
    )

    const testVolumes = volumes
      .trim()
      .split("\n")
      .filter((name) => name.length > 0)

    for (const volumeName of testVolumes) {
      log(`Removing volume: ${volumeName}`)
      await exec(`docker volume rm ${volumeName} || true`)
    }
  } catch (err) {
    log("Error cleaning up specific volumes:", err)
  }

  // General volume cleanup
  // Only prune if explicitly requested through the environment variable
  if (process.env.PRUNE_VOLUMES === "true") {
    log("Removing any orphaned volumes... (PRUNE_VOLUMES=true)")
    await exec("docker volume prune -f || true")
  }
}

export const cleanupImages = async () => {
  log("Cleaning up test images...")

  const { stdout: images } = await exec(
    "docker image ls --format '{{.Repository}}:{{.Tag}}' | grep 'testcontainers.*\\(mcp\\|obsidian\\)' || true",
  )

  const imageNames = images
    .trim()
    .split("\n")
    .filter((name) => name.length > 0)

  for (const imageName of imageNames) {
    log(`Removing image: ${imageName}`)
    await exec(`docker image rm ${imageName} || true`)
  }

  // Clean up dangling images
  log("Removing any orphaned images...") // WARNING: can be too much destructive
  await exec("docker image prune -f || true")
}

export const cleanupContainer = async () => {
  log("Final container cleanup...")

  try {
    // Get container names from compose file
    const { containerNames, projectName } = await extractComposeResources()
    const safeProjectName = projectName || "mcp-obsidian-via-rest"

    // Create regex pattern for matching containers
    // Include explicit container names, auto-generated names, and testcontainers prefix with our project
    const containerPattern =
      [...containerNames, `testcontainers-${safeProjectName}`].filter(Boolean).join("|") ||
      "(obsidian|mcp|testcontainers)"

    log(`Searching for containers matching pattern: ${containerPattern}`)

    const { stdout: containers } = await exec(
      `docker ps -a --format '{{.Names}}' | grep -E '(${containerPattern})' || true`,
    )

    const containerNamesToRemove = containers
      .trim()
      .split("\n")
      .filter((name) => name.length > 0)

    for (const containerName of containerNamesToRemove) {
      log(`Stopping and removing container: ${containerName}`)

      await exec(`docker stop ${containerName} || true`)
      await exec(`docker rm -f ${containerName} || true`)
    }
  } catch (err) {
    log("Error in final container cleanup:", err)
  }
}

/**
 * Comprehensive Docker cleanup function that removes containers, networks, volumes, and images
 */
export const performFullDockerCleanup = async ({ environment, forceCleanup, testsFailed = false }: CleanupArgs) => {
  const shouldCleanup = forceCleanup || !testsFailed || cleanupConfig.cleanupOnFailure

  if (!shouldCleanup) {
    log("Skipping cleanup due to test failure and CLEANUP_ON_FAILURE=false")
    return
  }

  log("Performing comprehensive Docker cleanup...")

  const { removeNetworks, removeVolumes, removeImages } = cleanupConfig
  await environment.down({ removeVolumes })

  // Final container cleanup - more comprehensive pattern matching
  await cleanupContainer()

  // Enhanced cleanup using Docker CLI for remaining resources
  if (removeNetworks) await cleanupNetworks()
  if (removeVolumes) await cleanupVolumes()
  if (removeImages) await cleanupImages()

  log("Full Docker cleanup completed successfully")
}

// Graceful shutdown function to be called on test completion or interruption
export const gracefulShutdown = async ({
  testsFailed = false,
  forceCleanup = false,
  environment,
  mcpStdio,
}: GracefulShutdownArgs) => {
  // prevent double shutdown calls
  if (isShuttingDown && !testsFailed) return
  isShuttingDown = true

  log("Performing graceful shutdown...")

  if (mcpStdio) mcpStdio.detach()

  await performFullDockerCleanup({ forceCleanup, environment, testsFailed })

  log("Shutdown complete.")
}

/** Designed for CLI execution, cleanup docker after paying with e2e tests. */
export const cleanup = async () => {
  log("Cleaning up any existing test containers...")

  await cleanupContainer()

  // Enhanced cleanup using Docker CLI for remaining resources
  await cleanupNetworks()
  await cleanupVolumes()
  await cleanupImages()

  log("Cleanup completed successfully")
}
