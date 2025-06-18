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

// Parse extra flags
const argv = process.argv.slice(2)
let packageName = argv[0]
const keepLatestMajor = argv.includes("--keep-latest-major-releases")
if (!packageName || packageName.startsWith("--")) {
  // If first arg is a flag, treat as missing package name
  packageName = undefined
}
if (!packageName) {
  try {
    const pkgJson = JSON.parse(readFileSync("./package.json", "utf-8"))
    if (pkgJson.name) {
      packageName = pkgJson.name
      console.log(`No package-name argument provided. Using name from package.json: ${packageName}`)
    } else {
      throw new Error("No name field in package.json.")
    }
  } catch (err) {
    console.error(
      "Usage:assets/ci_deprecate_npm_package.js <package-name>\nOr run from a directory containing a valid package.json.",
    )
    process.exit(1)
  }
}

/**
 * If a file named .keep-versions exists in the current directory, its contents (newline-separated list)
 * will be treated as versions to always keep, even if they would otherwise be selected for deprecation.
 * Lines starting with # are treated as comments.
 */
async function main() {
  try {
    // Get `time` info from npm view
    let rawTimeJson
    let timeData = {}
    try {
      rawTimeJson = execSync(`npm view ${packageName} time --json`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      })
      timeData = JSON.parse(rawTimeJson)
    } catch (e) {
      console.log(`Package '${packageName}' does not exist on npm or was never published. Exiting without error.`)
      process.exit(0)
    }

    // Filter out non-version keys "created" and "modified"
    const versionEntries = Object.entries(timeData)
      .filter(([ver]) => ver !== "created" && ver !== "modified")
      .map(([version, time]) => ({ version, time: new Date(time) }))

    if (Object.keys(timeData).length === 0 || versionEntries.length === 0) {
      console.log(`No published versions found for package '${packageName}'. Exiting without error.`)
      process.exit(0)
    }

    // Sort descending by publish time (newest first)
    versionEntries.sort((a, b) => b.time.getTime() - a.time.getTime())

    // Last 3 versions to keep active
    const keepVersions = versionEntries.slice(0, 3).map((v) => v.version)

    // Support for .keep-versions file: additional versions to keep or explicitly NOT keep
    const additionalKeepVersions = []
    const negativeKeepVersions = []
    
    // Pattern storage - exact versions and regex patterns
    const exactKeep = []
    const patternKeep = []
    const exactNegative = []
    const patternNegative = []
    
    // Store patterns for later use
    let keepPatterns = patternKeep
    let negativePatterns = patternNegative
    
    try {
      const keepFile = readFileSync(".keep-versions", "utf-8")
      const lines = keepFile
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))

      // Process the keep-versions file

      for (const line of lines) {
        // Handle wildcards by converting them to proper regex
        // e.g. "1.*" becomes "^1\..*$"
        const isNegative = line.startsWith("!")
        const version = isNegative ? line.slice(1) : line

        if (version.includes("*")) {
          // Convert wildcard pattern to regex
          const regexStr = `^${version.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`
          const pattern = new RegExp(regexStr)

          if (isNegative) {
            patternNegative.push(pattern)
          } else {
            patternKeep.push(pattern)
          }
        } else {
          // Exact version match
          if (isNegative) {
            exactNegative.push(version)
          } else {
            exactKeep.push(version)
          }
        }
      }

      additionalKeepVersions.push(...exactKeep)

      if (additionalKeepVersions.length > 0) {
        console.log(`Keeping additional exact versions: ${additionalKeepVersions.join(", ")}`)
      }

      if (patternKeep.length > 0) {
        console.log(`Keeping versions matching patterns: ${patternKeep.length} pattern(s)`)
      }

      if (exactNegative.length > 0) {
        console.log(`Explicitly NOT keeping exact versions: ${exactNegative.join(", ")}`)
      }

      if (patternNegative.length > 0) {
        console.log(`Explicitly NOT keeping versions matching patterns: ${patternNegative.length} pattern(s)`)
      }

      // Update pattern references
      keepPatterns = patternKeep
      negativePatterns = patternNegative

      // Keep the original lists for backward compatibility
      negativeKeepVersions.push(...exactNegative)
      if (additionalKeepVersions.length > 0) {
        console.log(`Keeping additional versions from .keep-versions: ${additionalKeepVersions.join(", ")}`)
      }
      if (negativeKeepVersions.length > 0) {
        console.log(`Explicitly NOT keeping versions from .keep-versions: ${negativeKeepVersions.join(", ")}`)
      }
    } catch (e) {
      // File does not exist or unreadable; ignore
    }
    // Optionally keep the latest version for each major if flag is present
    let latestPerMajor = []
    if (keepLatestMajor) {
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
      latestPerMajor = Object.values(byMajor).map((v) => v.version)
      if (latestPerMajor.length > 0) {
        console.log(`Keeping latest version for each major: ${latestPerMajor.join(", ")}`)
      }
    }
    // Helper: Check if version matches any patterns
    const matchesAnyPattern = (version, patterns) => {
      return patterns.some((pattern) => pattern.test(version))
    }

    // Detect conflicts between keep and exclude rules
    const detectConflicts = () => {
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

      // Check if any keep pattern matches any exclude pattern (more complex check)
      // For simplicity, we'll just check if any actual version is caught by both
      const keptByPattern = versionEntries
        .filter((entry) => matchesAnyPattern(entry.version, keepPatterns))
        .map((entry) => entry.version)

      const excludedByPattern = versionEntries
        .filter((entry) => matchesAnyPattern(entry.version, negativePatterns))
        .map((entry) => entry.version)

      // Find versions that are both kept and excluded by patterns
      const patternConflicts = keptByPattern.filter((version) => excludedByPattern.includes(version))

      if (patternConflicts.length > 0) {
        conflicts.patternConflicts.push(...patternConflicts)
      }

      return conflicts
    }

    // Detect and warn about conflicts
    const conflicts = detectConflicts()
    if (conflicts.exactConflicts.length > 0) {
      console.log(
        `WARNING: Detected conflicting exact keep/exclude rules for versions: ${conflicts.exactConflicts.join(", ")}`,
      )
      console.log("Keep rules will have priority over exclude rules.")
    }

    if (conflicts.patternConflicts.length > 0) {
      console.log(
        `WARNING: Detected versions caught by both keep and exclude patterns: ${conflicts.patternConflicts.slice(0, 5).join(", ")}${conflicts.patternConflicts.length > 5 ? ` and ${conflicts.patternConflicts.length - 5} more` : ""}`,
      )
      console.log("Keep patterns will have priority over exclude patterns.")
    }

    // Build the set of versions to keep
    const allKeepVersions = new Set([...keepVersions, ...additionalKeepVersions, ...latestPerMajor])

    // First add all versions that match keep patterns
    for (const entry of versionEntries) {
      if (matchesAnyPattern(entry.version, keepPatterns)) {
        allKeepVersions.add(entry.version)
      }
    }

    // Then remove negatives, but only if they're not in the exact keep list or match keep patterns
    const shouldKeep = (version) => {
      if (exactKeep.includes(version)) return true
      return matchesAnyPattern(version, keepPatterns)
    }

    // Process exact negatives
    for (const v of negativeKeepVersions) {
      if (!shouldKeep(v)) {
        allKeepVersions.delete(v)
      }
    }

    // Process pattern negatives
    if (negativePatterns.length > 0) {
      const toRemove = [...allKeepVersions].filter(
        (version) => !shouldKeep(version) && matchesAnyPattern(version, negativePatterns),
      )

      for (const version of toRemove) {
        allKeepVersions.delete(version)
      }
    }

    // Calculate threshold date (30 days ago)
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const thresholdDate = new Date(now - thirtyDaysMs)

    // Get deprecated info for all versions
    let deprecatedMap = {}
    try {
      const deprecatedRaw = execSync(`npm view ${packageName} deprecated --json`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      })
      if (deprecatedRaw && deprecatedRaw !== "null") {
        deprecatedMap = JSON.parse(deprecatedRaw)
      }
    } catch (e) {
      // If this fails, assume no versions are deprecated
      deprecatedMap = {}
    }

    // Versions to deprecate: older than 30 days, not in keepVersions or .keep-versions, and not already deprecated
    // Sort to deprecate from oldest to youngest
    const versionsToDeprecate = versionEntries
      .filter((v) => v.time < thresholdDate)
      .filter((v) => !allKeepVersions.has(v.version))
      .filter((v) => !deprecatedMap[v.version])
      .sort((a, b) => a.time - b.time) // ascending order: oldest first
      .map((v) => v.version)

    if (versionsToDeprecate.length === 0) {
      console.log(
        "No versions eligible for deprecation (older than 30 days excluding last 3, and not already deprecated).",
      )
      process.exit(0)
    }

    // Generate bash script content
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
        `npm deprecate "${packageName}@${ver}" "Deprecated: version older than 30 days and superseded by newer releases."`,
        "",
      )
    }

    // Generate a detailed summary of versions that will be kept
    // This function creates the summary lines and returns them
    const generateVersionSummary = () => {
      const summary = ['\n=== VERSIONS REMAINING ACTIVE AFTER DEPRECATION ====']
      
      // Latest 3 versions
      const latestVersions = keepVersions.slice(0, 3)
      if (latestVersions.length > 0) {
        summary.push(`Latest 3 versions: ${latestVersions.join(', ')}`)
      }
      
      // Latest per major release (when flag is used)
      if (keepLatestMajor && latestPerMajor && latestPerMajor.length > 0) {
        const majorOnlyVersions = latestPerMajor.filter(v => !latestVersions.includes(v))
        if (majorOnlyVersions.length > 0) {
          summary.push(`Latest per major release: ${majorOnlyVersions.join(', ')}`)
        }
      }
      
      // Other versions from .keep-versions file
      const mentionedVersions = new Set([...latestVersions])
      if (keepLatestMajor && latestPerMajor) {
        for (const v of latestPerMajor) {
          mentionedVersions.add(v)
        }
      }
      
      const otherActiveVersions = [...allKeepVersions].filter(v => !mentionedVersions.has(v)).sort()
      if (otherActiveVersions.length > 0) {
        summary.push(`Other active versions: ${otherActiveVersions.join(', ')}`)
      }
      
      // Total count
      summary.push(`Total active versions: ${allKeepVersions.size}`)
      
      return summary
    }
    
    // Generate the summary
    const versionSummary = generateVersionSummary()
    
    // Print the summary to the terminal
    for (const line of versionSummary) {
      console.log(line)
    }
    
    // Add the summary to the bash script
    bashLines.push('')
    for (const line of versionSummary) {
      bashLines.push(`echo "${line}"`)
    }
    
    // Final completion message
    bashLines.push('echo "\nDeprecation process completed."')

    const bashScriptContent = bashLines.join("\n")

    const outputFileName = `deprecate-${packageName}-old-versions.sh`

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 })

    console.log(`Bash script generated: ${outputFileName}`)
    console.log("Run it to execute deprecations, e.g.:")
    console.log(`  ./${outputFileName}`)
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
