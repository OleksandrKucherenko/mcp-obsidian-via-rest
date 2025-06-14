import debug from "debug"
import path from "node:path"
import { DockerComposeEnvironment, Wait, type WaitStrategy } from "testcontainers"

import { ContainerStdio } from "./container.stdio"
import { cleanup } from "./teardown.containers"

const DEFAULT_COMPOSE_FILE_PATH = path.resolve(__dirname, "../..")
const DEFAULT_COMPOSE_FILE = "docker-compose.test.yaml"
const log = debug("mcp:e2e")

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
  log("Starting Docker Compose environment for E2E tests...", composeFilePath, composeFile)

  // Clean up any existing containers that might conflict
  await cleanup()

  log("Preparing Docker Compose environment with explicit options...")
  let prepare = new DockerComposeEnvironment(composeFilePath, composeFile)
    .withBuild() // build the images, takes a while
    .withStartupTimeout(timeoutStartup) // give it some time to start up

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
