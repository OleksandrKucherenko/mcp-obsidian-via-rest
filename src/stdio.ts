import { PassThrough } from "node:stream"
import { debug } from "debug"

// Extend the debug type to include inspectOpts hidden property
declare module "debug" {
  interface Debugger {
    inspectOpts?: {
      depth?: number | null
      // breakLength?: number
      // [key: string]: unknown
    }
  }
}
const logPush = debug("mcp:push")
const logPull = debug("mcp:pull")

// print JSON/object deep hierarchies
logPush.inspectOpts = logPush.inspectOpts || {}
logPush.inspectOpts.depth = null
logPull.inspectOpts = logPull.inspectOpts || {}
logPull.inspectOpts.depth = null

export const interceptStdin = new PassThrough()
export const interceptStdout = new PassThrough()

// Ensure process.stdin is in flowing mode and properly set up
process.stdin.resume()
process.stdin.setEncoding("utf8")

// Remove any previous listeners to avoid duplicate handling in hot reload/dev
process.stdin.removeAllListeners("data")
interceptStdout.removeAllListeners("data")

// Log all incoming data on process.stdin and pipe to interceptStdin
process.stdin.on("data", (data: Buffer) => {
  try {
    logPush("%O", JSON.parse(data.toString()))
  } catch {
    logPush("%o", data.toString())
  }

  // interceptStdin.write(data)
})

// Log all outgoing data on interceptStdout and pipe to process.stdout
interceptStdout.on("data", (data: Buffer) => {
  try {
    const json = JSON.parse(data.toString())
    if ("error" in json && "message" in json.error) {
      try {
        logPull.extend("error")("%o", JSON.parse(json.error.message))
      } catch {}
    }
    logPull("%O", json)
  } catch {
    logPull("%o", data.toString())
  }

  // process.stdout.write(data)
})

// Use Symbols for type-safe custom flags
const isPipedToIntercept = Symbol("isPipedToIntercept")
const isPipedToStdout = Symbol("isPipedToStdout")

// Only pipe if not already piped (avoid double piping)
if (!(process.stdin as unknown as { [key: symbol]: boolean })[isPipedToIntercept]) {
  process.stdin.pipe(interceptStdin)
  ;(process.stdin as unknown as { [key: symbol]: boolean })[isPipedToIntercept] = true
} else {
  logPush("process.stdin already piped to interceptStdin")
}

if (!(interceptStdout as unknown as { [key: symbol]: boolean })[isPipedToStdout]) {
  interceptStdout.pipe(process.stdout)
  ;(interceptStdout as unknown as { [key: symbol]: boolean })[isPipedToStdout] = true
} else {
  logPull("interceptStdout already piped to process.stdout")
}

export const intercept = {
  stdin: interceptStdin,
  stdout: interceptStdout,
}
