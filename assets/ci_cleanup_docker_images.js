#!/usr/bin/env node

/**
 * Script to identify Docker images older than 30 days, excluding last 3 versions,
 * and generate a bash script to delete those images automatically.
 *
 * Usage:
 *   assets/ci_cleanup_docker_images.js <owner> <image-name> [--keep-latest-major-releases] [--force]
 *
 * Node.js 22 LTS recommended.
 *
 * Options:
 *   --keep-latest-major-releases   Keep the latest version for each major (e.g., 1.x, 2.x) even if it would otherwise be deleted.
 *   --force                        Force cleanup of ALL versions not selected to keep, regardless of age.
 *
 * .keep-versions file:
 *   - Each line is a version pattern to keep or exclude
 *   - Lines starting with # are comments
 *   - Normal version numbers: '1.2.3' - exact match
 *   - Wildcard patterns: '1.*' - match any version beginning with '1.'
 *   - Negative patterns: '!1.2.3' or '!1.*' - explicitly do NOT keep these versions
 */

import { execSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import process from "node:process"
import { readFileSync } from "node:fs"

// Configuration constants
const CONFIG = {
  DAYS_TO_CLEANUP: 30,
  KEEP_LATEST_COUNT: 3,
  KEEP_VERSIONS_FILE: ".keep-versions",
  PACKAGE_JSON_FILE: "./package.json",
  BASH_SCRIPT_PREFIX: "cleanup-docker-",
  BASH_SCRIPT_SUFFIX: "-old-images.sh",
  MS_PER_DAY: 24 * 60 * 60 * 1000,
  REGISTRY_URL: "ghcr.io",
  PROTECTED_TAGS: ["latest", "main"],
}

// Custom logger for easier future upgrades
const logger = {
  log: (message) => console.log(message),
  warn: (message) => console.log(`WARNING: ${message}`),
  error: (message) => console.error(message),
}

// Parse command line arguments and determine image details
const parseArgs = () => {
  const argv = process.argv.slice(2)
  let owner = argv[0]
  let imageName = argv[1]
  const keepLatestMajor = argv.includes("--keep-latest-major-releases")
  const forceCleanup = argv.includes("--force")

  if (!owner || owner.startsWith("--")) {
    owner = undefined
  }
  if (!imageName || imageName.startsWith("--")) {
    imageName = undefined
  }

  if (!owner || !imageName) {
    logger.error(
      "Usage: assets/ci_cleanup_docker_images.js <owner> <image-name> [--keep-latest-major-releases] [--force]",
    )
    logger.error("Example: assets/ci_cleanup_docker_images.js oleksandrkucherenko obsidian-mcp")
    process.exit(1)
  }

  return { owner, imageName, keepLatestMajor, forceCleanup }
}

// Fetch package versions from GitHub Container Registry using GitHub CLI
const fetchPackageVersions = (owner, imageName) => {
  try {
    logger.log(`Fetching package versions for ${CONFIG.REGISTRY_URL}/${owner}/${imageName}`)

    // Use GitHub CLI to list package versions
    const output = execSync(`gh api --paginate "/users/${owner}/packages/container/${imageName}/versions" --jq '.[]'`, {
      encoding: "utf-8",
    })

    if (!output.trim()) {
      logger.log(`No versions found for package '${imageName}'. Exiting without error.`)
      process.exit(0)
    }

    // Parse JSON lines
    const versions = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .map((v) => {
        // Extract tags from metadata if available
        const tags = v.metadata?.container?.tags || []

        return {
          id: v.id,
          version: v.name || "untagged",
          createdAt: new Date(v.created_at),
          updatedAt: new Date(v.updated_at),
          tags: tags,
          hasProtectedTag: tags.some((tag) => CONFIG.PROTECTED_TAGS.includes(tag)),
        }
      })

    return versions
  } catch (e) {
    if (e.status === 404) {
      logger.log(`Package '${imageName}' does not exist for owner '${owner}'. Exiting without error.`)
    } else {
      logger.error(`Error fetching package data: ${e.message}`)
      logger.error("Make sure you have GitHub CLI installed and authenticated with proper permissions.")
    }
    process.exit(0)
  }
}

// Process version entries and validate package data
const processVersionEntries = (versions, owner, imageName) => {
  if (versions.length === 0) {
    logger.log(`No published versions found for package '${owner}/${imageName}'. Exiting without error.`)
    process.exit(0)
  }

  // Filter out 'untagged' versions and sort descending by creation time (newest first)
  const taggedVersions = versions
    .filter((v) => v.version !== "untagged")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return taggedVersions
}

// Load and parse .keep-docker-versions file
const loadKeepVersionsFile = () => {
  const result = {
    exactKeep: [],
    patternKeep: [],
    exactNegative: [],
    patternNegative: [],
  }

  try {
    const keepFile = readFileSync(CONFIG.KEEP_VERSIONS_FILE, "utf-8")
    const lines = keepFile
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))

    for (const line of lines) {
      const isNegative = line.startsWith("!")
      const version = isNegative ? line.slice(1) : line

      if (version.includes("*")) {
        const regexStr = `^${version.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`
        const pattern = new RegExp(regexStr)

        if (isNegative) {
          result.patternNegative.push(pattern)
        } else {
          result.patternKeep.push(pattern)
        }
      } else {
        if (isNegative) {
          result.exactNegative.push(version)
        } else {
          result.exactKeep.push(version)
        }
      }
    }

    // Log what was found
    if (result.exactKeep.length > 0) {
      logger.log(`Keeping additional exact versions: ${result.exactKeep.join(", ")}`)
    }
    if (result.patternKeep.length > 0) {
      logger.log(`Keeping versions matching patterns: ${result.patternKeep.length} pattern(s)`)
    }
    if (result.exactNegative.length > 0) {
      logger.log(`Explicitly NOT keeping exact versions: ${result.exactNegative.join(", ")}`)
    }
    if (result.patternNegative.length > 0) {
      logger.log(`Explicitly NOT keeping versions matching patterns: ${result.patternNegative.length} pattern(s)`)
    }
  } catch (e) {
    // File does not exist or unreadable; ignore
  }

  return result
}

// Get latest version for each major release
const getLatestPerMajor = (versionEntries) => {
  const byMajor = {}
  for (const v of versionEntries) {
    const match = v.version.match(/^v?(\d+)\./)
    if (match) {
      const major = match[1]
      if (!byMajor[major] || v.createdAt > byMajor[major].createdAt) {
        byMajor[major] = v
      }
    }
  }
  return Object.values(byMajor).map((v) => v.version)
}

// Check if version matches any patterns
const matchesAnyPattern = (version, patterns) => {
  return patterns.some((pattern) => pattern.test(version))
}

// Build final set of versions to keep
const buildKeepVersionsSet = (versionEntries, keepFileData, latestPerMajor) => {
  const { exactKeep, patternKeep, exactNegative, patternNegative } = keepFileData

  // Get versions with protected tags (latest, main)
  const protectedVersions = versionEntries.filter((v) => v.hasProtectedTag).map((v) => v.version)

  if (protectedVersions.length > 0) {
    logger.log(
      `Found ${protectedVersions.length} versions with protected tags (${CONFIG.PROTECTED_TAGS.join(", ")}) that will be kept`,
    )
  }

  // Start with latest versions + additional exact keeps + latest per major + protected tag versions
  const allKeepVersions = new Set([
    ...versionEntries.slice(0, CONFIG.KEEP_LATEST_COUNT).map((v) => v.version),
    ...exactKeep,
    ...latestPerMajor,
    ...protectedVersions,
  ])

  // Add versions that match keep patterns
  for (const entry of versionEntries) {
    if (matchesAnyPattern(entry.version, patternKeep)) {
      allKeepVersions.add(entry.version)
    }
  }

  // Remove negatives, but only if they're not in exact keep list or match keep patterns
  const shouldKeep = (version) => {
    if (exactKeep.includes(version)) return true
    return matchesAnyPattern(version, patternKeep)
  }

  // Process exact negatives
  for (const v of exactNegative) {
    if (!shouldKeep(v)) {
      allKeepVersions.delete(v)
    }
  }

  // Process pattern negatives
  if (patternNegative.length > 0) {
    const toRemove = [...allKeepVersions].filter(
      (version) => !shouldKeep(version) && matchesAnyPattern(version, patternNegative),
    )

    for (const version of toRemove) {
      allKeepVersions.delete(version)
    }
  }

  return allKeepVersions
}

// Compute which versions should be deleted
const computeVersionsToDelete = (versionEntries, allKeepVersions, forceCleanup = false) => {
  const now = Date.now()
  const thresholdMs = CONFIG.DAYS_TO_CLEANUP * CONFIG.MS_PER_DAY
  const thresholdDate = new Date(now - thresholdMs)

  return versionEntries
    .filter((v) => forceCleanup || v.createdAt < thresholdDate) // In force mode, ignore age threshold
    .filter((v) => !allKeepVersions.has(v.version))
    .sort((a, b) => a.createdAt - b.createdAt) // ascending order: oldest first
}

// Generate bash script content
const generateBashScript = (owner, imageName, versionsToDelete, versionSummary) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    `# Autogenerated script to cleanup old Docker images for: ${CONFIG.REGISTRY_URL}/${owner}/${imageName}`,
    "set -euo pipefail",
    "",
    `echo "Starting cleanup for Docker image ${CONFIG.REGISTRY_URL}/${owner}/${imageName}"`,
    `echo "Using GitHub CLI to delete package versions"`,
    "",
  ]

  for (const version of versionsToDelete) {
    const tagInfo = version.tags && version.tags.length > 0 ? ` with tags: ${version.tags.join(", ")}` : ``
    bashLines.push(
      `echo "Deleting ${CONFIG.REGISTRY_URL}/${owner}/${imageName}:${version.version}${tagInfo} (ID: ${version.id})"`,
      `gh api --method DELETE "/users/${owner}/packages/container/${imageName}/versions/${version.id}" || echo "Failed to delete version ${version.version}"`,
      "",
    )
  }

  bashLines.push("")
  for (const line of versionSummary) {
    bashLines.push(`echo "${line}"`)
  }

  bashLines.push('echo "\\nDocker image cleanup process completed."')

  return bashLines.join("\n")
}

// Generate version summary for output
const generateVersionSummary = (
  versionEntries,
  latestPerMajor,
  allKeepVersions,
  keepLatestMajor,
  versionsToDelete,
  forceCleanup = false,
) => {
  const summary = []
  summary.push("=== DOCKER IMAGE VERSION SUMMARY ===")
  summary.push(`Total versions found: ${versionEntries.length}`)

  // Format version with tags if available
  const formatVersion = (v) => {
    if (!v.tags || v.tags.length === 0) return v.version
    return `${v.version} (tags: ${v.tags.join(", ")})`
  }

  summary.push(
    `Versions to keep (latest ${CONFIG.KEEP_LATEST_COUNT}): ${versionEntries
      .slice(0, CONFIG.KEEP_LATEST_COUNT)
      .map(formatVersion)
      .join(", ")}`,
  )

  if (keepLatestMajor && latestPerMajor.length > 0) {
    summary.push(`Latest per major version: ${latestPerMajor.join(", ")}`)
  }

  summary.push(`Total versions to keep: ${allKeepVersions.size}`)

  if (forceCleanup) {
    summary.push(`Versions to delete (force mode): ${versionsToDelete.length}`)
  } else {
    summary.push(`Versions older than ${CONFIG.DAYS_TO_CLEANUP} days to delete: ${versionsToDelete.length}`)
  }

  if (versionsToDelete.length > 0) {
    summary.push(
      `Oldest versions to delete: ${versionsToDelete
        .slice(0, 5)
        .map(formatVersion)
        .join(", ")}${versionsToDelete.length > 5 ? ` and ${versionsToDelete.length - 5} more` : ""}`,
    )
  }

  return summary
}

/**
 * Main function to orchestrate the Docker image cleanup process
 */
const main = async () => {
  try {
    const { owner, imageName, keepLatestMajor, forceCleanup } = parseArgs()

    // Fetch package versions from GitHub Container Registry
    const versions = fetchPackageVersions(owner, imageName)
    const versionEntries = processVersionEntries(versions, owner, imageName)

    // Support for .keep-docker-versions file
    const keepFileData = loadKeepVersionsFile()

    // Optionally keep the latest version for each major if flag is present
    let latestPerMajor = []
    if (keepLatestMajor) {
      latestPerMajor = getLatestPerMajor(versionEntries)
      if (latestPerMajor.length > 0) {
        logger.log(`Keeping latest version for each major: ${latestPerMajor.join(", ")}`)
      }
    }

    // Log if force mode is enabled
    if (forceCleanup) {
      logger.log(`Force cleanup mode enabled: will delete ALL versions not selected to keep, regardless of age.`)
    }

    // Build the set of versions to keep
    const allKeepVersions = buildKeepVersionsSet(versionEntries, keepFileData, latestPerMajor)

    // Versions to delete: if force mode, all non-kept versions; otherwise, only those older than threshold
    const versionsToDelete = computeVersionsToDelete(versionEntries, allKeepVersions, forceCleanup)

    // Generate version summary
    const versionSummary = generateVersionSummary(
      versionEntries,
      latestPerMajor,
      allKeepVersions,
      keepLatestMajor,
      versionsToDelete,
      forceCleanup,
    )

    if (versionsToDelete.length === 0) {
      if (forceCleanup) {
        logger.log(`No versions eligible for cleanup (all versions are in the keep list).`)
      } else {
        logger.log(
          `No versions eligible for cleanup (older than ${CONFIG.DAYS_TO_CLEANUP} days excluding latest ${CONFIG.KEEP_LATEST_COUNT}).`,
        )
      }

      // Print the summary to the terminal
      for (const line of versionSummary) {
        logger.log(line)
      }

      process.exit(0)
    }

    // Print the summary to the terminal
    for (const line of versionSummary) {
      logger.log(line)
    }

    // Generate bash script content
    const bashScriptContent = generateBashScript(owner, imageName, versionsToDelete, versionSummary)

    // Create output filename
    const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${owner}-${imageName}${CONFIG.BASH_SCRIPT_SUFFIX}`

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 })

    logger.log(`Bash script generated: ${outputFileName}`)
    logger.log("Run it to execute cleanup, e.g.:")
    logger.log(`  ./${outputFileName}`)
  } catch (error) {
    logger.error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
