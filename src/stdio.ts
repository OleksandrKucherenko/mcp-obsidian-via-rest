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
const stdin = debug("mcp:push")
const stdout = debug("mcp:pull")

// print JSON/object deep hierarchies
stdin.inspectOpts = stdin.inspectOpts || {}
stdin.inspectOpts.depth = null
stdout.inspectOpts = stdout.inspectOpts || {}
stdout.inspectOpts.depth = null

export const interceptStdin = new PassThrough()
export const interceptStdout = new PassThrough()

// process.stdin.pipe(interceptStdin)
process.stdin.on("data", (data) => {
  const line = data.toString()

  try {
    // stdin(line)
    stdin("%O", JSON.parse(line))
  } catch (ignored) {}

  interceptStdin.write(data)
})

// interceptStdout.pipe(process.stdout)
interceptStdout.on("data", (data) => {
  const line = data.toString()

  try {
    const json = JSON.parse(line)

    // unpack error message from stringified JSON
    if ("error" in json && "message" in json.error) {
      stdout("ERROR: %O", JSON.parse(json.error.message))
    }

    stdout("%O", json)
  } catch (ignored) {}

  process.stdout.write(data)
})

export const intercept = {
  stdin: interceptStdin,
  stdout: interceptStdout,
}
