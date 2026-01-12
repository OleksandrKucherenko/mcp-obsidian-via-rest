import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Documentation Consistency Tests
 *
 * These tests ensure that environment variables documented in CLAUDE.md
 * are actually declared in the code and vice versa.
 *
 * WHY THIS TEST EXISTS:
 * The MCP_HTTP_TOKEN variable was documented but not implemented.
 * This test parses documentation and validates against actual code declarations.
 */
describe("Documentation Consistency", () => {
  describe("Environment Variables in CLAUDE.md", () => {
    test("should declare all environment variables documented in CLAUDE.md", () => {
      // Read CLAUDE.md
      const claudeMdPath = join(process.cwd(), "CLAUDE.md")
      const claudeMd = readFileSync(claudeMdPath, "utf-8")

      // Extract environment variables from the "Environment Variables" section
      // Pattern: lines starting with - `ENV_VAR` or - `ENV_VAR` -
      const envVarPattern = /^-\s+`([A-Z_][A-Z0-9_]*)`/gm
      const documentedVars = new Set<string>()

      let match: RegExpExecArray | null
      // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
      while ((match = envVarPattern.exec(claudeMd)) !== null) {
        documentedVars.add(match[1])
      }

      // Read src/config.ts to find declared env vars in ProcessEnv interface
      const configPath = join(process.cwd(), "src", "config.ts")
      const configSource = readFileSync(configPath, "utf-8")

      // Extract ProcessEnv interface declarations
      // Pattern: ENV_VAR: string (inside ProcessEnv interface)
      const processEnvSection = configSource.match(
        /declare namespace NodeJS \{[\s\S]*?interface ProcessEnv \{([\s\S]*?)\}/,
      )?.[1]

      const declaredVars = new Set<string>()
      if (processEnvSection) {
        const varPattern = /^\s*([A-Z_][A-Z0-9_]*)\??:/gm
        let varMatch: RegExpExecArray | null
        // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
        while ((varMatch = varPattern.exec(processEnvSection)) !== null) {
          declaredVars.add(varMatch[1])
        }
      }

      // Find variables documented but not declared
      const missingDeclarations = Array.from(documentedVars).filter((v) => !declaredVars.has(v))

      // Find variables declared but not documented (less critical, but good to know)
      const missingDocumentation = Array.from(declaredVars).filter((v) => !documentedVars.has(v))

      // Report findings
      if (missingDeclarations.length > 0) {
        console.error("❌ Environment variables documented but not declared in ProcessEnv:")
        for (const v of missingDeclarations) {
          console.error(`   - ${v}`)
        }
      }

      if (missingDocumentation.length > 0) {
        console.warn("⚠️  Environment variables declared but not documented in CLAUDE.md:")
        for (const v of missingDocumentation) {
          console.warn(`   - ${v}`)
        }
      }

      // The critical assertion: all documented vars must be declared
      expect(missingDeclarations).toEqual([])
    })
  })

  describe("Environment Variables Usage in Config Module", () => {
    test("should use all declared MCP_* ProcessEnv variables in config module", () => {
      // Read src/config.ts
      const configPath = join(process.cwd(), "src", "config.ts")
      const configSource = readFileSync(configPath, "utf-8")

      // Extract ProcessEnv interface declarations
      const processEnvSection = configSource.match(
        /declare namespace NodeJS \{[\s\S]*?interface ProcessEnv \{([\s\S]*?)\}/,
      )?.[1]

      const declaredMcpVars = new Set<string>()
      if (processEnvSection) {
        const varPattern = /^\s*(MCP_[A-Z_][A-Z0-9_]*)\??:/gm
        let varMatch: RegExpExecArray | null
        // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
        while ((varMatch = varPattern.exec(processEnvSection)) !== null) {
          declaredMcpVars.add(varMatch[1])
        }
      }

      // Find all MCP_* references in the entire config.ts file
      // This includes both env.MCP_* and process.env.MCP_* patterns
      const usedVars = new Set<string>()
      const usagePattern = /(?:env|process\.env)\.(MCP_[A-Z_][A-Z0-9_]*)/g
      let usageMatch: RegExpExecArray | null
      // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
      while ((usageMatch = usagePattern.exec(configSource)) !== null) {
        usedVars.add(usageMatch[1])
      }

      // Find MCP variables declared but not used anywhere in config.ts
      const unusedVars = Array.from(declaredMcpVars).filter((v) => !usedVars.has(v))

      if (unusedVars.length > 0) {
        console.error("❌ MCP environment variables declared but not used in config.ts:")
        for (const v of unusedVars) {
          console.error(`   - ${v}`)
        }
        console.error("")
        console.error("   These variables should be read somewhere in the config module.")
      }

      // All declared MCP_* vars should be used somewhere
      expect(unusedVars).toEqual([])
    })
  })

  describe("Transport Configuration Type Fields", () => {
    test("Transport.HttpConfig should have all fields used by createHttpTransport", () => {
      // Read transport types
      const httpTransportPath = join(process.cwd(), "src", "transports", "http.transport.ts")
      const httpTransportSource = readFileSync(httpTransportPath, "utf-8")

      // Check if http.transport.ts accesses config.auth
      const usesAuth = httpTransportSource.includes("config.auth")

      if (usesAuth) {
        // Read config types to verify Transport.HttpConfig has auth field
        const configTypesPath = join(process.cwd(), "src", "config.types.ts")
        const configTypesSource = readFileSync(configTypesPath, "utf-8")

        // Find Transport.HttpConfig interface (within Transport namespace)
        // Pattern matches: "export interface HttpConfig {" or "interface HttpConfig {"
        const httpConfigMatch = configTypesSource.match(/(?:export\s+)?interface HttpConfig\s*\{([\s\S]*?)^\s*\}/m)

        let hasAuthField = false
        if (httpConfigMatch) {
          hasAuthField = httpConfigMatch[1].includes("auth")
        }

        expect(hasAuthField).toBe(true)
      }
    })
  })

  describe("README.md Examples", () => {
    test("should have matching env vars between README.md examples and implementation", () => {
      // Read README.md
      const readmePath = join(process.cwd(), "readme.md")
      const readme = readFileSync(readmePath, "utf-8")

      // Find environment variables in README examples
      const envVarPattern = /["']([A-Z_][A-Z0-9_]*)["']\s*:\s*["']|[-e]\s+([A-Z_][A-Z0-9_]*)=/g
      const readmeVars = new Set<string>()

      let match: RegExpExecArray | null
      // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
      while ((match = envVarPattern.exec(readme)) !== null) {
        const varName = match[1] || match[2]
        if (varName) {
          readmeVars.add(varName)
        }
      }

      // Read src/config.ts ProcessEnv declarations
      const configPath = join(process.cwd(), "src", "config.ts")
      const configSource = readFileSync(configPath, "utf-8")

      const processEnvSection = configSource.match(
        /declare namespace NodeJS \{[\s\S]*?interface ProcessEnv \{([\s\S]*?)\}/,
      )?.[1]

      const declaredVars = new Set<string>()
      if (processEnvSection) {
        const varPattern = /^\s*([A-Z_][A-Z0-9_]*)\??:/gm
        let varMatch: RegExpExecArray | null
        // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex exec loop
        while ((varMatch = varPattern.exec(processEnvSection)) !== null) {
          declaredVars.add(varMatch[1])
        }
      }

      // Filter to only check MCP_* and API_* variables
      const relevantReadmeVars = Array.from(readmeVars).filter((v) => v.startsWith("MCP_") || v.startsWith("API_"))

      const undeclaredVars = relevantReadmeVars.filter((v) => !declaredVars.has(v))

      if (undeclaredVars.length > 0) {
        console.error("❌ Environment variables in README.md examples but not declared:")
        for (const v of undeclaredVars) {
          console.error(`   - ${v}`)
        }
      }

      expect(undeclaredVars).toEqual([])
    })
  })
})
