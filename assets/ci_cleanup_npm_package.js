#!/usr/bin/env node
/**
 * Script to identify npm package versions older than 30 days, excluding last 3 versions,
 * and generate a bash script to deprecate those versions automatically.
 *
 * Usage:
 *   assets/ci_cleanup_npm_package.js <package-name> [--keep-latest-major-releases] [--force]
 *
 * Node.js 22 LTS recommended.
 *
 * Options:
 *   --keep-latest-major-releases   Keep the latest version for each major (e.g., 1.x, 2.x) even if it would otherwise be deprecated.
 *   --force                        Force cleanup of ALL versions not selected to keep, regardless of age.
 *
 * If no <package-name> is provided, the script will use the name from package.json.
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
import https from "node:https"
import { inspect } from "node:util"

// Configuration constants
const CONFIG = {
  DAYS_TO_DEPRECATE: 30,
  KEEP_LATEST_COUNT: 3,
  KEEP_VERSIONS_FILE: ".keep-versions",
  PACKAGE_JSON_FILE: "./package.json",
  BASH_SCRIPT_PREFIX: "deprecate-",
  BASH_SCRIPT_SUFFIX: "-old-versions.sh",
  DEPRECATION_MESSAGE: "Deprecated: version older than 30 days and superseded by newer releases.",
  MS_PER_DAY: 24 * 60 * 60 * 1000,
}

// Custom logger for easier future upgrades
const { info, warning, critical, debug } = {
  info: (message, ...args) => console.log(message, ...args),
  warning: (message, ...args) => console.log(`\x1b[33mW: ${message}\x1b[0m`, ...args),
  critical: (message, ...args) => console.error(`\x1b[31mE: ${message}\x1b[0m`, ...args),
  debug: (message, ...args) =>
    process.env.DEBUG ? console.log(`\x1b[90mD: ${message}`, ...args, `\x1b[0m`) : undefined,
}

// Constants for direct npm registry access
const NPMJS_REGISTRY_URL = "https://registry.npmjs.org/"

const ARG_KEEP_LATEST_MAJOR = "--keep-latest-major-releases"
const ARG_FORCE = "--force"

// Parse command line arguments and determine package name
const parseArgs = () => {
  const argv = process.argv.slice(2)
  let packageName = argv[0]
  const keepLatestMajor = argv.includes(ARG_KEEP_LATEST_MAJOR)
  const force = argv.includes(ARG_FORCE)

  if (!packageName || packageName.startsWith("--")) {
    packageName = undefined
  }

  if (!packageName) {
    try {
      const pkgJson = JSON.parse(readFileSync(CONFIG.PACKAGE_JSON_FILE, "utf-8"))
      if (pkgJson.name) {
        packageName = pkgJson.name
        info(`Using package name from package.json: \x1b[34m${packageName}\x1b[0m`)
      } else {
        throw new Error("No name field in package.json.")
      }
    } catch (err) {
      critical("Usage: assets/ci_cleanup_npm_package.js <package-name>")
      critical("Or run from a directory containing a valid package.json.")
      process.exit(1)
    }
  }

  return { packageName, keepLatestMajor, force }
}

// Get the currently configured NPM registry URL and verify if it's the expected one
const getNpmRegistryUrl = () => {
  try {
    const registryUrl = execSync("npm config get registry", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim()

    // Check if registry is the expected one
    if (registryUrl !== "https://registry.npmjs.org/") {
      warning(`Using non-standard registry: ${registryUrl}`)
      warning("This script is designed to work with the standard npmjs.org registry.")
      warning("Results may be incomplete if accessing a different registry.")
    }

    return registryUrl
  } catch (e) {
    warning("Failed to get npm registry URL, using default")
    return "https://registry.npmjs.org/" // Default NPM registry if command fails
  }
}

// Verify that we have sufficient right to modify the NPM registry
const verifyNpmTokenAccess = () => {
  try {
    execSync("npm whoami", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    info("NPM token access verified")
  } catch (e) {
    warning("Failed to verify NPM token access")
  }
}

// Check for potential npm configuration issues
const checkNpmConfiguration = () => {
  try {
    // Display detailed npm configuration for diagnostics
    info("\n=== NPM CONFIGURATION ===")
    const npmConfig = execSync("npm config list", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    info(npmConfig)

    // Look for potential issues in configuration
    if (npmConfig.includes("undefined")) {
      warning("Detected undefined values in npm config - check for missing environment variables")
    }

    if (npmConfig.includes("${")) {
      warning("Detected unresolved variable substitutions in npm config - check your .npmrc file")
    }

    // Check for scoped registry configurations that might override the default
    const scopedConfig = execSync("npm config list | grep @", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    })
      .split("\n")
      .filter((line) => line.includes("registry"))

    if (scopedConfig.length > 0) {
      warning("Detected scoped registry configurations that may override the default:")
      for (const line of scopedConfig) {
        warning(`  ${line.trim()}`)
      }
      warning("These may affect which registry is used for specific package scopes")
    }
  } catch (e) {
    warning("Failed to check npm configuration")
  }
}

// Make a direct HTTPS request to the npm registry
const makeRegistryRequest = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 404) {
          reject(new Error("Package not found (404)"))
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Unexpected status code: ${res.statusCode}`))
          return
        }

        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          try {
            const parsedData = JSON.parse(data)
            resolve(parsedData)
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`))
          }
        })
      })
      .on("error", (e) => {
        reject(new Error(`HTTPS request failed: ${e.message}`))
      })
  })
}

// Fetch package time data from npm registry
const fetchPackageTimeData = async (packageName) => {
  try {
    // Use direct HTTPS request to npmjs.org to bypass npm configuration
    const encodedPackageName = encodeURIComponent(packageName)
    const packageUrl = `${NPMJS_REGISTRY_URL}${encodedPackageName}`

    debug(`Making direct request to: ${packageUrl}`)
    const packageData = await makeRegistryRequest(packageUrl)

    if (!packageData.time) {
      info(`No time data found for package '${packageName}'. Exiting without error.`)
      process.exit(0)
    }

    return packageData.time
  } catch (e) {
    if (e.message.includes("404")) {
      error(`Package '${packageName}' does not exist on npmjs.org or was never published. Exiting without error.`)
    } else {
      error(`Error fetching package data: ${e.message}`)
    }
    process.exit(0)
  }
}

// Process version entries and validate package data
const processVersionEntries = (timeData, packageName) => {
  const versionEntries = Object.entries(timeData)
    .filter(([ver]) => ver !== "created" && ver !== "modified")
    .map(([version, time]) => ({ version, time: new Date(time) }))

  if (Object.keys(timeData).length === 0 || versionEntries.length === 0) {
    info(`No published versions found for package '${packageName}'. Exiting without error.`)
    process.exit(0)
  }

  // Sort descending by publish time (newest first)
  versionEntries.sort((a, b) => b.time.getTime() - a.time.getTime())
  return versionEntries
}

// Load and parse .keep-versions file
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
      const isWildcard = version.includes("*")

      if (isWildcard) {
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
  } catch (e) {
    // File does not exist or unreadable; ignore
  }

  return result
}

// Get latest version for each major release
const getLatestPerMajor = (versionEntries) => {
  const byMajor = {}
  for (const v of versionEntries) {
    const match = v.version.match(/^(\d+)\./)
    if (match) {
      const major = match[1]
      if (!byMajor[major] || v.time > byMajor[major].time) {
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

// Detect conflicts between keep and exclude rules
const detectConflicts = (exactKeep, exactNegative, keepPatterns, negativePatterns, versionEntries) => {
  const conflicts = {
    exactConflicts: [],
    patternConflicts: [],
  }

  //debug(`versions:`, inspect(versionEntries))

  // Check exact keep vs exact negative
  for (const keepVer of exactKeep) {
    if (exactNegative.includes(keepVer)) {
      conflicts.exactConflicts.push(keepVer)
    }
    if (matchesAnyPattern(keepVer, negativePatterns)) {
      conflicts.exactConflicts.push(keepVer)
    }
  }

  // Check if any keep pattern matches any exclude pattern
  const keptByPattern = versionEntries
    .filter((entry) => matchesAnyPattern(entry.version, keepPatterns))
    .map((entry) => entry.version)

  debug(`Keep by pattern(s):`, inspect(keptByPattern))
  for (const keepVer of keptByPattern) {
    if (exactNegative.includes(keepVer)) {
      conflicts.patternConflicts.push(keepVer)
    }
    if (matchesAnyPattern(keepVer, negativePatterns)) {
      conflicts.patternConflicts.push(keepVer)
    }
  }

  const excludedByPattern = versionEntries
    .filter((entry) => matchesAnyPattern(entry.version, negativePatterns))
    .map((entry) => entry.version)

  debug(`Exclude by pattern(s):`, inspect(excludedByPattern))

  const patternConflicts = keptByPattern.filter((version) => excludedByPattern.includes(version))
  if (patternConflicts.length > 0) {
    conflicts.patternConflicts.push(...patternConflicts)
  }

  return conflicts
}

// Build final set of versions to keep
const buildKeepVersionsSet = (versionEntries, keepFileData, latestPerMajor) => {
  const { exactKeep, patternKeep, exactNegative, patternNegative } = keepFileData

  // Start with latest versions + additional exact keeps + latest per major
  const allKeepVersions = new Set([
    ...versionEntries.slice(0, CONFIG.KEEP_LATEST_COUNT).map((v) => v.version),
    ...exactKeep,
    ...latestPerMajor,
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

// Fetch deprecated versions data
const fetchDeprecatedVersions = async (packageName) => {
  try {
    // Use direct HTTPS request to npmjs.org to bypass npm configuration
    const encodedPackageName = encodeURIComponent(packageName)
    const packageUrl = `${NPMJS_REGISTRY_URL}${encodedPackageName}`

    const packageData = await makeRegistryRequest(packageUrl)

    // Extract deprecated versions from package data
    const deprecated = {}
    if (packageData.versions) {
      for (const [version, data] of Object.entries(packageData.versions)) {
        if (data.deprecated) {
          deprecated[version] = data.deprecated
        }
      }
    }

    return deprecated
  } catch (e) {
    warning(`Failed to fetch deprecated versions: ${e.message}`)
    return {}
  }
}

// Generate version summary for output
const generateVersionSummary = (
  versionEntries,
  latestPerMajor,
  allKeepVersions,
  keepLatestMajor,
  versionsToDeprecate = [],
  force = false,
) => {
  const summary = []

  //summary.push("=== NPM PACKAGE VERSION SUMMARY ===")
  summary.push(`Total versions found: ${versionEntries.length}`)

  summary.push(
    `Latest ${CONFIG.KEEP_LATEST_COUNT} version(s): ${versionEntries
      .slice(0, CONFIG.KEEP_LATEST_COUNT)
      .map((v) => v.version)
      .join(", ")}`,
  )

  if (keepLatestMajor && latestPerMajor.length > 0) {
    summary.push(`Latest per major version: ${latestPerMajor.join(", ")}`)
  }

  // Total versions to keep (including special keep rules)
  summary.push(`Total versions to keep: ${[...allKeepVersions].sort().join(", ")}`)

  // Calculate versions to be deprecated based on age
  const now = Date.now()
  const thirtyDaysMs = CONFIG.DAYS_TO_DEPRECATE * CONFIG.MS_PER_DAY
  const thresholdDate = new Date(now - thirtyDaysMs)
  const olderThanThreshold = versionEntries.filter((v) => v.time < thresholdDate)

  if (force) {
    summary.push(`Versions to deprecate (force mode): ${versionsToDeprecate.length}`)
  } else {
    summary.push(`Versions older than ${CONFIG.DAYS_TO_DEPRECATE} days: ${olderThanThreshold.length}`)
    summary.push(`Versions older than ${CONFIG.DAYS_TO_DEPRECATE} days to deprecate: ${versionsToDeprecate.length}`)
  }

  if (versionsToDeprecate.length > 0) {
    summary.push(
      `Oldest versions to deprecate: ${versionsToDeprecate
        .slice(0, 5)
        .join(", ")}${versionsToDeprecate.length > 5 ? ` and ${versionsToDeprecate.length - 5} more` : ""}`,
    )
  }

  return summary
}

// Generate kept versions script (when no packages need deprecation)
const generateKeptVersionsScript = (packageName, versionSummary) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    `# Autogenerated report script for package: ${packageName}`,
    "set -euo pipefail",
    "",
    `echo "Package version status for ${packageName}"`,
    `echo "Using NPM registry: https://registry.npmjs.org/"`,
    `echo "Note: Using explicit registry override to ensure consistent results"`,
    "",
  ]

  for (const line of versionSummary) {
    bashLines.push(`echo "${line}"`)
  }

  bashLines.push('echo "\nAll versions are current - no deprecations needed."')

  return bashLines.join("\n")
}

// Generate bash script content
const generateBashScript = (packageName, versionsToDeprecate, versionSummary) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    `# Autogenerated script to deprecate old versions for package: ${packageName}`,
    "set -euo pipefail",
    "",
    `echo "Starting deprecation for package ${packageName}"`,
    `echo "Using NPM registry: https://registry.npmjs.org/"`,
    `echo "Note: Using explicit registry override to ensure consistent results"`,
    "",
  ]

  for (const ver of versionsToDeprecate) {
    bashLines.push(
      `echo "Deprecating ${packageName}@${ver}"`,
      `npm deprecate "${packageName}@${ver}" "${CONFIG.DEPRECATION_MESSAGE}" --registry=https://registry.npmjs.org/`,
      "",
    )
  }

  bashLines.push("")
  for (const line of versionSummary) {
    bashLines.push(`echo "${line}"`)
  }

  bashLines.push('echo "Deprecation process completed."')

  return bashLines.join("\n")
}

// Compute which versions should be deprecated
const computeVersionsToDeprecate = (versionEntries, allKeepVersions, deprecatedMap, force = false) => {
  const now = Date.now()
  const thirtyDaysMs = CONFIG.DAYS_TO_DEPRECATE * CONFIG.MS_PER_DAY
  const thresholdDate = new Date(now - thirtyDaysMs)

  let filteredVersions = versionEntries

  // Skip the age check if force flag is provided
  if (!force) {
    filteredVersions = filteredVersions.filter((v) => v.time < thresholdDate)
  }

  return filteredVersions
    .filter((v) => !allKeepVersions.has(v.version))
    .filter((v) => !deprecatedMap[v.version])
    .sort((a, b) => a.time - b.time) // ascending order: oldest first
    .map((v) => v.version)
}

/**
 * If a file named .keep-versions exists in the current directory, its contents (newline-separated list)
 * will be treated as versions to always keep, even if they would otherwise be selected for deprecation.
 * Lines starting with # are treated as comments.
 */
const main = async () => {
  try {
    const { packageName, keepLatestMajor, force } = parseArgs()

    // Get and display the NPM registry URL
    const registryUrl = getNpmRegistryUrl()
    info(`Using NPM registry: ${registryUrl}`)

    verifyNpmTokenAccess()

    if (force) {
      warning("Force flag detected: Will mark ALL versions for deprecation regardless of age")
    }

    // Check for potential npm configuration issues
    if (process.env.DEBUG) checkNpmConfiguration()

    // Get `time` info directly from npm registry
    const timeData = await fetchPackageTimeData(packageName)
    const versionEntries = processVersionEntries(timeData, packageName)

    // Support for .keep-versions file: additional versions to keep or explicitly NOT keep
    const keepFileData = loadKeepVersionsFile()

    // Optionally keep the latest version for each major if flag is present
    let latestPerMajor = []
    if (keepLatestMajor) {
      latestPerMajor = getLatestPerMajor(versionEntries)
      if (latestPerMajor.length > 0) {
        info(`Keeping latest version for each major:`, latestPerMajor.join(", "))
      }
    }

    // Detect conflicts between keep and exclude rules
    const conflicts = detectConflicts(
      keepFileData.exactKeep,
      keepFileData.exactNegative,
      keepFileData.patternKeep,
      keepFileData.patternNegative,
      versionEntries,
    )
    if (conflicts.exactConflicts.length > 0) {
      warning(`Detected conflicting exact keep/exclude rules for versions: ${conflicts.exactConflicts.join(", ")}`)
      warning("Keep rules will have priority over exclude rules.")
    }

    if (conflicts.patternConflicts.length > 0) {
      warning(
        `Detected versions caught by both keep and exclude patterns: ${conflicts.patternConflicts.slice(0, 5).join(", ")}${conflicts.patternConflicts.length > 5 ? ` and ${conflicts.patternConflicts.length - 5} more` : ""}`,
      )
      warning("Keep patterns will have priority over exclude patterns.")
    }

    // Build the set of versions to keep
    const allKeepVersions = buildKeepVersionsSet(versionEntries, keepFileData, latestPerMajor)

    // Get deprecated info for all versions
    const deprecatedMap = await fetchDeprecatedVersions(packageName)

    // Versions to deprecate: older than 30 days (or all if force flag), not in keepVersions or .keep-versions, and not already deprecated
    const versionsToDeprecate = computeVersionsToDeprecate(versionEntries, allKeepVersions, deprecatedMap, force)

    // Generate version summary
    const versionSummary = generateVersionSummary(
      versionEntries,
      latestPerMajor,
      allKeepVersions,
      keepLatestMajor,
      versionsToDeprecate,
      force,
    )

    if (versionsToDeprecate.length === 0) {
      const message = force
        ? "No versions eligible for deprecation (all versions are either kept or already deprecated)."
        : "No versions eligible for deprecation (older than 30 days excluding last 3, and not already deprecated)."
      info(message)

      // Generate kept-versions report script even when no versions need deprecation
      const keptVersionsScriptContent = generateKeptVersionsScript(packageName, versionSummary)

      // Sanitize package name for filename (replace all '/' with '-')
      const sanitizedPackageName = packageName.replaceAll("/", "-")
      const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${sanitizedPackageName}${CONFIG.BASH_SCRIPT_SUFFIX}`

      writeFileSync(outputFileName, keptVersionsScriptContent, { mode: 0o755 })

      info(`No deprecations needed, but report script generated: ${outputFileName}`)
      info("Run it to view version status, e.g.:")
      info(`  ./${outputFileName}`)
      process.exit(0)
    }

    // Version summary was already generated above

    // Print the summary to the terminal
    info("")
    for (const line of versionSummary) {
      info(`| `, line)
    }

    // Generate bash script content
    const bashScriptContent = generateBashScript(packageName, versionsToDeprecate, versionSummary)

    // Sanitize package name for filename (replace all '/' with '-')
    const sanitizedPackageName = packageName.replaceAll("/", "-")
    const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${sanitizedPackageName}${CONFIG.BASH_SCRIPT_SUFFIX}`

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 })

    info(`\nBash script generated: ${outputFileName}`)
    info("\nRun it to execute deprecations, e.g.:")
    info(`\x1b[35m  ./${outputFileName}\x1b[0m\n`)
  } catch (error) {
    error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
