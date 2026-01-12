import { afterAll, beforeAll, describe, expect, it, jest } from "bun:test"
import type { StartedDockerComposeEnvironment } from "testcontainers"
import debug from "debug"

import { logJsonRpcMessage, type ContainerStdio } from "./utils/container.stdio"
import { setupContainers } from "./utils/setup.containers"
import { gracefulShutdown } from "./utils/teardown.containers"

const log = debug("mcp:e2e")

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
  let environment: StartedDockerComposeEnvironment | undefined
  let mcpStdio: ContainerStdio

  beforeAll(async () => {
    const containers = await setupContainers()

    environment = containers.environment
    mcpStdio = containers.mcpStdio
  }, 180_000) // 3 minutes timeout for container startup

  afterAll(async () => gracefulShutdown({ environment, mcpStdio }), 30_000) // 30 seconds timeout for shutdown

  it("should receive method not found error when not existing method is called", async () => {
    // GIVEN: request
    const requestId = "test-heartbeat-1"
    const request: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: requestId,
      method: "HEARTBEAT",
    }

    // Capture STDOUT responses
    const spy = jest.fn()
    const waitForResponse = new Promise<string>((resolve) => {
      spy.mockImplementation((data: Buffer) => {
        logJsonRpcMessage("stdout")(data)
        resolve(data.toString())
      })
    })
    mcpStdio.stdout.on("data", spy)

    // WHEN:Send the request to the MCP server's STDIN.
    log.extend("stdin")("%o", request)
    mcpStdio.stdin.write(`${JSON.stringify(request)}\n`)
    const response = await waitForResponse

    // THEN: expect a response with error code -32601 (Method not found)
    expect(response).toContain("-32601")
  }, 30_000) // 30 seconds timeout for the test
})
