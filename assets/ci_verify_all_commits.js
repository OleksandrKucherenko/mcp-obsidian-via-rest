#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process"

// Get all commit hashes in the repo (most recent first)
const commitHashes = execSync("git log --format=%H").toString().trim().split("\n")

const failedCommits = []

console.log(`🔍 Checking ${commitHashes.length} commits for Conventional Commit compliance...\n`)

// Initialize progress indicator
process.stdout.write("Progress: ")

// Process each commit
commitHashes.forEach((hash, index) => {
  const message = execSync(`git log -1 --pretty=%B ${hash}`).toString().trim()

  // Run commitlint with the message via stdin (without --stdin flag)
  const result = spawnSync("bunx", ["commitlint"], {
    input: message,
    encoding: "utf-8",
  })

  // Update progress indicator
  if (index % 10 === 0) {
    // Print the index number every 10 commits
    process.stdout.write(`${index}`)
  } else {
    // Print a dot for each commit
    process.stdout.write(".")
  }

  if (result.status !== 0) {
    failedCommits.push({ hash, message, output: result.stdout + result.stderr })
  }
})

// End the progress line
process.stdout.write("\n\n")

if (failedCommits.length === 0) {
  console.log("✅ All commits pass Conventional Commits check!")
  process.exit(0)
} else {
  console.error(`❌ ${failedCommits.length} commit(s) failed:\n`)
  for (const { hash, message, output } of failedCommits) {
    console.error(`🔴 Commit: ${hash}`)
    console.error(`Message: "${message}"`)
    console.error(output)
    console.error("--------------------------------------------------\n")
  }
  process.exit(1)
}
