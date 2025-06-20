import debug from "debug"
import yaml from "js-yaml"
import fs from "node:fs/promises"
import path from "node:path"

const log = debug("mcp:e2e")

const TEST_COMPOSE_FILE = "docker-compose.test.yaml"

const PROJECT_ROOT = path.resolve(__dirname, "../..")
const TEST_COMPOSE_PATH = path.join(PROJECT_ROOT, TEST_COMPOSE_FILE)
const DEFAULT_PROJECT_NAME = path.basename(path.dirname(TEST_COMPOSE_PATH))

// declare process.env variables
declare namespace NodeJS {
  interface ProcessEnv {
    COMPOSE_PROJECT_NAME: string
  }
}

/**
 * Type definitions for docker-compose YAML structure
 */
export type DockerComposeService = {
  container_name?: string
  image?: string
  build?: {
    context?: string
    dockerfile?: string
  }
  networks?: string[] | Record<string, unknown>
  volumes?: string[] | Record<string, unknown>
}

export type DockerComposeConfig = {
  services?: Record<string, DockerComposeService>
  networks?: Record<string, unknown>
  volumes?: Record<string, unknown>
}

export type ComposeResources = {
  containerNames: string[]
  serviceNames: string[]
  networkNames: string[]
  projectName: string
  volumeNames: string[]
}

const FALLBACK: ComposeResources = {
  containerNames: ["obsidian", "mcp"], // Fallback to hardcoded values
  serviceNames: ["obsidian", "mcp"],
  networkNames: ["mcp-test-net"],
  projectName: "mcp-obsidian-via-rest",
  volumeNames: [],
}

/**
 * Get the project name from compose file path
 * Docker compose uses the directory name as the default project name
 * @returns The project name used by docker-compose
 */
const getProjectName = async (): Promise<string> => {
  try {
    // Try to get COMPOSE_PROJECT_NAME from environment
    if (process.env.COMPOSE_PROJECT_NAME) {
      return process.env.COMPOSE_PROJECT_NAME
    }

    // Default to directory name
    return path.basename(path.dirname(TEST_COMPOSE_PATH))
  } catch (err) {
    log("Error getting project name:", err)

    return DEFAULT_PROJECT_NAME // Fallback to project directory name
  }
}

/**
 * Extract container names, networks, volumes from docker-compose.test.yaml
 * @returns Object containing arrays of resource names
 */
export const extractComposeResources = async (composePath: string = TEST_COMPOSE_PATH): Promise<ComposeResources> => {
  try {
    const composeContent = await fs.readFile(composePath, "utf-8")
    const projectName = await getProjectName()

    // Parse YAML content
    const composeConfig = yaml.load(composeContent) as DockerComposeConfig

    if (!composeConfig || !composeConfig.services) {
      throw new Error("Invalid docker-compose.yaml format or no services defined")
    }

    // Extract service names
    const serviceNames: string[] = Object.keys(composeConfig.services)

    // Extract explicit container_name values
    const explicitContainerNames: string[] = Object.values(composeConfig.services)
      .filter((service) => service.container_name)
      .map((service) => service.container_name as string)

    // Extract network names
    const networkNames: string[] = composeConfig.networks ? Object.keys(composeConfig.networks) : []

    // Generate potential auto-generated container names (projectName_serviceName_1)
    const autoContainerNames = serviceNames.map((service) => `${projectName}_${service}_1`)

    // Also include with potential directory-based project name format
    const dirBasedProjectName = projectName.replace(/-/g, "")
    const altAutoContainerNames = serviceNames.map((service) => `${dirBasedProjectName}_${service}_1`)

    // Compose full container name pattern
    const allContainerNames = [...explicitContainerNames, ...autoContainerNames, ...altAutoContainerNames]

    return {
      containerNames: allContainerNames,
      serviceNames,
      networkNames,
      projectName,
      volumeNames: composeConfig.volumes ? Object.keys(composeConfig.volumes) : [],
    }
  } catch (err) {
    log("Error extracting compose resources:", err)

    return FALLBACK
  }
}
