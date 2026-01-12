#!/usr/bin/env node

/**
 * Cleanup old screenshot folders from docs directory.
 * Keeps only the specified number of most recent build folders.
 *
 * Usage: node ./assets/ci_cleanup_old_screenshots.js [keep_count]
 *   keep_count - Number of recent folders to keep (default: 10)
 */

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DEFAULT_KEEP_COUNT = 10
const SCREENSHOT_FOLDER_PATTERN = /^\d+$/

// Parse command line arguments
const args = process.argv.slice(2)
const keepCount = args[0] ? parseInt(args[0], 10) : DEFAULT_KEEP_COUNT

if (Number.isNaN(keepCount) || keepCount < 0) {
  console.error(`Error: keep_count must be a positive integer`)
  process.exit(1)
}

console.log(`🧹 Cleanup old screenshot folders`)
console.log(`   Keeping last ${keepCount} most recent builds`)

// Get docs directory path
const docsDir = join(process.cwd(), "docs")

if (!existsSync(docsDir)) {
  console.error(`Error: docs directory not found at ${docsDir}`)
  process.exit(1)
}

// List all directories in docs/
const entries = readdirSync(docsDir, { withFileTypes: true })

// Filter for numeric directories (build IDs) and get their stats
const buildFolders = entries
  .filter((entry) => entry.isDirectory() && SCREENSHOT_FOLDER_PATTERN.test(entry.name))
  .map((entry) => {
    const folderPath = join(docsDir, entry.name)
    const stats = statSync(folderPath)
    return {
      name: entry.name,
      path: folderPath,
      modified: stats.mtime,
      ctime: stats.ctime,
    }
  })
  .sort((a, b) => b.modified - a.modified) // Sort by modification time, newest first

console.log(`   Found ${buildFolders.length} screenshot build folders`)

if (buildFolders.length <= keepCount) {
  console.log(`   ✓ Folder count (${buildFolders.length}) is within keep limit (${keepCount})`)
  console.log(`   No cleanup needed`)
  process.exit(0)
}

// Folders to delete (all except the first `keepCount`)
const foldersToDelete = buildFolders.slice(keepCount)

console.log(`   Marking ${foldersToDelete.length} old folders for deletion`)

// Generate shell script to delete old folders
const scriptContent = foldersToDelete.map((folder) => `rm -rf "${folder.path}"`).join("\n")

const scriptPath = join(process.cwd(), `cleanup-old-screenshots-${keepCount}.sh`)

// Write cleanup script
writeFileSync(scriptPath, scriptContent, "utf8")
console.log(`   Generated cleanup script: ${scriptPath}`)
console.log(`   Folders to delete:`)
foldersToDelete.forEach((folder) => {
  console.log(`     - ${folder.name} (modified: ${folder.modified.toISOString()})`)
})

// Execute cleanup script
try {
  execSync(`bash "${scriptPath}"`, { stdio: "inherit" })
  console.log(`   ✓ Cleanup completed successfully`)
} catch (error) {
  console.error(`   ✗ Cleanup failed: ${error.message}`)
  process.exit(1)
}
