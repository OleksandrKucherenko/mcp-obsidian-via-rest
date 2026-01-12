import https from "node:https"
import axios, { AxiosError } from "axios"
import { debug } from "debug"

const log = debug("mcp:url-tester")

/** Result of testing a single URL. */
export interface URLTestResult {
  url: string
  success: boolean
  latency: number
}

/**
 * Test a single URL by making a request to the Obsidian API.
 * @param url - The URL to test
 * @param apiKey - The API key for authentication
 * @param timeout - Request timeout in milliseconds
 * @returns Promise resolving to the test result
 */
async function testSingleUrl(url: string, apiKey: string, timeout: number): Promise<URLTestResult> {
  const startTime = Date.now()

  try {
    // Create https agent that accepts self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Allow self-signed certificates
    })

    const axiosInstance = axios.create({
      baseURL: url,
      timeout,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      httpsAgent, // Use the custom agent for HTTPS requests
      validateStatus: (status) => status >= 200 && status < 300,
    })

    await axiosInstance.get("/")

    const latency = Date.now() - startTime
    log("URL test successful: %s (%dms)", url, latency)

    return { url, success: true, latency }
  } catch (error) {
    const latency = Date.now() - startTime

    if (error instanceof AxiosError) {
      log("URL test failed: %s (%dms) - %s", url, latency, error.message)
    } else {
      log("URL test failed: %s (%dms) - Unknown error", url, latency)
    }

    return { url, success: false, latency }
  }
}

/**
 * Test multiple URLs in parallel using Promise.all.
 * @param urls - Array of URLs to test
 * @param apiKey - The API key for authentication
 * @param timeout - Request timeout in milliseconds
 * @returns Promise resolving to array of test results
 */
export async function testUrlsInParallel(urls: string[], apiKey: string, timeout: number): Promise<URLTestResult[]> {
  log("Testing %d URLs in parallel (timeout: %dms)", urls.length, timeout)

  const results = await Promise.all(urls.map((url) => testSingleUrl(url, apiKey, timeout)))

  const successCount = results.filter((r) => r.success).length
  log("URL testing complete: %d/%d successful", successCount, results.length)

  return results
}

/**
 * Select the best (fastest) URL from test results.
 * Only considers successful URLs.
 * @param results - Array of URL test results
 * @returns The fastest working URL, or null if all failed
 */
export function selectBestUrl(results: URLTestResult[]): string | null {
  const successful = results.filter((r) => r.success)

  if (successful.length === 0) {
    log("No successful URLs found")
    return null
  }

  // Sort by latency and return the fastest
  const best = successful.sort((a, b) => a.latency - b.latency)[0]
  log("Selected best URL: %s (%dms)", best.url, best.latency)

  return best.url
}
