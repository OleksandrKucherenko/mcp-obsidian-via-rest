import { spawn } from "node:child_process"
import path from "node:path"
import debug from "debug"
import { DockerComposeEnvironment, Wait, type WaitStrategy } from "testcontainers"

import { ContainerStdio } from "./container.stdio"
import { cleanup } from "./teardown.containers"

const DEFAULT_COMPOSE_FILE_PATH = path.resolve(__dirname, "../..")
const DEFAULT_COMPOSE_FILE = "docker-compose.test.yaml"
const log = debug("mcp:e2e")
const logDockerBuild = log.extend("docker:build")

const isDebuggingEnabled = () => Boolean(log.enabled || logDockerBuild.enabled)

const logConsoleNotice = (message: string) => {
  log(message)

  if (!isDebuggingEnabled()) {
    console.info(`[mcp:e2e] ${message}`)
  }
}

const streamDockerOutput = (buffer: Buffer) => {
  const text = buffer
    .toString()
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  if (text.length === 0) return

  for (const line of text) {
    logDockerBuild(line)
  }
}

const ensureDockerImages = async ({
  composeFilePath,
  composeFile,
}: Pick<SetupContainersArgs, "composeFilePath" | "composeFile">) => {
  logConsoleNotice(
    "Docker is building the test containers. " + 
    "This can take a few minutes on first run (set DEBUG=mcp:* for build logs)...",
  )

  const shouldNotify = !isDebuggingEnabled()
  const startedAt = Date.now()
  const notificationInterval = shouldNotify
    ? setInterval(() => {
        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
        console.info(`[mcp:e2e] Docker build still running... (${elapsedSeconds}s elapsed)`)
      }, 15_000)
    : null

  try {
    await new Promise<void>((resolve, reject) => {
      const args = ["compose", "-f", composeFile, "--progress=plain", "build"]
      const child = spawn("docker", args, {
        cwd: composeFilePath,
        stdio: ["ignore", "pipe", "pipe"],
      })

      child.stdout?.on("data", streamDockerOutput)
      child.stderr?.on("data", streamDockerOutput)
      child.once("error", reject)
      child.once("close", (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`docker compose build exited with code ${code}`))
        }
      })
    })
  } finally {
    if (notificationInterval) clearInterval(notificationInterval)
  }

  logConsoleNotice("Docker images are ready for the tests.")
}

type SetupContainersArgs = {
  composeFilePath: string
  composeFile: string
  waitStrategy: Record<string, WaitStrategy>
  timeoutStartup: number
  timeoutStdio: number
  mcpServerName: string
}

const DEFAULTS: SetupContainersArgs = {
  composeFilePath: DEFAULT_COMPOSE_FILE_PATH,
  composeFile: DEFAULT_COMPOSE_FILE,
  /** NOTE: Obsidian health-check may need >60s (30s start_period + 5×10s retries = 80s).
   * Allow 3-minute startup to avoid premature timeout while keeping tests reasonable. */
  timeoutStartup: 60_000,
  timeoutStdio: 10_000,
  mcpServerName: "mcp",
  waitStrategy: {
    // IMPORTANT: inside docker-compose file should be configured health-check's for both services,
    //   otherwise testcontainers will not capture the state of the containers and will fail with
    //   timeout.
    obsidian: Wait.forHealthCheck(),
    mcp: Wait.forHealthCheck(),
  },
}

export const setupContainers = async ({
  composeFilePath,
  composeFile,
  waitStrategy,
  timeoutStartup,
  timeoutStdio,
  mcpServerName,
} = DEFAULTS) => {
  log(`Starting Docker Compose: %o`, `${composeFilePath}/${composeFile}`)

  // Clean up any existing containers that might conflict
  await cleanup()
  await ensureDockerImages({ composeFilePath, composeFile })

  log("Preparing Docker Compose environment with explicit options...")
  let prepare = new DockerComposeEnvironment(composeFilePath, composeFile).withStartupTimeout(timeoutStartup) // give it some time to start up

  // setup wait strategies for each service, if provided
  prepare = Object.entries(waitStrategy).reduce((prepare, [service, strategy]) => {
    return prepare.withWaitStrategy(service, strategy)
  }, prepare)

  log("Starting Docker Compose environment...")
  const environment = await prepare.up()

  log("Docker environment is up. Attaching to MCP server STDIN/STDOUT...")

  log("Getting MCP server container...")
  const mcpContainer = environment.getContainer(mcpServerName)
  log(`MCP container name: ${mcpContainer.getName()}`)

  log("Creating ContainerStdioContext instance...")
  const mcpStdio: ContainerStdio = new ContainerStdio(mcpContainer.getName(), timeoutStdio)

  log("Attached to MCP server. Tests are now running.")

  return { environment, mcpStdio }
}
