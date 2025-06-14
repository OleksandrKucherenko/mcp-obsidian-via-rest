import { type ChildProcess, execSync, spawn } from "node:child_process"
import type { Readable, Writable } from "node:stream"
import debug from "debug"

const log = debug("mcp:e2e")

export interface ContainerStdioContext {
  process: ChildProcess
  stdin: Writable
  stdout: Readable
  containerName: string
}

export const createContainerStdioContext = async (
  containerName: string,
  timeoutMs = 5000,
): Promise<ContainerStdioContext> => {
  log(`Attaching to container ${containerName} with timeout ${timeoutMs}ms...`)

  // First check if container is running
  const inspectResult = execSync(`docker inspect --format='{{.State.Running}}' ${containerName}`).toString().trim()

  if (inspectResult !== "true") {
    throw new Error(`Container ${containerName} is not running. State: ${inspectResult}`)
  }

  log(`Container ${containerName} is confirmed running`)

  const process = spawn("docker", ["attach", containerName], {
    stdio: ["pipe", "pipe", "pipe"],
  })

  // This inner Promise handles the asynchronous nature of process spawning and timeout
  await new Promise<void>((resolve, reject) => {
    let attachTimeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
      attachTimeoutHandle = null
      log(`Attachment to container ${containerName} timed out after ${timeoutMs}ms`)
      if (!process.killed) {
        process.kill()
      }
      reject(new Error(`Attachment to container ${containerName} timed out`))
    }, timeoutMs)

    const cleanupTimeout = () => {
      if (attachTimeoutHandle) {
        clearTimeout(attachTimeoutHandle)
        attachTimeoutHandle = null
      }
    }

    process.once("spawn", () => {
      cleanupTimeout()

      log(`Successfully spawned docker attach process for ${containerName}`)
      if (!process.stdin || !process.stdout) {
        if (!process.killed) {
          process.kill()
        }
        reject(new Error(`Failed to attach to container ${containerName}. Stdin or stdout is null.`))
        return
      }

      resolve()
    })

    process.once("error", (err) => {
      cleanupTimeout()
      log(`Failed to spawn docker attach for ${containerName}: ${err.message}`)
      reject(new Error(`Failed to spawn docker attach for ${containerName}: ${err.message}`))
    })
  })

  // At this point, 'spawn' has occurred and stdin/stdout should be available
  if (!process.stdin || !process.stdout) {
    // This check is somewhat redundant due to the check within the promise,
    // but good for type safety and as a final guard.
    if (!process.killed) process.kill() // Ensure process is killed if we're erroring out
    throw new Error(`Failed to attach to container ${containerName}. Stdin or stdout is unexpectedly null after spawn.`)
  }

  const context: ContainerStdioContext = {
    process,
    stdin: process.stdin,
    stdout: process.stdout,
    containerName,
  }

  process.stderr?.on("data", (data) => {
    log(`[DOCKER ATTACH ERR for ${containerName}]: ${data.toString()}`)
  })

  process.on("error", (err) => {
    log(`Docker attach process operational error for ${containerName}: ${err.message}`)
  })

  process.on("exit", (code, signal) => {
    log(`Docker attach process for ${containerName} exited with code ${code} and signal ${signal}`)
  })

  return context
}

// detachContainerStdio remains the same
export const detachContainerStdio = (context: ContainerStdioContext): void => {
  if (context.process && !context.process.killed) {
    try {
      const killed = context.process.kill("SIGINT")

      if (killed) {
        log(`Successfully sent SIGINT to detach from container ${context.containerName}`)
      } else {
        log(
          `Failed to send SIGINT to detach from container ${context.containerName}. Process might have already exited or be unkillable.`,
        )
      }
    } catch (err) {
      log(`Error detaching from container ${context.containerName}:`, err instanceof Error ? err.message : String(err))
    }
  } else {
    log(`Process for ${context.containerName} already killed or not found, no detach needed.`)
  }
}
