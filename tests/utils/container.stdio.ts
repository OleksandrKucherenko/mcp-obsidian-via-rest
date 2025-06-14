import { type ChildProcess, execSync, spawn } from "node:child_process"
import type { Readable, Writable } from "node:stream"
import debug from "debug"

const log = debug("mcp:e2e")

/**
 * A helper class to interact with a running container's STDIN and STDOUT streams.
 * It uses `docker attach` to create a persistent connection for sending and receiving data,
 * which is ideal for testing STDIO-based applications like MCP servers.
 */
export class ContainerStdio {
  private process: ChildProcess
  public readonly stdin: Writable
  public readonly stdout: Readable
  private attachTimeout: NodeJS.Timeout | null = null
  private containerName: string // Added to store containerName for logging in detach

  constructor(containerName: string, timeoutMs = 5000) {
    this.containerName = containerName // Store for later use
    log(`Attaching to container ${containerName} with timeout ${timeoutMs}ms...`)

    // First check if container is running
    const inspectResult = execSync(`docker inspect --format='{{.State.Running}}' ${containerName}`).toString().trim()

    if (inspectResult !== "true") {
      throw new Error(`Container ${containerName} is not running. State: ${inspectResult}`)
    }

    log(`Container ${containerName} is confirmed running`)

    // Spawn `docker attach` to connect to the container's stdio streams with timeout
    this.process = spawn("docker", ["attach", containerName], {
      stdio: ["pipe", "pipe", "pipe"], // Pipe stdin, stdout, and stderr
    })

    // Set timeout for attach operation
    this.attachTimeout = setTimeout(() => {
      log(`Attachment to container ${containerName} timed out after ${timeoutMs}ms`)

      this.process.kill()
      throw new Error(`Attachment to container ${containerName} timed out`)
    }, timeoutMs)

    // Wait for process to be ready
    this.process.once("spawn", () => {
      if (this.attachTimeout) {
        clearTimeout(this.attachTimeout)
        this.attachTimeout = null
      }

      log(`Successfully spawned docker attach process for ${containerName}`)
    })

    if (!this.process.stdin || !this.process.stdout) {
      if (this.attachTimeout) clearTimeout(this.attachTimeout)

      throw new Error(`Failed to attach to container ${containerName}. Stdin/Stdout not available.`)
    }

    this.stdin = this.process.stdin
    this.stdout = this.process.stdout

    // Log any errors from the attach process for debugging.
    this.process.stderr?.on("data", (data) => {
      const line = data.toString().trim().replaceAll("\\n", "\n")
      debug("docker:stderr")(line)
    })
    this.process.on("error", (err) => log.extend("error")(`[${containerName}]: %O`, err))
    this.process.on("exit", (code, signal) => log(`[${containerName}]: exited with code ${code}, signal ${signal}`))
  }

  /**
   * Detaches from the container by sending a SIGINT signal to the `docker attach` process.
   */
  public detach() {
    if (this.attachTimeout) {
      clearTimeout(this.attachTimeout)
      this.attachTimeout = null
    }

    if (this.process && !this.process.killed) {
      // Check if process exists and not already killed
      try {
        this.process.kill("SIGINT")
        log(`Successfully sent SIGINT to detach from container ${this.containerName}`)
      } catch (err) {
        log(`Error detaching from container ${this.containerName}:`, err instanceof Error ? err.message : String(err))
      }
    } else {
      log(`Process for ${this.containerName} already killed or not found, no detach needed.`)
    }
  }
}

export const logJsonRpcMessage = (extend: string) => (data: Buffer) => {
  try {
    log.extend(extend)("%o", JSON.parse(data.toString()))
  } catch {
    log.extend(extend)(data.toString())
  }
}
