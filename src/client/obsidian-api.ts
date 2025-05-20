import axios, { type AxiosInstance } from "axios"
import { addLogger } from "axios-debug-log"
import axiosRetry from "axios-retry"
import { debug } from "debug"
import https from "node:https"

import type { Note, NoteJson, ObsidianConfig, ServerStatus } from "./types.ts"

/** Obsidian Local REST API client. */
export class ObsidianAPI {
  private client: AxiosInstance
  private timeout = 10_000
  private readonly logger: ReturnType<typeof debug>

  constructor(config: ObsidianConfig) {
    // support HTTPs
    const baseURL =
      config.host.includes("https://") || config.host.includes("http://")
        ? `${config.host}:${config.port}`
        : `http://${config.host}:${config.port}`

    // Create https agent that accepts self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Allow self-signed certificates
    })

    this.client = axios.create({
      baseURL,
      proxy: false,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      httpsAgent, // Use the custom agent for HTTPS requests
      timeout: this.timeout,
    })

    // configure retry-logic
    axiosRetry(this.client, { retries: 3 })

    this.logger = debug("mcp:api")

    // @ts-ignore
    addLogger(this.client, this.logger)
  }

  /** Wraps API calls with error handling */
  private async safeCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (error: unknown) {
      // NOTE: logger will capture the error if its enabled
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data || {}
        const code = errorData.errorCode ?? -1
        const message = errorData.message ?? "<unknown>"

        console.error(error)
        throw new Error(`Error ${code}: ${message}`)
      }

      throw Object.assign(new Error(`Request failed.`), { cause: error })
    }
  }

  // #region Version 1 of API

  /** List all notes (*.md files) in the vault or a specific folder. */
  async listNotes(folder?: string): Promise<string[]> {
    return this.safeCall(async () => {
      const subPath = folder ? `${encodeURIComponent(folder)}/` : ""
      const response = await this.client.get(`/vault/${subPath}`)
      const files = response.data.files || []

      return files.filter((file: string) => file.endsWith(".md"))
    })
  }

  /** Read content of a note. */
  async readNote(filePath: string): Promise<Note> {
    return this.safeCall(async () => {
      const response = await this.client.get(`/vault/${encodeURIComponent(filePath)}`, {
        headers: { Accept: "application/vnd.olrapi.note+json" },
      })

      const { frontmatter, tags, stat, path, content } = response.data
      const metadata = { frontmatter, tags, stat }

      return {
        path,
        content,
        metadata,
      }
    })
  }

  /** Write content to a note. */
  async writeNote(path: string, content: string): Promise<void> {
    return this.safeCall(async () => {
      await this.client.put(`/vault/${encodeURIComponent(path)}`, content, {
        headers: {
          "Content-Type": "text/markdown",
        },
      })
    })
  }

  /** Search for notes using a query string. */
  async searchNotes(query: string, contextLength = 100): Promise<Note[]> {
    // ref: https://coddingtonbear.github.io/obsidian-local-rest-api/#/Search/post_search_simple_
    return this.safeCall(async () => {
      // API expects query parameters, not a request body
      const response = await this.client.post("/search/simple/", null, { params: { query, contextLength } })

      // Transform the API response to match the Note interface
      // The API returns an array of search results with filename and matches
      // biome-ignore lint/suspicious/noExplicitAny: Necessary for dynamic API response
      return (response.data || []).map((result: any) => {
        // Combine all match contexts into a single content string
        const content =
          result.matches
            // biome-ignore lint/suspicious/noExplicitAny: keep it simple
            ?.map((match: any) => match.context || "")
            .join("\n\n") || ""

        return {
          path: result.filename,
          content,
          metadata: { score: result.score },
        }
      })
    })
  }

  /** Retrieves metadata for a specific note. */
  async getMetadata(path: string): Promise<NoteJson> {
    const headers = { Accept: "application/vnd.olrapi.note+json" }
    return this.safeCall(async () => {
      const response = await this.client.get<NoteJson>(`/vault/${encodeURIComponent(path)}`, { headers })
      return response.data
    })
  }

  // #endregion

  // #region Extended functionality

  /** List files in a specific directory. */
  public async listFilesInDirectory(directory: string): Promise<string[]> {
    return this.safeCall(async () => {
      // Ensure the directory path is properly formatted
      const dirPath = directory.endsWith("/") ? directory : `${directory}/`
      const encodedPath = encodeURIComponent(dirPath)

      const response = await this.client.get(`/vault/${encodedPath}`)
      return response.data.files || []
    })
  }

  /** Retrieves and concatenates contents of multiple files. */
  public async getBatchFileContents(filepaths: string[]): Promise<string> {
    const results: string[] = []
    for (const filepath of filepaths) {
      try {
        const note = await this.readNote(filepath)
        results.push(`# ${filepath}\n\n${note.content}\n\n---\n\n`)
      } catch (error) {
        results.push(`# ${filepath}\n\nError reading file: ${error}\n\n---\n\n`)
      }
    }
    return results.join("")
  }

  /** Extended search with context length parameter. */
  public async search(query: string, contextLength = 100): Promise<Note[]> {
    const url = "/search/simple/"
    const params = { query, contextLength }
    return this.safeCall(async () => {
      const response = await this.client.post(url, null, { params })
      return response.data
    })
  }

  /** Appends content to a file. */
  public async appendContent(filepath: string, content: string): Promise<void> {
    const url = `/vault/${filepath}`
    const headers = { "Content-Type": "text/markdown" }
    return this.safeCall(async () => {
      await this.client.post(url, content, { headers })
    })
  }

  /** Patches content in a file. */
  public async patchContent(
    filepath: string,
    operation: string,
    targetType: string,
    target: string,
    content: string,
  ): Promise<void> {
    const url = `/vault/${filepath}`
    const headers = {
      "Content-Type": "text/markdown",
      Operation: operation,
      "Target-Type": targetType,
      Target: encodeURIComponent(target),
    }
    return this.safeCall(async () => {
      await this.client.patch(url, content, { headers })
    })
  }

  /** Performs a JSON-based search. */
  public async searchJson(query: Record<string, unknown>): Promise<Note[]> {
    const url = "/search/"
    const headers = { "Content-Type": "application/vnd.olrapi.jsonlogic+json" }
    return this.safeCall(async () => {
      const response = await this.client.post(url, query, { headers })
      return response.data
    })
  }

  /** Gets server information including authentication status and API version. */
  public async getServerInfo(): Promise<ServerStatus> {
    return this.safeCall(async () => {
      const response = await this.client.get("/")

      return response.data
    })
  }

  /** Gets the currently open note. */
  public async getActiveNote(): Promise<Note> {
    return this.safeCall(async () => {
      const response = await this.client.get("/active/")
      return {
        path: response.data.path,
        content: response.data.content,
        metadata: {
          frontmatter: response.data.frontmatter,
          tags: response.data.tags,
          stat: response.data.stat,
        },
      }
    })
  }

  /** Set the currently open note. */
  public async setActiveNote(path: string): Promise<void> {
    return this.safeCall(async () => {
      await this.client.put("/active/", { path })
    })
  }

  /** Close the currently open note. */
  public async closeActiveNote(): Promise<void> {
    return this.safeCall(async () => {
      await this.client.delete("/active/")
    })
  }

  /** Append to the currently open note. */
  public async appendToActiveNote(content: string): Promise<void> {
    return this.safeCall(async () => {
      const headers = { "Content-Type": "text/markdown" }
      await this.client.post("/active/", content, { headers })
    })
  }

  /** Patch the currently open note. Inserts/modifies content relative to a heading, block reference, or frontmatter field. */
  public async patchActiveNote(operation: string, targetType: string, target: string, content: string): Promise<void> {
    return this.safeCall(async () => {
      const headers = {
        "Content-Type": "text/markdown",
        Operation: operation,
        "Target-Type": targetType,
        Target: encodeURIComponent(target),
      }
      await this.client.patch("/active/", content, { headers })
    })
  }

  /** List all available Obsidian commands that can be executed through the API. */
  public async listCommands(): Promise<
    Array<{
      id: string
      name: string
    }>
  > {
    return this.safeCall(async () => {
      const response = await this.client.get("/commands/")
      return response.data.commands
    })
  }

  // #endregion

  // #region Not Implemented

  /** Execute a command - not implemented, reserved for future versions */
  public async executeCommand(command: string): Promise<unknown> {
    // POST /commands/ endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }

  /** Get periodic note - not implemented, reserved for future versions */
  public async getPeriodicNote(period: string): Promise<Note> {
    // GET /periodic/{period}/ endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }

  /** Create or append to periodic note - not implemented, reserved for future versions */
  public async appendToPeriodicNote(period: string, content: string): Promise<void> {
    // POST /periodic/{period}/ endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }

  /** Patch a periodic note - not implemented, reserved for future versions */
  public async patchPeriodicNote(
    period: string,
    operation: string,
    targetType: string,
    target: string,
    content: string,
  ): Promise<void> {
    // PATCH /periodic/{period}/ endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }

  /** Delete a periodic note - not implemented, reserved for future versions */
  public async deletePeriodicNote(period: string): Promise<void> {
    // DELETE /periodic/{period}/ endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }

  /** Delete a note - not implemented, reserved for future versions */
  public async deleteNote(path: string): Promise<void> {
    // DELETE /vault/{filename} endpoint
    // Not implemented, reserved for future versions
    throw new Error("Not implemented")
  }
  // #endregion
}
