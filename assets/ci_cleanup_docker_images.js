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
import { readFileSync, writeFileSync } from "node:fs"
import process from "node:process"
import { inspect } from "node:util"

// Configuration constants
const CONFIG = {
  DAYS_TO_CLEANUP: 15,
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
const { info, warning, critical, debug } = {
  info: (message, ...args) => console.log(message, ...args),
  warning: (message, ...args) => console.log(`\x1b[33mW: ${message}\x1b[0m`, ...args),
  critical: (message, ...args) => console.error(`\x1b[31mE: ${message}\x1b[0m`, ...args),
  debug: (message, ...args) =>
    process.env.DEBUG ? console.log(`\x1b[90mD: ${message}`, ...args, `\x1b[0m`) : undefined,
}

const ARG_KEEP_LATEST_MAJOR = "--keep-latest-major-releases"
const ARG_FORCE = "--force"
const requiredScopes = ["read:packages", "delete:packages"]

// Parse command line arguments and determine image details
const parseArgs = () => {
  const argv = process.argv.slice(2)
  let owner = argv[0]
  let imageName = argv[1]
  const keepLatestMajor = argv.includes(ARG_KEEP_LATEST_MAJOR)
  const forceCleanup = argv.includes(ARG_FORCE)

  if (!owner || owner.startsWith("--")) {
    owner = undefined
  }
  if (!imageName || imageName.startsWith("--")) {
    imageName = undefined
  }

  if (!owner || !imageName) {
    critical("Usage: assets/ci_cleanup_docker_images.js <owner> <image-name> [--keep-latest-major-releases] [--force]")
    critical("Example: assets/ci_cleanup_docker_images.js oleksandrkucherenko obsidian-mcp")
    critical("Example: assets/ci_cleanup_docker_images.js oleksandrkucherenko obsidian-vnc --force")
    process.exit(1)
  }

  return { owner, imageName, keepLatestMajor, forceCleanup }
}

// Check if the current GitHub token has required scopes
const checkRequiredScopes = () => {
  const isCI = process.env.CI
  const hasEnvGithubToken = !!process.env.GITHUB_TOKEN

  if (hasEnvGithubToken) {
    warning("Detected GITHUB_TOKEN in environment. This will override GitHub CLI (gh) authentication logic.")
    warning("If you experience authentication errors, try unsetting GITHUB_TOKEN or ensure it has sufficient scopes.")
  }

  try {
    // Get current token scopes using curl
    const execOptions = { encoding: "utf-8", stdio: "pipe" }
    const result = execSync(
      'curl -s -I -H "Authorization: token $(gh auth token)" https://api.github.com/user | grep ^x-oauth-scopes',
      execOptions,
    )

    if (!result.trim()) {
      warning("Could not retrieve token scopes - proceeding anyway")
      return true
    }

    // Extract scopes from header: "x-oauth-scopes: scope1, scope2, scope3"
    const scopesMatch = result.match(/x-oauth-scopes:\s*(.+)/i)
    if (!scopesMatch) {
      warning("Could not parse token scopes - proceeding anyway")
      return true
    }

    const currentScopes = scopesMatch[1].split(",").map((s) => s.trim())
    const missingScopes = requiredScopes.filter((scope) => !currentScopes.includes(scope))

    if (missingScopes.length === 0) {
      info(`✓ Token has all required scopes: ${requiredScopes.join(", ")}`)
      return true
    }

    // Missing scopes detected
    warning(`Missing required scopes: ${missingScopes.join(", ")}`)
    warning(`Current scopes: ${currentScopes.join(", ")}`)
    warning(`Required scopes: ${requiredScopes.join(", ")}`)

    if (isCI) {
      warning(`Running in CI mode - ensure GITHUB_TOKEN has ${requiredScopes.join(", ")} scopes`)
      warning("You can create a token at: https://github.com/settings/tokens")
      process.exit(1)
    }

    warning("Please re-authenticate with the required scopes:")
    warning(`  gh auth login --scopes "${requiredScopes.join(",")}"`)
    warning("Or create a new token with the required scopes and export it as GITHUB_TOKEN")
    warning("You can create a token at: https://github.com/settings/tokens")
    warning("If you have GITHUB_TOKEN set, try unsetting it and using gh auth login for CLI-based workflows.")
    process.exit(1)
  } catch (error) {
    // If scope check fails, warn but proceed
    warning(`Warning: Could not verify token scopes: ${error.message}`)
    warning("Proceeding anyway - will handle scope errors if they occur")
    return false
  }
}

// Check GitHub CLI authentication early
const checkGitHubAuthentication = () => {
  const isCI = process.env.CI
  const hasEnvGithubToken = !!process.env.GITHUB_TOKEN

  if (hasEnvGithubToken) {
    warning("Detected GITHUB_TOKEN in environment. This will override GitHub CLI (gh) authentication logic.")
    debug("If you experience authentication errors, try unsetting GITHUB_TOKEN or ensure it has sufficient scopes.")
    debug("  unset GITHUB_TOKEN")
    debug(`  gh auth login --scopes "${requiredScopes.join(",")}"`)
  }

  try {
    // Try to get current user to verify authentication
    const result = execSync("gh auth status", {
      encoding: "utf-8",
      stdio: "pipe", // Capture both stdout and stderr
    })

    info("✓ GitHub CLI status captured, verifying scopes...")

    // Check if authenticated
    if (result.includes("Logged in to github.com") || result.includes("✓")) {
      // Authentication successful, now check scopes
      checkRequiredScopes()
      return true
    }
  } catch (error) {
    // gh auth status failed, check what kind of error
    const errorMessage = error.message || error.stderr || ""

    // CI mode, no user interaction possible
    if (isCI) {
      critical("GitHub CLI authentication failed for github.com.")
      warning("Running in CI mode - ensure GITHUB_TOKEN is properly set")
      warning(`The GITHUB_TOKEN must have ${requiredScopes.join(", ")} permissions`)
      warning(`Use link to create a new token if needed: https://github.com/settings/tokens`)
      process.exit(1)
    }

    // Parse for authentication failures
    const failedRegex = /Failed to log in/m

    if (failedRegex.test(errorMessage)) {
      critical("GitHub CLI authentication failed for github.com.")

      if (hasEnvGithubToken) {
        warning("GITHUB_TOKEN in environment may be invalid or insufficient.")
        warning("To resolve:")
        warning("  1. Unset GITHUB_TOKEN (unset GITHUB_TOKEN) and re-run gh auth login.")
        debug("  unset GITHUB_TOKEN")
        warning(`  2. Or, create a new token with ${requiredScopes.join(", ")} scopes.`)
        debug(`  gh auth login --scopes "${requiredScopes.join(",")}"`)
      }
    }

    // You are not logged into any GitHub hosts
    const notLoggedInRegex = /You are not logged into any GitHub hosts/m

    if (notLoggedInRegex.test(errorMessage)) {
      critical("You are not logged into any GitHub hosts.")
      debug("To resolve:")
      debug(`  gh auth login --scopes "${requiredScopes.join(",")}"`)
    }

    // Some other error - let it fall through to the main error handling
    critical(`Could not verify GitHub CLI authentication`)
    debug(errorMessage)
    process.exit(1)
  }

  return false
}

// Request a new Github Token
const _refreshGithubToken = () => {
  // if CI mode, unset GITHUB_TOKEN and re-run gh auth login
  if (process.env.CI) {
    warning("Detected CI mode - unsetting GITHUB_TOKEN and re-running gh auth login")
    debug("unset GITHUB_TOKEN")
    debug(`gh auth login --scopes "${requiredScopes.join(",")}"`)
    return false
  }

  try {
    // Create a clean environment without GITHUB_TOKEN for the refresh command
    const cleanEnv = { ...process.env }
    cleanEnv.GITHUB_TOKEN = undefined

    const execOptions = { encoding: "utf-8", stdio: "inherit", env: cleanEnv }
    execSync(`gh auth refresh --scopes "${requiredScopes.join(",")}"`, execOptions)

    info("Authentication token refreshed successfully")
    return true // Indicate that retry should be attempted
  } catch (refreshError) {
    critical(`Failed to refresh authentication: ${refreshError.message}`)
    process.exit(1)
  }
}

// Fetch package versions from GitHub Container Registry using GitHub CLI
const fetchPackageVersions = (owner, imageName) => {
  try {
    info(`Fetching package versions for \x1b[34m${CONFIG.REGISTRY_URL}/${owner}/${imageName}\x1b[0m`)

    // Use GitHub CLI to list package versions
    const execOptions = { encoding: "utf-8" }
    const output = execSync(
      `gh api --paginate "/users/${owner}/packages/container/${imageName}/versions" --jq '.[]'`,
      execOptions,
    )

    if (!output.trim()) {
      info(`No versions found for package '${imageName}'. Exiting without error.`)
      process.exit(0)
    }

    // Parse JSON lines
    const data = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))

    const taggedVersions = data
      .filter((v) => v.metadata?.container?.tags?.length > 0)
      .flatMap((v) => {
        // Extract tags from metadata if available
        const tags = v.metadata?.container?.tags || []

        return tags.slice(0, 1).map((tag) => ({
          id: v.id,
          version: tag,
          digest: v.name,
          createdAt: new Date(v.created_at),
          updatedAt: new Date(v.updated_at),
          tags: tags,
          hasProtectedTag: tags.some((tag) => CONFIG.PROTECTED_TAGS.includes(tag)),
        }))
      })

    const untaggedVersions = data
      .filter((v) => !v.metadata?.container?.tags?.length)
      .map((v) => ({
        id: v.id,
        version: "untagged",
        digest: v.name,
        createdAt: new Date(v.created_at),
        updatedAt: new Date(v.updated_at),
        tags: [],
        hasProtectedTag: false,
      }))

    debug(
      `versions:`,
      inspect(
        {
          tagged: taggedVersions.map(({ version, tags }) => ({ v: version, tags })),
          totalUntagged: untaggedVersions.length,
        },
        { depth: null },
      ),
    )

    return [...taggedVersions, ...untaggedVersions]
  } catch (e) {
    if (e.status === 404) {
      info(`Package '${imageName}' does not exist for owner '${owner}'. Exiting without error.`)
    } else {
      critical(`Error fetching package data: ${e.message}`)
      critical("Make sure you have GitHub CLI installed and authenticated with proper permissions.")
    }
    process.exit(0)
  }
}

// Extract version manifest from GitHub Container Registry to detect related to one version untagged images
const extractVersionManifest = (owner, imageName, version) => {
  /* 
  We execute (narrow format):
  curl -H "Authorization: Bearer $(curl -s "https://ghcr.io/token?service=ghcr.io&scope=repository:oleksandrkucherenko/obsidian-mcp:pull" | jq -r .token)" \
     -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
     https://ghcr.io/v2/oleksandrkucherenko/obsidian-mcp/manifests/main

  We execute (wide format):
  curl -H "Authorization: Bearer $(curl -s "https://ghcr.io/token?service=ghcr.io&scope=repository:oleksandrkucherenko/obsidian-vnc:pull" | jq -r .token)" \
     -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json" \
     https://ghcr.io/v2/oleksandrkucherenko/obsidian-vnc/manifests/sha-6262db0     
  */

  try {
    const tokenCmd = `curl -s "https://ghcr.io/token?service=ghcr.io&scope=repository:${owner}/${imageName}:pull" | jq -r .token`
    const accepts = [
      "application/vnd.oci.image.index.v1+json",
      "application/vnd.docker.distribution.manifest.list.v2+json",
      "application/vnd.docker.distribution.manifest.v2+json",
    ]
    const url = `https://ghcr.io/v2/${owner}/${imageName}/manifests/${version}`
    const cmd = `curl -H "Authorization: Bearer $(${tokenCmd})" -H "Accept: ${accepts.join(",")}" ${url}`

    const execOptions = { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    const output = execSync(cmd, execOptions)

    // debug(`extractVersionManifest output:`, inspect(output, { depth: null }))

    const data = JSON.parse(output)

    if (data.errors) {
      warning(`Error during fetching the ${owner}/${imageName}:${version} data: ${data.errors[0].message}`)
      warning(`Command: ${cmd}`)
      return []
    }

    //debug(`extractVersionManifest data:`, inspect(data, { depth: null, compact: true }))
    info(`extracted manifest for ${owner}/${imageName}:${version}`)

    return data
  } catch (error) {
    warning(`Error fetching ${owner}/${imageName}:${version} data: ${error.message}`)
  }
}

// Process version entries and validate package data
const processVersionEntries = (versions, owner, imageName) => {
  if (versions.length === 0) {
    info(`No published versions found for package '${owner}/${imageName}'. Exiting without error.`)
    process.exit(0)
  }

  warning(`Manifests extractions can take some time, please be patient...`)

  // Filter out 'untagged' versions and sort descending by creation time (newest first)
  const taggedVersions = versions
    .filter((v) => v.version !== "untagged")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((v) => ({ ...v, manifest: extractVersionManifest(owner, imageName, v.version) }))

  // debug(`taggedVersions:`, inspect(taggedVersions, { depth: null }))

  // find versions that stay untagged and not mensioned in manifest's
  const lookup = new Set()
  for (const v of taggedVersions) {
    for (const m of v.manifest?.manifests || []) {
      lookup.add(m.digest)
    }
    lookup.add(v.digest)
  }

  const noMatch = versions.filter((v) => !lookup.has(v.digest))

  debug(
    `noMatch:`,
    inspect(
      noMatch.map((v) => v.digest),
      { depth: null },
    ),
  )

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
      debug(`Keeping additional exact version(s): ${result.exactKeep.join(", ")}`)
    }
    if (result.patternKeep.length > 0) {
      debug(`Keeping versions matching pattern(s):`, inspect(result.patternKeep))
    }
    if (result.exactNegative.length > 0) {
      debug(`NOT explicitly keeping exact version(s): ${result.exactNegative.join(", ")}`)
    }
    if (result.patternNegative.length > 0) {
      debug(`NOT explicitly keeping versions matching pattern(s):`, inspect(result.patternNegative))
    }
  } catch (_e) {
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
    info(
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
const generateBashScript = ({ owner, imageName, versionsToDelete, versionSummary, versions }) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    `# Autogenerated script to cleanup old Docker images for: ${CONFIG.REGISTRY_URL}/${owner}/${imageName}`,
    "set -euo pipefail",
    "",
    `echo "Starting cleanup for Docker image ${CONFIG.REGISTRY_URL}/${owner}/${imageName}"`,
    `echo "Using GitHub CLI to delete package versions"`,
    "",
  ]

  const findIdByDigest = (digest) => versions.find((v) => v.digest === digest)?.id

  const api = `/users/${owner}/packages/container/${imageName}/versions`
  const fullImageName = `${CONFIG.REGISTRY_URL}/${owner}/${imageName}`

  for (const v of versionsToDelete) {
    const tagInfo = v.tags && v.tags.length > 0 ? ` with tags: ${v.tags.join(", ")}` : ``
    // debug(`version:`, inspect(v, { depth: null }))

    const manifests = v.manifest?.manifests
      .map((m) => ({ ...m, id: findIdByDigest(m.digest) }))
      .map((m) => `gh api --method DELETE "${api}/${m.id}" || echo "Failed to delete manifest ${m.digest}"`)

    bashLines.push(
      `echo "Deleting ${fullImageName}:${v.version}${tagInfo} (ID: ${v.id})"`,
      `gh api --method DELETE "${api}/${v.id}" || echo "Failed to delete version ${v.version}"`,
      ...manifests,
      "",
    )
  }

  if (versionsToDelete.length === 0) {
    bashLines.push('echo ""')
    bashLines.push('echo "All versions are current - no deletion needed."')
  }

  bashLines.push("")
  for (const line of versionSummary) {
    bashLines.push(`echo "${line}"`)
  }

  bashLines.push('echo ""')
  bashLines.push('echo "Docker image cleanup process completed."')

  return bashLines.join("\n")
}

// Generate version summary for output
const generateVersionSummary = ({
  versionEntries,
  latestPerMajor,
  allKeepVersions,
  keepLatestMajor,
  versionsToDelete,
  forceCleanup = false,
}) => {
  const summary = []
  // summary.push("=== DOCKER IMAGE VERSION SUMMARY ===")
  summary.push(`Total versions found: ${versionEntries.length}`)

  // Format version with tags if available
  const formatVersion = (v) => {
    if (!v.tags || v.tags.length === 0 || (v.tags[0] === v.version && v.tags.length === 1)) return v.version
    return `${v.version} (tags: ${v.tags.join(", ")})`
  }

  summary.push(
    `Latest ${CONFIG.KEEP_LATEST_COUNT} version(s): ${versionEntries
      .slice(0, CONFIG.KEEP_LATEST_COUNT)
      .map(formatVersion)
      .join(", ")}`,
  )

  if (keepLatestMajor && latestPerMajor.length > 0) {
    summary.push(`Latest per major version: ${latestPerMajor.join(", ")}`)
  }

  summary.push(`Total versions to keep: ${[...allKeepVersions].sort().join(", ")}`)

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

    // Check GitHub CLI authentication early before making any API calls
    checkGitHubAuthentication()

    if (forceCleanup) {
      warning("Force flag detected: Will mark ALL versions for deprecation regardless of age")
    }

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
        info(`Keeping latest version for each major: ${latestPerMajor.join(", ")}`)
      }
    }

    // Log if force mode is enabled
    if (forceCleanup) {
      info(`Force cleanup mode enabled: will delete ALL versions not selected to keep, regardless of age.`)
    }

    // Build the set of versions to keep
    const allKeepVersions = buildKeepVersionsSet(versionEntries, keepFileData, latestPerMajor)

    // Versions to delete: if force mode, all non-kept versions; otherwise, only those older than threshold
    const versionsToDelete = computeVersionsToDelete(versionEntries, allKeepVersions, forceCleanup)

    // Generate version summary
    const versionSummary = generateVersionSummary({
      versionEntries,
      latestPerMajor,
      allKeepVersions,
      keepLatestMajor,
      versionsToDelete,
      forceCleanup,
    })

    if (versionsToDelete.length === 0) {
      warning(
        forceCleanup
          ? `No versions eligible for cleanup (all versions are in the keep list).`
          : `No versions eligible for cleanup (older than ${CONFIG.DAYS_TO_CLEANUP} days excluding latest ${CONFIG.KEEP_LATEST_COUNT}).`,
      )
    }

    // Print the summary to the terminal
    info("")
    for (const line of versionSummary) {
      info("| ", line)
    }

    // Generate bash script content
    const bashScriptContent = generateBashScript({
      owner,
      imageName,
      versionsToDelete,
      versionSummary,
      versions,
    })

    // Create output filename
    const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${owner}-${imageName}${CONFIG.BASH_SCRIPT_SUFFIX}`

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 })

    info(`\nBash script generated: ${outputFileName}`)
    info("\nRun it to execute cleanup, e.g.:")
    info(`\x1b[35m  ./${outputFileName}\x1b[0m\n`)
  } catch (error) {
    critical("Error:", error instanceof Error ? error.message : error, error)
    process.exit(1)
  }
}

main()
