import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test"
import { type ChildProcess, exec as cpExec, execSync, spawn } from "node:child_process"
import path from "node:path"
import type { Readable, Writable } from "node:stream"
import { promisify } from "node:util"
import { DockerComposeEnvironment, type StartedDockerComposeEnvironment, Wait } from "testcontainers"

// Promisify exec for async/await usage
const exec = promisify(cpExec)

// Configuration for Docker cleanup behavior
interface CleanupConfig {
  cleanupOnFailure: boolean
  removeVolumes: boolean
  removeImages: boolean
  removeNetworks: boolean
}

// Get cleanup configuration from environment variables
const getCleanupConfig = (): CleanupConfig => ({
  cleanupOnFailure: process.env.CLEANUP_ON_FAILURE !== "false", // Default: true
  removeVolumes: process.env.REMOVE_VOLUMES !== "false", // Default: true
  removeImages: process.env.REMOVE_IMAGES !== "false", // Default: true
  removeNetworks: process.env.REMOVE_NETWORKS !== "false", // Default: true
})

// Environment variables for TestContainers configuration are now set in .envrc
// This provides better separation of concerns and consistent configuration

// The JSON-RPC message structure used by MCP
interface JsonRpcMessage {
  jsonrpc: "2.0"
  id: string | number
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

/**
 * A helper class to interact with a running container's STDIN and STDOUT streams.
 * It uses `docker attach` to create a persistent connection for sending and receiving data,
 * which is ideal for testing STDIO-based applications like MCP servers.
 */
class ContainerStdio {
  private process: ChildProcess
  public readonly stdin: Writable
  public readonly stdout: Readable
  private attachTimeout: NodeJS.Timeout | null = null

  constructor(containerName: string, timeoutMs = 5000) {
    console.log(`Attaching to container ${containerName} with timeout ${timeoutMs}ms...`)

    // First check if container is running
    try {
      const inspectResult = execSync(`docker inspect --format='{{.State.Running}}' ${containerName}`).toString().trim()
      if (inspectResult !== "true") {
        throw new Error(`Container ${containerName} is not running. State: ${inspectResult}`)
      }
      console.log(`Container ${containerName} is confirmed running`)
    } catch (err) {
      console.error(`Error checking container state: ${err}`)
      throw new Error(`Failed to verify container state for ${containerName}: ${err}`)
    }

    // Spawn `docker attach` to connect to the container's stdio streams with timeout
    this.process = spawn("docker", ["attach", containerName], {
      stdio: ["pipe", "pipe", "pipe"], // Pipe stdin, stdout, and stderr
    })

    // Set timeout for attach operation
    this.attachTimeout = setTimeout(() => {
      console.error(`Attachment to container ${containerName} timed out after ${timeoutMs}ms`)
      this.process.kill()
      throw new Error(`Attachment to container ${containerName} timed out`)
    }, timeoutMs)

    // Wait for process to be ready
    this.process.once("spawn", () => {
      if (this.attachTimeout) {
        clearTimeout(this.attachTimeout)
        this.attachTimeout = null
      }
      console.log(`Successfully spawned docker attach process for ${containerName}`)
    })

    if (!this.process.stdin || !this.process.stdout) {
      if (this.attachTimeout) {
        clearTimeout(this.attachTimeout)
      }
      throw new Error(`Failed to attach to container ${containerName}.`)
    }

    this.stdin = this.process.stdin
    this.stdout = this.process.stdout

    // Log any errors from the attach process for debugging.
    this.process.stderr?.on("data", (data) => {
      console.error(`[DOCKER ATTACH ERR for ${containerName}]: ${data.toString()}`)
    })

    this.process.on("error", (err) => {
      console.error(`Docker attach process error for ${containerName}: ${err.message}`)
    })

    this.process.on("exit", (code) => {
      console.log(`Docker attach process exited for ${containerName} with code ${code}`)
    })
  }

  /**
   * Detaches from the container by sending a SIGINT signal to the `docker attach` process.
   */
  public detach() {
    if (this.attachTimeout) {
      clearTimeout(this.attachTimeout)
      this.attachTimeout = null
    }
    if (this.process) {
      try {
        this.process.kill("SIGINT")
        console.log("Successfully detached from container")
      } catch (err) {
        console.warn("Error detaching from container:", err)
      }
    }
  }
}

describe("MCP Server E2E with Testcontainers", () => {
  let environment: StartedDockerComposeEnvironment
  let mcpStdio: ContainerStdio
  const composeFilePath = path.resolve(__dirname, "..")
  const composeFile = "docker-compose.test.yaml"
  let isShuttingDown = false
  let testsFailed = false
  const cleanupConfig = getCleanupConfig()

  /**
   * Comprehensive Docker cleanup function that removes containers, networks, volumes, and images
   */
  const performFullDockerCleanup = async (forceCleanup = false) => {
    const shouldCleanup = forceCleanup || !testsFailed || cleanupConfig.cleanupOnFailure

    if (!shouldCleanup) {
      console.log("Skipping cleanup due to test failure and CLEANUP_ON_FAILURE=false")
      return
    }

    console.log("Performing comprehensive Docker cleanup...")

    try {
      // Primary cleanup using testcontainers API
      if (environment) {
        console.log("Stopping environment with full cleanup options...")
        await environment.down({
          removeVolumes: cleanupConfig.removeVolumes,
        })
      }

      // Enhanced cleanup using Docker CLI for remaining resources
      if (cleanupConfig.removeNetworks) {
        console.log("Cleaning up test networks...")
        // Remove the base network
        await exec("docker network rm mcp-test-net || true")

        // Find and remove all testcontainers networks matching our pattern
        try {
          const { stdout: networks } = await exec(
            "docker network ls --format '{{.Name}}' | grep 'testcontainers.*mcp-test-net' || true",
          )
          if (networks.trim()) {
            const networkNames = networks
              .trim()
              .split("\n")
              .filter((name) => name.length > 0)
            for (const networkName of networkNames) {
              console.log(`Removing testcontainers network: ${networkName}`)
              await exec(`docker network rm ${networkName} || true`)
            }
          }
        } catch (err) {
          console.warn("Error cleaning up testcontainers networks:", err)
        }

        // Remove any orphaned networks created by testcontainers
        await exec("docker network prune -f || true")
      }

      if (cleanupConfig.removeVolumes) {
        console.log("Cleaning up test volumes...")
        // Remove any volumes that might have been created by our containers
        try {
          const { stdout: volumes } = await exec(
            "docker volume ls --format '{{.Name}}' | grep -E '(testcontainers|[a-f0-9]{64})' || true",
          )
          if (volumes.trim()) {
            const volumeNames = volumes
              .trim()
              .split("\n")
              .filter((name) => name.length > 0)
            for (const volumeName of volumeNames) {
              console.log(`Removing volume: ${volumeName}`)
              await exec(`docker volume rm ${volumeName} || true`)
            }
          }
        } catch (err) {
          console.warn("Error cleaning up specific volumes:", err)
        }

        // General volume cleanup
        await exec("docker volume prune -f || true")
      }

      if (cleanupConfig.removeImages) {
        console.log("Cleaning up test images...")
        // Remove locally built images from our compose file
        await exec("docker image rm mcp-obsidiant-obsidian mcp-obsidiant-mcp || true")
        await exec("docker image rm mcp-obsidiant/obsidian mcp-obsidiant/mcp || true")

        // Clean up dangling images
        await exec("docker image prune -f || true")
      }

      // Final container cleanup - more comprehensive pattern matching
      console.log("Final container cleanup...")
      try {
        const { stdout: containers } = await exec(
          "docker ps -a --format '{{.Names}}' | grep -E '(obsidian|mcp|testcontainers)' || true",
        )
        if (containers.trim()) {
          const containerNames = containers
            .trim()
            .split("\n")
            .filter((name) => name.length > 0)
          for (const containerName of containerNames) {
            console.log(`Stopping and removing container: ${containerName}`)
            await exec(`docker stop ${containerName} || true`)
            await exec(`docker rm -f ${containerName} || true`)
          }
        }
      } catch (err) {
        console.warn("Error in final container cleanup:", err)
      }

      console.log(" Full Docker cleanup completed successfully")
    } catch (err) {
      console.error(" Error during Docker cleanup:", err)
      // Don't throw here to avoid masking original test failures
    }
  }

  // Graceful shutdown function to be called on test completion or interruption
  const gracefulShutdown = async (force = false) => {
    if (isShuttingDown && !force) {
      return
    }
    isShuttingDown = true

    console.log("Performing graceful shutdown...")
    try {
      mcpStdio?.detach()
      await performFullDockerCleanup(force)
    } catch (err) {
      console.error("Error during shutdown:", err)
    }
    console.log("Shutdown complete.")

    if (force) {
      process.exit(testsFailed ? 1 : 0)
    }
  }

  const cleanup = async () => {
    console.log("Cleaning up any existing test containers...")
    try {
      // More comprehensive initial cleanup
      await exec("docker stop obsidian mcp || true")
      await exec("docker rm -f obsidian mcp || true")

      // Clean up any existing testcontainers networks
      const { stdout: networks } = await exec(
        "docker network ls --format '{{.Name}}' | grep 'testcontainers.*mcp-test-net' || true",
      )
      if (networks.trim()) {
        const networkNames = networks
          .trim()
          .split("\n")
          .filter((name) => name.length > 0)
        for (const networkName of networkNames) {
          await exec(`docker network rm ${networkName} || true`)
        }
      }

      await exec("docker network rm mcp-test-net || true")
      console.log("Cleanup completed successfully")
    } catch (err) {
      console.warn("Cleanup warning (continuing anyway):", err)
    }
  }

  // Uncomment these for manual testing to ensure proper cleanup
  // Register signal handlers for graceful shutdown on interruption (e.g., Ctrl+C)
  process.on("SIGINT", gracefulShutdown)
  process.on("SIGTERM", gracefulShutdown)

  beforeAll(
    async () => {
      console.log("Starting Docker Compose environment for E2E tests...")

      // Clean up any existing containers that might conflict
      await cleanup()

      try {
        console.log("Starting Docker Compose environment with explicit options...")
        // NOTE: Obsidian health-check may need >60s (30s start_period + 5×10s retries = 80s).
        // Allow 3-minute startup to avoid premature timeout while keeping tests reasonable.
        environment = await new DockerComposeEnvironment(composeFilePath, composeFile)
          .withStartupTimeout(60_000) // 3 minutes timeout
          .withBuild()
          .withWaitStrategy("obsidian", Wait.forHealthCheck())
          .withWaitStrategy("mcp", Wait.forLogMessage(/MCP Server is ready/))
          .withBuild()
          .up()

        console.log("Docker environment is up. Attaching to MCP server STDIN/STDOUT...")

        console.log("Getting MCP server container...")
        const mcpContainer = environment.getContainer("mcp")
        console.log(`MCP container name: ${mcpContainer.getName()}`)

        console.log("Creating ContainerStdio instance...")
        try {
          mcpStdio = new ContainerStdio(mcpContainer.getName(), 10000) // 10 second timeout
        } catch (err) {
          console.error("Failed to attach to MCP container:", err)
          throw err
        }

        console.log("Attached to MCP server. Tests are now running.")
      } catch (err) {
        console.error("Error starting Docker environment:", err)
        throw err
      }
    },
    // WARNING: bun does not support timeouts. 5-minute timeout to allow for Docker image builds
    // @ts-expect-error BUN types are not fully updated
    300_000, // 5 minutes
  )

  afterAll(async () => {
    // Always perform cleanup unless explicitly disabled
    await gracefulShutdown()
  })

  // Track test failures for cleanup decisions
  afterEach(() => {
    // Simple test completion tracking
    console.log("Test completed")
  })

  it("should receive a heartbeat response when sent a heartbeat request", (done: (err?: Error) => void) => {
    const requestId = "test-heartbeat-1"
    const request: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: requestId,
      method: "HEARTBEAT",
    }

    const responseListener = (data: Buffer) => {
      const responseStr = data.toString()
      try {
        const response: JsonRpcMessage = JSON.parse(responseStr)
        if (response.id === requestId) {
          expect(response.result).toBe("OK")
          // Clean up the listener and signal that the test is complete.
          mcpStdio.stdout.removeListener("data", responseListener)
          done()
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", responseStr, e)
        testsFailed = true
        done(e as Error)
        // This might not be a fatal error if multiple messages are received in chunks.
      }
    }

    mcpStdio.stdout.on("data", responseListener)

    // Send the request to the MCP server's STDIN.
    mcpStdio.stdin.write(`${JSON.stringify(request)}\n`)
  })

  // You can add more tests here for other MCP methods.
  // For example:
  // it("should list available commands", (done) => { ... });
})
