# Release-It Configuration Files Review

## Executive Summary

This document reviews usage of `.release-it.*.jsonc` configuration files in mcp-obsidian-via-rest project. The project maintains three distinct release-it configuration files, each serving specific purposes in the release workflow.

**Assumptions:**
1. [`.release-it.jsonc`](.release-it.jsonc) - Used for local development environment only, allows developers to publish releases from local machine
2. [`.release-it.ci.jsonc`](.release-it.ci.jsonc) - Used for CI/CD pipelines
3. Both configurations should produce the same next version number when executed, ensuring consistency between local and CI/CD environments

---

## Configuration Files Overview

### 1. [`.release-it.jsonc`](.release-it.jsonc) (Local Development Configuration)

**Purpose:** Local development environment only - allows developers to publish releases from local machine

**Location:** Root directory

**Key Settings:**
```jsonc
{
  "git": {
    "commitMessage": "chore(release): v${version}",
    "tagName": "v${version}",
    "requireCleanWorkingDir": false,
    "pushRepo": "origin",
    "getLatestTagFromAllRefs": true,
    "tagMatch": "v[0-9]*\\.[0-9]*\\.[0-9]*"
  },
  "github": {
    "release": true,
    "releaseName": "Release v${version}"
  },
  "npm": {
    "publish": false
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md",
      "strictSemVer": true,
      "ignoreRecommendedBump": false
    }
  },
  "hooks": {
    "before:init": [
      "git fetch --prune --prune-tags origin",
      "npm pkg set version=$(git describe --tags --abbrev=0 | sed 's/^v//')"
    ]
  }
}
```

**Usage in package.json:**
- `release: "release-it"` - Uses this config by default
- `release:dry: "release-it --dry-run"` - Dry run with this config

**Characteristics:**
- ✅ Enables git commits, tags, and pushes
- ✅ Creates GitHub releases automatically
- ✅ Generates CHANGELOG.md from conventional commits
- ✅ Fetches latest tags before running
- ❌ **CRITICAL ISSUE:** Sets package.json version from latest tag via hook, which will cause version calculation inconsistency with CI/CD

---

### 2. [`.release-it.ci.jsonc`](.release-it.ci.jsonc) (CI/CD Configuration)

**Purpose:** CI/CD pipelines - should produce same version calculation as local config

**Location:** Root directory

**Key Settings:**
```jsonc
{
  "git": {
    "commit": false,
    "tag": false,
    "push": false,
    "requireCleanWorkingDir": false,
    "requireUpstream": false,
    "getLatestTagFromAllRefs": true,
    "tagMatch": "v[0-9]*\\.[0-9]*\\.[0-9]*"
  },
  "github": {
    "release": false
  },
  "npm": {
    "publish": false
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md",
      "strictSemVer": true,
      "ignoreRecommendedBump": false
    }
  }
}
```

**Usage in CI/CD Workflows:**
- `.github/workflows/npm-github.yml` (line 180): Used for version calculation and changelog generation
- `.github/workflows/npm-npmjs.yml` (lines 118, 131): Used for tag and branch-based changelog generation

**Usage Patterns:**

**For tag builds:**
```bash
bun run release-it --config .release-it.ci.jsonc --ci --verbose --no-increment --git.getLatestTagFromAllRefs=false
```

**For branch builds:**
```bash
bun run release-it --config .release-it.ci.jsonc --ci --verbose
```

**Characteristics:**
- ✅ Non-destructive (no git operations)
- ✅ Safe for CI environments
- ✅ Supports both tag-based and branch-based builds
- ✅ Generates CHANGELOG without modifying git state
- ✅ Does NOT create commits, tags, or GitHub releases (by design)
- ✅ Should produce same version calculation as `.release-it.jsonc`

---

### 3. [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) (Release Branch Configuration)

**Purpose:** GitHub Actions release workflow for creating releases on release branches

**Note:** This file's purpose overlaps with [`.release-it.jsonc`](.release-it.jsonc). Consider whether this configuration is needed or if `.release-it.jsonc` should be used instead.

**Location:** Root directory

**Key Settings:**
```jsonc
{
  "git": {
    "commitMessage": "chore(release): v${version}",
    "tagName": "v${version}",
    "requireCleanWorkingDir": false,
    "pushRepo": "origin",
    "getLatestTagFromAllRefs": true,
    "tagMatch": "v[0-9]*\\.[0-9]*\\.[0-9]*",
    "push": true
  },
  "github": {
    "release": true,
    "releaseName": "Release v${version}"
  },
  "npm": {
    "publish": false
  },
  "hooks": {
    "before:init": ["git fetch --prune --prune-tags origin"]
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md",
      "strictSemVer": true,
      "ignoreRecommendedBump": false
    }
  }
}
```

**Usage in CI/CD Workflows:**
- `.github/workflows/release.yml` (lines 69, 117, 126): Used for creating releases on release branches

**Usage Patterns:**

**Dry run (version calculation):**
```bash
bun run release-it --config .release-it.release-branch.jsonc $BUMP --dry-run --ci --release-version
```

**Actual release:**
```bash
bun run release-it --config .release-it.release-branch.jsonc $BUMP --ci
```

**Characteristics:**
- ✅ Creates commits, tags, and pushes
- ✅ Creates GitHub releases
- ✅ Fetches latest tags before running
- ✅ Designed for use on release branches
- ✅ Does NOT include the version sync hook from `.release-it.jsonc` (this is correct behavior)
- ⚠️ **POTENTIAL REDUNDANCY:** This configuration is nearly identical to `.release-it.jsonc`, suggesting they could be consolidated

---

## Configuration Comparison

| Setting | [`.release-it.jsonc`](.release-it.jsonc) | [`.release-it.ci.jsonc`](.release-it.ci.jsonc) | [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) |
|---------|---------------------|----------------------|-----------------------------------|
| **git.commit** | true (default) | false | true (default) |
| **git.tag** | true (default) | false | true (default) |
| **git.push** | true (default) | false | true |
| **github.release** | true | false | true |
| **npm.publish** | false | false | false |
| **getLatestTagFromAllRefs** | true | true | true |
| **requireCleanWorkingDir** | false | false | false |
| **before:init hook** | fetch + **version sync** | none | fetch only |
| **Version Calculation** | ⚠️ **INCONSISTENT** (hook resets version) | ✅ **CONSISTENT** (no hook) | ✅ **CONSISTENT** (no hook) |

---

## Usage Analysis

### Local Development

**Scenario:** Developer wants to test release locally

```bash
# Dry run
bun run release:dry

# Actual release
bun run release
```

**Configuration Used:** [`.release-it.jsonc`](.release-it.jsonc) (default)

**CRITICAL ISSUE:**
- The hook `npm pkg set version=$(git describe --tags --abbrev=0 | sed 's/^v//')` sets package.json to latest tag version **before** release-it runs
- This causes **version calculation inconsistency** between local and CI/CD environments
- Example:
  - Latest tag: `v0.5.2`
  - Local package.json: `0.5.2` (set by hook)
  - CI package.json: `0.5.1` (no hook)
  - Result: Local calculates `0.5.3`, CI calculates `0.5.2`

**Expected Behavior:**
- Both [`.release-it.jsonc`](.release-it.jsonc) and [`.release-it.ci.jsonc`](.release-it.ci.jsonc) should calculate the **same next version**
- Developer should see consistent version numbers whether running locally or in CI/CD

---

### GitHub Actions Release Workflow

**Scenario:** Creating a new release via GitHub Actions

**Workflow:** [`.github/workflows/release.yml`](.github/workflows/release.yml)

**Jobs:**
1. **pre-flight** - Calculates version using [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) with `--dry-run`
2. **create-release** - Creates actual release using [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc)

**Note:** This workflow uses [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) instead of [`.release-it.jsonc`](.release-it.jsonc), creating a third configuration file. Consider whether [`.release-it.jsonc`](.release-it.jsonc) could be used instead for consistency.

**Process:**
```bash
# Step 1: Calculate version
bun run release-it --config .release-it.release-branch.jsonc patch --dry-run --ci --release-version

# Step 2: Create release branch
git checkout -b release/v0.5.2

# Step 3: Run release-it
bun run release-it --config .release-it.release-branch.jsonc patch --ci
```

**What release-it does:**
1. Bumps version in package.json
2. Generates CHANGELOG entry
3. Commits with message "chore(release): v0.5.2"
4. Creates tag v0.5.2
5. Pushes branch and tag
6. Creates GitHub Release

---

### NPM Publishing Workflows

**Scenario:** Publishing to npm registries after release

**Workflow 1:** [`.github/workflows/npm-github.yml`](.github/workflows/npm-github.yml) (GitHub Packages)

**Usage:**
```bash
# Line 180: Calculate version for unique versioning
bun run release-it --config .release-it.ci.jsonc --dry-run --ci --no-increment
```

**Purpose:**
- Generate unique version with SHA suffix (e.g., `0.5.2-sha-abc1234`)
- Avoid conflicts when publishing to GitHub Packages from main branch

**Workflow 2:** [`.github/workflows/npm-npmjs.yml`](.github/workflows/npm-npmjs.yml) (npmjs.org)

**Usage:**

**Tag-based builds:**
```bash
# Line 118: Generate changelog for tag
bun run release-it --config .release-it.ci.jsonc --ci --verbose --no-increment --git.getLatestTagFromAllRefs=false
```

**Branch-based builds:**
```bash
# Line 131: Generate changelog for branch
bun run release-it --config .release-it.ci.jsonc --ci --verbose
```

**Purpose:**
- Generate CHANGELOG.md for published package
- Non-destructive (no git operations)
- Should produce same version calculation as local config (but doesn't due to hook issue)

---

## Findings and Issues

### Issue 1: Version Calculation Inconsistency (CRITICAL)

**Problem:** [`.release-it.jsonc`](.release-it.jsonc) has a version sync hook that causes version calculation to differ from [`.release-it.ci.jsonc`](.release-it.ci.jsonc)

**Hook in [`.release-it.jsonc`](.release-it.jsonc):**
```jsonc
"hooks": {
  "before:init": [
    "git fetch --prune --prune-tags origin",
    "npm pkg set version=$(git describe --tags --abbrev=0 | sed 's/^v//')"
  ]
}
```

**Impact:**
- Local releases reset package.json to latest tag **before** release-it calculates the next version
- CI releases do NOT have this behavior
- **Version numbers differ** between local and CI workflows, violating the consistency requirement

**Example Scenario:**
```
Latest tag: v0.5.2
Current package.json: 0.5.1

Local execution (.release-it.jsonc):
  1. Hook runs: npm pkg set version=0.5.2 (sets to latest tag)
  2. release-it calculates: 0.5.3 (bumps from 0.5.2)

CI execution (.release-it.ci.jsonc):
  1. No hook runs
  2. release-it calculates: 0.5.2 (bumps from 0.5.1)

Result: Local = 0.5.3, CI = 0.5.2 ❌ INCONSISTENT
```

**Recommendation:**
- **Remove version sync hook** from [`.release-it.jsonc`](.release-it.jsonc)
- Let release-it handle version bumping naturally from package.json
- If version sync is needed, use `release:sync` script instead
- This ensures both configs produce the same next version number

---

### Issue 2: Configuration Redundancy

**Problem:** [`.release-it.jsonc`](.release-it.jsonc) and [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) serve nearly identical purposes

**Evidence:**
- Both enable git commits, tags, pushes, and GitHub releases
- Both use conventional-changelog plugin with same settings
- Only difference: [`.release-it.jsonc`](.release-it.jsonc) has version sync hook (which should be removed)
- CI workflows use [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) instead of [`.release-it.jsonc`](.release-it.jsonc)

**Recommendation:**
- **Consolidate to single configuration** for local/CI releases
- Use [`.release-it.jsonc`](.release-it.jsonc) as the authoritative config for both local and CI releases
- Remove [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) and update workflows to use [`.release-it.jsonc`](.release-it.jsonc)
- Keep [`.release-it.ci.jsonc`](.release-it.ci.jsonc) for non-destructive CI operations

---

### Issue 3: Missing Documentation on Configuration Purpose

**Problem:** No clear documentation explaining when to use each configuration file

**Questions:**
- When should a developer use [`.release-it.jsonc`](.release-it.jsonc) locally?
- What is the difference between [`.release-it.ci.jsonc`](.release-it.ci.jsonc) tag vs. branch usage?
- Why does [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) exist separately from [`.release-it.jsonc`](.release-it.jsonc)?
- How do I ensure version consistency between local and CI/CD?

**Recommendation:**
- Add inline comments to each configuration file explaining its purpose
- Create a "Release Configuration Guide" document
- Update [`pre-release.md`](pre-release.md) with configuration usage examples
- Document the version consistency requirement explicitly

---

### Issue 4: npm.publish Setting Clarity

**Problem:** All three configurations have `"npm": { "publish": false }` but this is not documented

**Impact:**
- release-it never publishes to npm directly
- Publishing is handled by separate workflows
- This is intentional but not documented

**Recommendation:**
- Add comment explaining why npm.publish is false
- Document separate npm publishing workflows
- Consider adding `npm.skipPublish: true` for clarity

---

## Recommendations

### High Priority

1. **Fix Version Calculation Inconsistency (CRITICAL)**
   - Remove `npm pkg set version=$(git describe --tags --abbrev=0 | sed 's/^v//')` hook from [`.release-it.jsonc`](.release-it.jsonc)
   - Ensure both [`.release-it.jsonc`](.release-it.jsonc) and [`.release-it.ci.jsonc`](.release-it.ci.jsonc) calculate the same next version
   - Test version calculation locally and in CI to verify consistency
   - This directly addresses the requirement: "both versions of configuration should produce the same next version number"

2. **Consolidate to Single Configuration**
   - Remove [`.release-it.ci.jsonc`](.release-it.ci.jsonc) and [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc)
   - Update all CI workflows to use [`.release-it.jsonc`](.release-it.jsonc) with CLI overrides
   - Keep [`.release-it.jsonc`](.release-it.jsonc) as the single source of truth for all scenarios
   - Use CLI flags (`--no-git`, `--no-github`, `--no-npm`, `--ci`, etc.) for different use cases

3. **Add Inline Documentation**
   - Add purpose comments to each configuration file
   - Document usage patterns with examples
   - Explain key settings and their rationale
   - Explicitly state the version consistency requirement

### Medium Priority

4. **Create Configuration Guide**
   - Document when to use each CLI override
   - Provide examples for common scenarios
   - Include troubleshooting section
   - Explain version consistency requirement in detail

5. **Standardize Hook Behavior**
   - Ensure [`.release-it.jsonc`](.release-it.jsonc) has consistent hooks
   - Add `git fetch --prune --prune-tags origin` to [`.release-it.jsonc`](.release-it.jsonc)
   - Document hook execution order and purpose

6. **Add Configuration Validation**
   - Create a script to validate configuration files
   - Check for inconsistencies between configurations
   - Run validation in CI

### Low Priority

7. **Improve Error Messages**
   - Add custom error messages for common issues
   - Provide recovery steps in error output
   - Link to documentation in error messages

8. **Add Configuration Tests**
   - Unit tests for configuration parsing
   - Integration tests for release scenarios
   - Verify version calculation consistency between local and CI

---

## Proposed Configuration File Changes

### Option A: Single Configuration with CLI Overrides (RECOMMENDED)

**Keep:**
- [`.release-it.jsonc`](.release-it.jsonc) - Single source of truth for all scenarios

**Remove:**
- [`.release-it.ci.jsonc`](.release-it.ci.jsonc)
- [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc)

**Changes Required:**
1. Remove version sync hook from [`.release-it.jsonc`](.release-it.jsonc)
2. Update all CI workflows to use [`.release-it.jsonc`](.release-it.jsonc) with CLI overrides
3. Delete [`.release-it.ci.jsonc`](.release-it.ci.jsonc) and [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc)

**CLI Override Examples:**

```bash
# Local development (full release)
bun run release-it
# or
bun run release-it patch

# Local dry run
bun run release-it --dry-run

# CI non-destructive (version calculation only)
bun run release-it --no-git --no-github --no-npm --ci

# CI non-destructive (changelog generation only)
bun run release-it --no-git --no-github --no-npm --ci --no-increment

# CI release (full release)
bun run release-it --ci
```

**Benefits:**
- ✅ Single configuration file to maintain
- ✅ Version consistency guaranteed (same config for all scenarios)
- ✅ Minimal CLI tweaks for different use cases
- ✅ Clear and simple architecture
- ✅ Easier to understand and debug

**Drawbacks:**
- Slightly longer command lines in CI workflows (but still simple)

---

### Option B: Keep Three Files, Fix Issues

**Keep all three files:**
- [`.release-it.jsonc`](.release-it.jsonc) - Local development
- [`.release-it.ci.jsonc`](.release-it.ci.jsonc) - CI/CD non-destructive
- [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) - CI/CD release

**Changes Required:**
1. Remove version sync hook from [`.release-it.jsonc`](.release-it.jsonc)
2. Ensure [`.release-it.jsonc`](.release-it.jsonc) and [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) are identical
3. Add documentation explaining why three files exist

**Benefits:**
- Maintains current workflow structure
- No breaking changes to CI workflows

**Drawbacks:**
- Redundant configurations to maintain
- Higher risk of drift between files
- More complex to understand

---

## Decision Matrix

| Criteria | Option A (Single Config) | Option B (Three Files) |
|----------|----------------------|------------------------|
| **Maintainability** | Very High | Low |
| **Clarity** | Very High | Medium |
| **Breaking Changes** | Low | Low |
| **Documentation Effort** | Low | Medium |
| **CI Workflow Updates** | Medium | None |
| **Developer Experience** | Very High | Medium |
| **Version Consistency** | Very High | High (after fix) |
| **Risk of Drift** | None | High |
| **Files to Maintain** | 1 | 3 |

**Recommendation:** **Option A** - Single Configuration with CLI Overrides

This option directly addresses the core requirement (version consistency between local and CI/CD) while simplifying the configuration structure to a single file with minimal CLI tweaks for different scenarios.

---

## Next Steps

1. **Review and approve** this review document
2. **Choose an option** (A or B) for configuration consolidation
3. **Implement changes** based on chosen option
4. **Update documentation** ([`pre-release.md`](pre-release.md), [`docs/03_releases_publishing.md`](docs/03_releases_publishing.md), etc.)
5. **Test version consistency** between local and CI/CD
6. **Monitor for issues** after deployment

---

## Appendix: Configuration File Locations

| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| [`.release-it.jsonc`](.release-it.jsonc) | Single source of truth for all scenarios | [`package.json`](package.json:64) scripts, all CI workflows (after refactor) | ⚠️ Has version sync hook (causes inconsistency) |
| [`.release-it.ci.jsonc`](.release-it.ci.jsonc) | CI/CD non-destructive (TO BE REMOVED) | [`npm-github.yml`](.github/workflows/npm-github.yml:180), [`npm-npmjs.yml`](.github/workflows/npm-npmjs.yml:118,131) | ✅ Correct behavior, but redundant |
| [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) | CI/CD release (TO BE REMOVED) | [`release.yml`](.github/workflows/release.yml:69,117,126) | ✅ Correct behavior, but redundant |

---

## Appendix: Workflow File References

| Workflow | Current Configuration | Line Numbers | Target Configuration | CLI Overrides Needed |
|----------|-------------------|---------------|-------------------|-------------------|
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | [`.release-it.release-branch.jsonc`](.release-it.release-branch.jsonc) | 69, 117, 126 | [`.release-it.jsonc`](.release-it.jsonc) | `--ci` |
| [`.github/workflows/npm-github.yml`](.github/workflows/npm-github.yml) | [`.release-it.ci.jsonc`](.release-it.ci.jsonc) | 180 | [`.release-it.jsonc`](.release-it.jsonc) | `--no-git --no-github --no-npm --ci --no-increment` |
| [`.github/workflows/npm-npmjs.yml`](.github/workflows/npm-npmjs.yml) | [`.release-it.ci.jsonc`](.release-it.ci.jsonc) | 118 | [`.release-it.jsonc`](.release-it.jsonc) | `--no-git --no-github --no-npm --ci --no-increment --git.getLatestTagFromAllRefs=false` |
| [`.github/workflows/npm-npmjs.yml`](.github/workflows/npm-npmjs.yml) | [`.release-it.ci.jsonc`](.release-it.ci.jsonc) | 131 | [`.release-it.jsonc`](.release-it.jsonc) | `--no-git --no-github --no-npm --ci` |

---

## Appendix: Package.json Scripts

| Script | Command | Configuration Used | Issue |
|--------|---------|-------------------|--------|
| `release` | `release-it` | [`.release-it.jsonc`](.release-it.jsonc) (default) | Has version sync hook (to be removed) |
| `release:dry` | `release-it --dry-run` | [`.release-it.jsonc`](.release-it.jsonc) (default) | Has version sync hook (to be removed) |
| `release:sync` | `bun run src/scripts/sync-version.ts` | N/A (custom script) | No issues |

---

*Review Date: 2025-01-14*
*Reviewed By: Architect Mode*
*Project: mcp-obsidian-via-rest*
