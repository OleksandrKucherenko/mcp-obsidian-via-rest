#!/usr/bin/env bun
/**
 * Sync server.json version with package.json
 *
 * This script updates server.json to match the current package.json version:
 * - Root version field
 * - NPM packages: version field is updated
 * - OCI packages: version is added to identifier (e.g., ghcr.io/owner/image:1.0.0) and version field is removed
 *
 * Usage:
 *   bun run src/scripts/sync-server-version.ts
 *   bun run release:sync-server
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

interface Package {
  registryType: string
  identifier: string
  version?: string
  [key: string]: unknown
}

interface ServerJson {
  version: string
  packages: Package[]
  [key: string]: unknown
}

function getPackageVersion(): string {
  const pkgPath = resolve("package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
  return pkg.version
}

function updateServerJson(targetVersion: string): void {
  const serverJsonPath = resolve("server.json")
  const serverJson = JSON.parse(readFileSync(serverJsonPath, "utf-8")) as ServerJson

  // Update root version
  if (serverJson.version === targetVersion) {
    console.log(`✅ server.json root version already at ${targetVersion}`)
  } else {
    console.log(`📝 Updating root version: ${serverJson.version} → ${targetVersion}`)
    serverJson.version = targetVersion
  }

  // Update packages - rebuild packages array to properly remove version field from OCI packages
  const updatedPackages = serverJson.packages.map((pkg) => {
    if (pkg.registryType === "oci") {
      // OCI packages: remove version field, add version to identifier
      const baseIdentifier = pkg.identifier.split(":")[0]
      const { version, ...ociPkg } = pkg
      return { ...ociPkg, identifier: `${baseIdentifier}:${targetVersion}` }
    }
    // NPM packages: update version field
    return { ...pkg, version: targetVersion }
  })

  serverJson.packages = updatedPackages

  const npmCount = updatedPackages.filter((p) => p.registryType === "npm").length
  const ociCount = updatedPackages.filter((p) => p.registryType === "oci").length

  console.log(`✅ Updated ${npmCount} NPM package(s)`)
  console.log(`✅ Updated ${ociCount} OCI package(s)`)

  // Write back to file
  writeFileSync(serverJsonPath, `${JSON.stringify(serverJson, null, 2)}\n`)
}

function main() {
  console.log("🔄 Syncing server.json version with package.json\n")

  const targetVersion = getPackageVersion()
  console.log(`📦 Target version: ${targetVersion}\n`)

  updateServerJson(targetVersion)
  console.log("\n✅ server.json updated successfully")
}

main()
