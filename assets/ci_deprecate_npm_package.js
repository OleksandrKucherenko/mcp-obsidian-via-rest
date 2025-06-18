#!/usr/bin/env node
/**
 * Script to identify npm package versions older than 30 days, excluding last 3 versions,
 * and generate a bash script to deprecate those versions automatically.
 *
 * Usage:
 *   assets/ci_deprecate_npm_package.js <package-name> [--keep-latest-major-releases]
 *
 * Node.js 22 LTS recommended.
 *
 * Options:
 *   --keep-latest-major-releases   Keep the latest version for each major (e.g., 1.x, 2.x) even if it would otherwise be deprecated.
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
const logger = {
  log: (message) => console.log(message),
  warn: (message) => console.log(`WARNING: ${message}`),
  error: (message) => console.error(message),
}

// Parse command line arguments and determine package name
const parseArgs = () => {
  const argv = process.argv.slice(2)
  let packageName = argv[0]
  const keepLatestMajor = argv.includes("--keep-latest-major-releases")

  if (!packageName || packageName.startsWith("--")) {
    packageName = undefined
  }

  if (!packageName) {
    try {
      const pkgJson = JSON.parse(readFileSync(CONFIG.PACKAGE_JSON_FILE, "utf-8"))
      if (pkgJson.name) {
        packageName = pkgJson.name
        logger.log(`No package-name argument provided. Using name from package.json: ${packageName}`)
      } else {
        throw new Error("No name field in package.json.")
      }
    } catch (err) {
      logger.error(
        "Usage:assets/ci_deprecate_npm_package.js <package-name>\nOr run from a directory containing a valid package.json.",
      )
      process.exit(1)
    }
  }

  return { packageName, keepLatestMajor }
}

// Fetch package time data from npm registry
const fetchPackageTimeData = (packageName) => {
  try {
    const rawTimeJson = execSync(`npm view ${packageName} time --json`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    return JSON.parse(rawTimeJson)
  } catch (e) {
    logger.log(`Package '${packageName}' does not exist on npm or was never published. Exiting without error.`)
    process.exit(0)
  }
}

// Process version entries and validate package data
const processVersionEntries = (timeData, packageName) => {
  const versionEntries = Object.entries(timeData)
    .filter(([ver]) => ver !== "created" && ver !== "modified")
    .map(([version, time]) => ({ version, time: new Date(time) }))

  if (Object.keys(timeData).length === 0 || versionEntries.length === 0) {
    logger.log(`No published versions found for package '${packageName}'. Exiting without error.`)
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

  // Check exact keep vs exact negative
  for (const keepVer of exactKeep) {
    if (exactNegative.includes(keepVer)) {
      conflicts.exactConflicts.push(keepVer)
    }
  }

  // Check if any keep pattern matches any exclude pattern
  const keptByPattern = versionEntries
    .filter((entry) => matchesAnyPattern(entry.version, keepPatterns))
    .map((entry) => entry.version)

  const excludedByPattern = versionEntries
    .filter((entry) => matchesAnyPattern(entry.version, negativePatterns))
    .map((entry) => entry.version)

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
const fetchDeprecatedVersions = (packageName) => {
  try {
    const deprecatedRaw = execSync(`npm view ${packageName} deprecated --json`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    return deprecatedRaw && deprecatedRaw !== "null" ? JSON.parse(deprecatedRaw) : {}
  } catch (e) {
    return {}
  }
}

// Generate version summary for output
const generateVersionSummary = (versionEntries, latestPerMajor, allKeepVersions, keepLatestMajor) => {
  const summary = ["\n=== VERSIONS REMAINING ACTIVE AFTER DEPRECATION ===="]

  // Latest versions
  const latestVersions = versionEntries.slice(0, CONFIG.KEEP_LATEST_COUNT).map((v) => v.version)
  if (latestVersions.length > 0) {
    summary.push(`Latest ${CONFIG.KEEP_LATEST_COUNT} versions: ${latestVersions.join(", ")}`)
  }

  // Latest per major release (when flag is used)
  if (keepLatestMajor && latestPerMajor && latestPerMajor.length > 0) {
    const majorOnlyVersions = latestPerMajor.filter((v) => !latestVersions.includes(v))
    if (majorOnlyVersions.length > 0) {
      summary.push(`Latest per major release: ${majorOnlyVersions.join(", ")}`)
    }
  }

  // Other versions from .keep-versions file
  const mentionedVersions = new Set([...latestVersions])
  if (keepLatestMajor && latestPerMajor) {
    for (const v of latestPerMajor) {
      mentionedVersions.add(v)
    }
  }

  const otherActiveVersions = [...allKeepVersions].filter((v) => !mentionedVersions.has(v)).sort()
  if (otherActiveVersions.length > 0) {
    summary.push(`Other active versions: ${otherActiveVersions.join(", ")}`)
  }

  // Total count
  summary.push(`Total active versions: ${allKeepVersions.size}`)

  return summary
}

// Generate bash script content
const generateBashScript = (packageName, versionsToDeprecate, versionSummary) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    `# Autogenerated script to deprecate old versions for package: ${packageName}`,
    "set -euo pipefail",
    "",
    `echo "Starting deprecation for package ${packageName}"`,
    "",
  ]

  for (const ver of versionsToDeprecate) {
    bashLines.push(
      `echo "Deprecating ${packageName}@${ver}"`,
      `npm deprecate "${packageName}@${ver}" "${CONFIG.DEPRECATION_MESSAGE}"`,
      "",
    )
  }

  bashLines.push("")
  for (const line of versionSummary) {
    bashLines.push(`echo "${line}"`)
  }

  bashLines.push('echo "\nDeprecation process completed."')

  return bashLines.join("\n")
}

// Compute which versions should be deprecated
const computeVersionsToDeprecate = (versionEntries, allKeepVersions, deprecatedMap) => {
  const now = Date.now()
  const thirtyDaysMs = CONFIG.DAYS_TO_DEPRECATE * CONFIG.MS_PER_DAY
  const thresholdDate = new Date(now - thirtyDaysMs)

  return versionEntries
    .filter((v) => v.time < thresholdDate)
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
    const { packageName, keepLatestMajor } = parseArgs()

    // Get `time` info from npm view
    const timeData = fetchPackageTimeData(packageName)
    const versionEntries = processVersionEntries(timeData, packageName)

    // Support for .keep-versions file: additional versions to keep or explicitly NOT keep
    const keepFileData = loadKeepVersionsFile()

    // Optionally keep the latest version for each major if flag is present
    let latestPerMajor = []
    if (keepLatestMajor) {
      latestPerMajor = getLatestPerMajor(versionEntries)
      if (latestPerMajor.length > 0) {
        logger.log(`Keeping latest version for each major: ${latestPerMajor.join(", ")}`)
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
      logger.warn(`Detected conflicting exact keep/exclude rules for versions: ${conflicts.exactConflicts.join(", ")}`)
      logger.log("Keep rules will have priority over exclude rules.")
    }

    if (conflicts.patternConflicts.length > 0) {
      logger.warn(
        `Detected versions caught by both keep and exclude patterns: ${conflicts.patternConflicts.slice(0, 5).join(", ")}${conflicts.patternConflicts.length > 5 ? ` and ${conflicts.patternConflicts.length - 5} more` : ""}`,
      )
      logger.log("Keep patterns will have priority over exclude patterns.")
    }

    // Build the set of versions to keep
    const allKeepVersions = buildKeepVersionsSet(versionEntries, keepFileData, latestPerMajor)

    // Get deprecated info for all versions
    const deprecatedMap = fetchDeprecatedVersions(packageName)

    // Versions to deprecate: older than 30 days, not in keepVersions or .keep-versions, and not already deprecated
    const versionsToDeprecate = computeVersionsToDeprecate(versionEntries, allKeepVersions, deprecatedMap)

    if (versionsToDeprecate.length === 0) {
      logger.log(
        "No versions eligible for deprecation (older than 30 days excluding last 3, and not already deprecated).",
      )
      process.exit(0)
    }

    // Generate version summary
    const versionSummary = generateVersionSummary(versionEntries, latestPerMajor, allKeepVersions, keepLatestMajor)

    // Print the summary to the terminal
    for (const line of versionSummary) {
      logger.log(line)
    }

    // Generate bash script content
    const bashScriptContent = generateBashScript(packageName, versionsToDeprecate, versionSummary)

    // Sanitize package name for filename (replace all '/' with '-')
    const sanitizedPackageName = packageName.replaceAll("/", "-")
    const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${sanitizedPackageName}${CONFIG.BASH_SCRIPT_SUFFIX}`

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 })

    logger.log(`Bash script generated: ${outputFileName}`)
    logger.log("Run it to execute deprecations, e.g.:")
    logger.log(`  ./${outputFileName}`)
  } catch (error) {
    logger.error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
