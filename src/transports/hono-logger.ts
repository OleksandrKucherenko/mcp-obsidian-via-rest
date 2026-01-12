import { debug } from "debug"
import type { MiddlewareHandler } from "hono"

const log = debug("mcp:http")

enum LogPrefix {
  Incoming = "<--",
  Outgoing = "-->",
  Error = "xxx",
}

const formatTime = (start: number): string => {
  const delta = Date.now() - start
  return delta < 1000 ? `${delta}ms` : `${Math.round(delta / 1000)}s`
}

type PrintFunc = (str: string, ...rest: string[]) => void

async function logRequest(
  fn: PrintFunc,
  prefix: LogPrefix,
  method: string,
  path: string,
  status: number = 0,
  elapsed?: string,
) {
  const out =
    prefix === LogPrefix.Incoming ? `${prefix} ${method} ${path}` : `${prefix} ${method} ${path} ${status} ${elapsed}`
  fn(out)
}

/**
 * Create a Hono middleware that logs HTTP requests and responses using the debug library.
 *
 * This middleware logs incoming and outgoing HTTP requests with method, path, status code,
 * and response time. It uses the debug library which writes to stderr, avoiding interference
 * with stdio transport that reads from stdout.
 *
 * Inspired by the Hono logger middleware but adapted to use the debug library.
 *
 * @returns A Hono middleware handler
 */
export function createRequestLogger(): MiddlewareHandler {
  return async function logger(c, next) {
    const { method } = c.req
    const path = c.req.path

    await logRequest(log, LogPrefix.Incoming, method, path)

    const start = Date.now()
    await next()

    await logRequest(log, LogPrefix.Outgoing, method, path, c.res.status, formatTime(start))
  }
}
