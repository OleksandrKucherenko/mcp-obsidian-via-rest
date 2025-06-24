/** Configuration for connecting to the Obsidian API. */
export interface ObsidianConfig {
  apiKey: string
  port: number
  host: string
  baseURL: string
}

/** Represents a note in Obsidian. */
export interface Note {
  path: string
  content: string
  metadata?: {
    stat?: {
      ctime?: number
      mtime?: number
      size?: number
    }
    tags?: string[]
    [key: string]: unknown
  }
}

export interface NoteJson {
  content: string
  frontmatter: Record<string, unknown>
  path: string
  stat: {
    ctime: number
    mtime: number
    size: number
  }
  tags: string[]
}

/**
 * Example of Obsidian REST API Server response:
 * <pre>
 * {
 * "status": "OK",
 *   "manifest": {
 *     "id": "obsidian-local-rest-api",
 *     "name": "Local REST API",
 *     "version": "3.1.0",
 *     "minAppVersion": "0.12.0",
 *     "description": "Get, change or otherwise interact with your notes in Obsidian via a REST API.",
 *     "author": "Adam Coddington",
 *     "authorUrl": "https://coddingtonbear.net/",
 *     "isDesktopOnly": true,
 *     "dir": ".obsidian/plugins/obsidian-local-rest-api"
 *   },
 *   "versions": {
 *     "obsidian": "1.8.10",
 *     "self": "3.1.0"
 *   },
 *   "service": "Obsidian Local REST API",
 *   "authenticated": false
 * }
 * </pre>
 */
export interface ServerStatus {
  status: string
  manifest: {
    id: string
    name: string
    version: string
    minAppVersion: string
    description: string
    author: string
    authorUrl: string
    isDesktopOnly: boolean
    dir: string
  }
  versions: {
    obsidian: string
    self: string
  }
  service: string
  authenticated: boolean
}
