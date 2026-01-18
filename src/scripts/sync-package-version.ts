#!/usr/bin/env bun

/**
 * Sync package.json version to the latest tag, normalized to main branch.
 *
 * This replicates the e-bash semantic-version.sh logic:
 * - Finds the highest version tag
 * - Finds which main commit that release branch was created from
 * - Treats the tag as if it's at that main commit position
 */

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

function exec(command: string): string {
  return execSync(command, { encoding: "utf-8" }).trim()
}

interface TagInfo {
  tag: string
  commit: string
  branchFrom: string | null
}

/**
 * Find which main commit a release branch was created from.
 * This is the commit where the release branch diverged from main.
 */
function findBranchPoint(tagCommit: string): string {
  // Get the merge base (common ancestor) between the tag and HEAD
  // This is where the release branch was created from main
  const mergeBase = exec(`git merge-base ${tagCommit} HEAD`)
  return mergeBase
}

/**
 * Get the highest version tag with its branch point.
 */
function getLatestTagWithBranchPoint(): TagInfo | null {
  try {
    // Get all tags sorted by semantic version (highest first)
    const allTags = exec("git tag --sort=-v:refname --list 'v[0-9]*.*'").split("\n")

    if (allTags.length === 0 || allTags[0] === "") {
      console.log("⚠️  No tags found in repository")
      return null
    }

    // Get the highest version tag
    const highestTag = allTags[0]

    // Get the commit this tag points to
    const tagCommit = exec(`git rev-list -n 1 ${highestTag}`)

    // Find where this tag's branch was created from main
    const branchFrom = findBranchPoint(tagCommit)

    console.log(`📍 Highest tag: ${highestTag}`)
    console.log(`   Tag commit: ${tagCommit}`)
    console.log(`   Branch point on main: ${branchFrom}`)

    return { tag: highestTag, commit: tagCommit, branchFrom }
  } catch (error) {
    console.error(`❌ Error: ${error}`)
    return null
  }
}

function extractVersion(tag: string): string {
  return tag.replace(/^v/, "")
}

function updatePackageJson(version: string): void {
  const pkgPath = "package.json"
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

  if (pkg.version === version) {
    console.log(`✓ package.json already at version ${version}`)
    return
  }

  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  console.log(`✓ Updated package.json to version ${version}`)
}

// Main
const tagInfo = getLatestTagWithBranchPoint()
if (tagInfo) {
  const version = extractVersion(tagInfo.tag)
  updatePackageJson(version)
}
