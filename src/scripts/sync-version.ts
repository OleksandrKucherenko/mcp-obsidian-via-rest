#!/usr/bin/env bun
import { execSync } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import * as readline from "readline"

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() }).trim()
}

function getLatestTag(): string {
  try {
    const tag = exec("git describe --tags --abbrev=0")
    if (!tag.match(/^v\d+\.\d+\.\d+$/)) {
      throw new Error(`Invalid tag format: ${tag}`)
    }
    return tag
  } catch (error) {
    console.error("Error: Could not find latest version tag")
    console.error("Make sure there are tags in the repository")
    process.exit(1)
  }
}

function extractVersion(tag: string): string {
  return tag.replace(/^v/, "")
}

function updatePackageJson(version: string): void {
  const pkgPath = "package.json"
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

  if (pkg.version === version) {
    console.log(`✅ package.json already at version ${version}`)
    return
  }

  console.log(`\nCurrent version: ${pkg.version}`)
  console.log(`Target version: ${version}\n`)

  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  console.log("✅ Updated package.json to version", version)
}

function updateChangelog(version: string): void {
  try {
    const branchName = `release/v${version}`

    console.log(`\nFetching release branch: ${branchName}`)
    exec(`git fetch origin ${branchName}`)

    console.log(`Checking out CHANGELOG.md from ${branchName}`)
    exec(`git checkout origin/${branchName} -- CHANGELOG.md`)

    console.log("✅ Updated CHANGELOG.md")
  } catch (error) {
    console.error(`\n❌ Failed to update CHANGELOG: ${error}`)
    console.error("\nThis might be due to:")
    console.error("  - Release branch already deleted (run this within 7 days of release)")
    console.error("  - Conflicting changes in CHANGELOG.md")
    console.error("\nRecovery options:")
    console.error("  1. Manually update CHANGELOG.md")
    console.error("  2. Run: git diff CHANGELOG.md | git apply")
    process.exit(1)
  }
}

function showDiff(): void {
  console.log("\n--- Diff ---")
  const output = exec("git diff package.json CHANGELOG.md")
  console.log(output)
  console.log("--- End Diff ---\n")
}

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question("Commit and push these changes? (y/N) ", (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y")
    })
  })
}

function commitAndPush(version: string): void {
  const tag = `v${version}`
  exec("git add package.json CHANGELOG.md")
  exec(`git commit -m "chore: sync package.json and CHANGELOG to ${tag}"`)
  console.log("✅ Committed changes")

  console.log("\nNext steps:")
  console.log("  git push")
  console.log("\n(or push to your feature branch and create PR)")
}

function main() {
  console.log("🔄 Syncing package.json and CHANGELOG to latest released version\n")

  const tag = getLatestTag()
  const version = extractVersion(tag)

  console.log(`Latest tag: ${tag}`)
  console.log(`Version: ${version}\n`)

  updatePackageJson(version)
  updateChangelog(version)
  showDiff()

  confirm().then((shouldCommit) => {
    if (shouldCommit) {
      commitAndPush(version)
    } else {
      console.log("\n❌ Aborted. Changes not committed.")
      exec("git checkout -- package.json CHANGELOG.md")
      console.log("Reverted changes.")
    }
  })
}

main()
