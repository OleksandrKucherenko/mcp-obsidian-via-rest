import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import type { StartedDockerComposeEnvironment } from "testcontainers"

import type { ContainerStdio } from "./utils/container.stdio"
import { setupContainers } from "./utils/setup.containers"
import { gracefulShutdown } from "./utils/teardown.containers"

// The JSON-RPC message structure used by MCP
interface JsonRpcMessage {
  jsonrpc: "2.0"
  id: string | number
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

describe("MCP Server E2E with Testcontainers", () => {
  let environment: StartedDockerComposeEnvironment
  let mcpStdio: ContainerStdio

  beforeAll(async () => {
    const containers = await setupContainers()

    environment = containers.environment
    mcpStdio = containers.mcpStdio
  })

  afterAll(async () => gracefulShutdown({ environment, mcpStdio }))

  it("should receive a heartbeat response when sent a heartbeat request", (done: (err?: Error) => void) => {
    const requestId = "test-heartbeat-1"
    const request: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: requestId,
      method: "HEARTBEAT",
    }

    const responseListener = (data: Buffer) => {
      const responseStr = data.toString()

      const response: JsonRpcMessage = JSON.parse(responseStr)

      if (response.id === requestId) {
        expect(response.result).toBe("OK")

        // Clean up the listener and signal that the test is complete.
        mcpStdio.stdout.removeListener("data", responseListener)
        done()
      }
    }

    mcpStdio.stdout.on("data", responseListener)

    // Send the request to the MCP server's STDIN.
    mcpStdio.stdin.write(`${JSON.stringify(request)}\n`)
  })
})
