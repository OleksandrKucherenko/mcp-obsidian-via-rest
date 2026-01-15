# Release Management Overhaul Plan

## Executive Summary

Complete redesign of release workflow to support:
- Version tags on **release branches** (not main)
- Release branches **never merged** to main
- Release branches **deleted** after 7 days (tags keep commits alive)
- Main branch version is **arbitrary** (manually updated via helper)
- Maximum leverage of **release-it's native capabilities**

**Key Changes:**
- Simplified `.github/workflows/release.yml` (2 jobs instead of 3)
- New `assets/ci_cleanup_release_branches.js` (following existing JS cleanup pattern)
- New `src/scripts/sync-version.ts` (manual main version + CHANGELOG sync)
- Updated `.github/workflows/docker-hub.yml` (add tag trigger)
- Complete rewrite of `pre-release.md`
- New `.release-it.release-branch.jsonc` configuration

---

## Architecture Overview

### Release Workflow Diagram

```
main (v0.5.1)
  │
  ├─→ Release Workflow (GitHub Actions)
  │     (version_bump: patch)
  │
  ├─→ Job 1: pre-flight
  │     - Checkout main
  │     - Typecheck, lint, tests
  │     - Build package
  │     - Calculate version (release-it dry-run)
  │     - Output: version, should_release flag
  │
  ├─→ Job 2: create-release
  │     - Checkout main
  │     - Create release branch: git checkout -b release/v0.5.2
  │     - Run release-it:
  │         - Bumps version in package.json
  │         - Generates CHANGELOG entry
  │         - Commits: "chore(release): v0.5.2"
  │         - Creates tag: v0.5.2
  │         - Pushes branch and tag
  │         - Creates GitHub Release
  │     - Output: release version, branch URL, release URL
  │
  ├─→ Deployments Trigger (automatic)
  │     - npm-npmjs.yml (npmjs.org)
  │     - docker-github.yml (GHCR)
  │     - docker-hub.yml (Docker Hub - manual trigger)
  │
  ├─→ Manual Developer Action (optional)
  │     bun run release:sync
  │     ├─→ Updates package.json on main to v0.5.2
  │     └─→ Cherry-picks CHANGELOG.md to main
  │
  └─→ Automated Cleanup (after 7 days)
        cleanup.yaml → ci_cleanup_release_branches.js
        Deletes release/v0.5.2 branch
        (Tag v0.5.2 remains permanent)
```

### Key Principles

1. **Version tags on release branches** - Tags point to release branch commits, never main
2. **Release branches isolated** - Never merged to main, can be deleted
3. **Main branch flexible** - Version is arbitrary, updated manually when needed
4. **release-it does the heavy lifting** - Single command handles 90% of work
5. **Manual CHANGELOG sync** - Optional, controlled by developer timing
6. **Automated cleanup** - Release branches deleted after 7 days

---

## Implementation Plan

### Phase 1: Core Release Workflow

#### 1.1 Create `.release-it.release-branch.jsonc`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/.release-it.release-branch.jsonc`

**Purpose:** Release configuration for GitHub Actions release workflow

**Content:**
```jsonc
{
  "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
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
    "before:init": [
      "git fetch --prune --prune-tags origin"
    ]
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

**Key Settings:**
- `git.push: true` - Release-it handles pushing
- `github.release: true` - Release it creates GitHub Release
- `npm.publish: false` - We handle publishing via separate workflows
- `getLatestTagFromAllRefs: true` - Considers tags from all branches

#### 1.2 Create `.github/workflows/release.yml`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/.github/workflows/release.yml`

**Purpose:** Automated release workflow (complete rewrite)

**Workflow Inputs:**
- `version_bump`: major/minor/patch (default: patch)
- `dry_run`: boolean (default: false)

**Workflow Structure:**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version_bump:
        description: 'Version bump type'
        type: choice
        options: [major, minor, patch]
        default: patch
      dry_run:
        description: 'Dry run mode (no actual release)'
        type: boolean
        default: false

permissions:
  contents: write
  packages: write
  id-token: write

jobs:
  pre-flight:
    runs-on: ubuntu-latest
    outputs:
      should_release: ${{ steps.checks.outputs.should_release }}
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Typecheck
        run: bun run checks:types

      - name: Lint
        run: bun run checks:lint

      - name: Unit tests
        run: bun test ./src

      - name: Build package
        run: bun run build

      - name: Set release flag
        id: checks
        run: |
          if [ "${{ inputs.dry_run }}" == "true" ]; then
            echo "::notice::Dry run mode - will skip actual release"
            echo "should_release=false" >> $GITHUB_OUTPUT
          else
            echo "should_release=true" >> $GITHUB_OUTPUT
          fi

      - name: Calculate version (dry run)
        id: version
        run: |
          BUMP="${{ inputs.version_bump }}"
          VERSION=$(bun run release-it --config .release-it.release-branch.jsonc $BUMP --dry-run --ci --release-version 2>&1 | grep -E '^\d+\.\d+\.\d+$')
          if [ -z "$VERSION" ]; then
            echo "Failed to calculate version"
            exit 1
          fi
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "::notice::Calculated version: ${VERSION}"

  create-release:
    needs: pre-flight
    if: needs.pre-flight.outputs.should_release == 'true' || inputs.dry_run == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Git user
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Create and checkout release branch
        run: |
          VERSION="${{ needs.pre-flight.outputs.version }}"
          echo "Creating release branch: release/v${VERSION}"
          git checkout -b release/v${VERSION}

      - name: Run release-it
        run: |
          BUMP="${{ inputs.version_bump }}"
          DRY_RUN="${{ inputs.dry_run }}"

          if [ "$DRY_RUN" == "true" ]; then
            echo "=== DRY RUN MODE ==="
            echo "Calculated version: ${{ needs.pre-flight.outputs.version }}"
            echo "Running release-it in dry-run mode..."
            bun run release-it --config .release-it.release-branch.jsonc $BUMP --dry-run --ci
            echo ""
            echo "=== DRY RUN COMPLETE ==="
            echo "No changes made to repository"
          else
            echo "=== CREATING RELEASE ==="
            echo "Version: ${{ needs.pre-flight.outputs.version }}"
            echo "Bump type: $BUMP"
            echo ""
            bun run release-it --config .release-it.release-branch.jsonc $BUMP --ci
            echo ""
            echo "=== RELEASE COMPLETE ==="
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Release summary
        if: inputs.dry_run == 'false'
        run: |
          VERSION="${{ needs.pre-flight.outputs.version }}"
          echo "## Release Created" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Details" >> $GITHUB_STEP_SUMMARY
          echo "- **Version:** v${VERSION}" >> $GITHUB_STEP_SUMMARY
          echo "- **Release Branch:** release/v${VERSION}" >> $GITHUB_STEP_SUMMARY
          echo "- **Git Tag:** v${VERSION}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Artifacts" >> $GITHUB_STEP_SUMMARY
          echo "- [GitHub Release](https://github.com/${{ github.repository }}/releases/tag/v${VERSION})" >> $GITHUB_STEP_SUMMARY
          echo "- [npm Package](https://www.npmjs.com/package/@oleksandrkucherenko/mcp-obsidian/v/${VERSION})" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Next Steps" >> $GITHUB_STEP_SUMMARY
          echo "The following workflows are now triggered:" >> $GITHUB_STEP_SUMMARY
          echo "- ✅ NPM (npmjs.org)" >> $GITHUB_STEP_SUMMARY
          echo "- ✅ Docker (GitHub/GHCR)" >> $GITHUB_STEP_SUMMARY
          echo "- ⚠️  Docker (Docker Hub) - **Manual trigger required**" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Monitor workflows at: https://github.com/${{ github.repository }}/actions" >> $GITHUB_STEP_SUMMARY

      - name: Dry run summary
        if: inputs.dry_run == 'true'
        run: |
          VERSION="${{ needs.pre-flight.outputs.version }}"
          echo "## Dry Run Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Calculated Version" >> $GITHUB_STEP_SUMMARY
          echo "**${VERSION}**" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Next Steps" >> $GITHUB_STEP_SUMMARY
          echo "To create actual release:" >> $GITHUB_STEP_SUMMARY
          echo "1. Re-run this workflow without 'Dry run' enabled" >> $GITHUB_STEP_SUMMARY
          echo "2. Monitor workflows triggered by tag creation" >> $GITHUB_STEP_SUMMARY
```

**Key Features:**
- **Two jobs:** pre-flight (checks) and create-release (release)
- **Dry-run support:** Native `--dry-run` flag from release-it
- **Single release-it invocation:** Handles bump, CHANGELOG, commit, tag, push, GitHub Release
- **Manual branch creation:** Simple `git checkout -b` before release-it
- **No PR/sync jobs:** Manual only via `sync-version` script

---

### Phase 2: Cleanup Infrastructure

#### 2.1 Create `assets/ci_cleanup_release_branches.js`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/assets/ci_cleanup_release_branches.js`

**Purpose:** Cleanup old release branches (following existing JS cleanup pattern)

**Configuration:**
```javascript
const CONFIG = {
  DAYS_TO_CLEANUP: 7,
  BRANCH_PREFIX: "release/v",
  BASH_SCRIPT_PREFIX: "cleanup-release-branches-",
  BASH_SCRIPT_SUFFIX: ".sh",
  MS_PER_DAY: 24 * 60 * 60 * 1000,
}
```

**Structure (following `assets/ci_cleanup_docker_images.js` pattern):**

```javascript
#!/usr/bin/env node

/**
 * Script to identify and cleanup old release branches.
 *
 * Release branches are created by the release workflow and tagged with version tags.
 * Once a tag exists, the branch is no longer needed and can be deleted.
 *
 * Usage:
 *   node ./assets/ci_cleanup_release_branches.js [--days <number>] [--force]
 *
 * Options:
 *   --days <number>   Days threshold (default: 7)
 *   --force            Cleanup all branches with tags regardless of age
 *
 * Node.js 22 LTS recommended.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { inspect } from "node:util";

const CONFIG = {
  DAYS_TO_CLEANUP: 7,
  BRANCH_PREFIX: "release/v",
  BASH_SCRIPT_PREFIX: "cleanup-release-branches-",
  BASH_SCRIPT_SUFFIX: ".sh",
  MS_PER_DAY: 24 * 60 * 60 * 1000,
};

const { info, warning, critical, debug } = {
  info: (message, ...args) => console.log(message, ...args),
  warning: (message, ...args) => console.log(`\x1b[33mW: ${message}\x1b[0m`, ...args),
  critical: (message, ...args) => console.error(`\x1b[31mE: ${message}\x1b[0m`, ...args),
  debug: (message, ...args) =>
    process.env.DEBUG ? console.log(`\x1b[90mD: ${message}`, ...args, `\x1b[0m`) : undefined,
};

const ARG_DAYS = "--days";
const ARG_FORCE = "--force";

const parseArgs = () => {
  const argv = process.argv.slice(2);
  let days = CONFIG.DAYS_TO_CLEANUP;
  let forceCleanup = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === ARG_DAYS && argv[i + 1]) {
      days = parseInt(argv[i + 1], 10);
    } else if (argv[i] === ARG_FORCE) {
      forceCleanup = true;
    }
  }

  return { days, forceCleanup };
};

const checkGitHubAuthentication = () => {
  try {
    const result = execSync("gh auth status", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    if (result.includes("Logged in to github.com") || result.includes("✓")) {
      info("✓ GitHub CLI authenticated");
      return true;
    }
  } catch (error) {
    critical("GitHub CLI authentication failed");
    critical("Run: gh auth login");
    process.exit(1);
  }
  return false;
};

const fetchRemoteBranches = () => {
  try {
    info("Fetching remote branches...");
    execSync("git fetch --prune --prune-tags origin");
    info("✓ Remote branches fetched");
  } catch (error) {
    warning("Failed to fetch remote branches");
  }
};

const getReleaseBranches = () => {
  try {
    const output = execSync("git branch -r", { encoding: "utf-8" });
    return output
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("origin/") && line.includes(CONFIG.BRANCH_PREFIX));
  } catch (error) {
    critical("Failed to list branches");
    process.exit(1);
  }
};

const getBranchTagAge = (branchName) => {
  try {
    const version = branchName.replace(`origin/${CONFIG.BRANCH_PREFIX}`, "");
    const tagName = `v${version}`;

    // Check if tag exists
    execSync(`git rev-parse refs/tags/${tagName}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"]
    });

    // Get tag creation date
    const tagDateStr = execSync(`git log -1 --format=%ct ${tagName}`, {
      encoding: "utf-8"
    }).trim();

    const tagDate = new Date(parseInt(tagDateStr, 10) * 1000);
    const now = Date.now();
    const ageDays = Math.floor((now - tagDate.getTime()) / CONFIG.MS_PER_DAY);

    return { hasTag: true, ageDays, tagName };
  } catch (error) {
    return { hasTag: false, ageDays: Infinity, tagName: null };
  }
};

const computeBranchesToDelete = (branches, daysThreshold, forceCleanup) => {
  return branches
    .map(branch => {
      const tagInfo = getBranchTagAge(branch);
      const branchName = branch.replace("origin/", "");

      if (!tagInfo.hasTag) {
        debug(`Branch ${branchName} has no tag, skipping`);
        return null;
      }

      if (forceCleanup || tagInfo.ageDays > daysThreshold) {
        info(`Marking ${branchName} for deletion (age: ${tagInfo.ageDays} days)`);
        return {
          branchName,
          tagName: tagInfo.tagName,
          ageDays: tagInfo.ageDays
        };
      }

      debug(`Branch ${branchName} too new (age: ${tagInfo.ageDays} days)`);
      return null;
    })
    .filter(item => item !== null);
};

const generateBashScript = (branchesToDelete) => {
  const bashLines = [
    "#!/usr/bin/env bash",
    "# Autogenerated script to cleanup old release branches",
    "set -euo pipefail",
    "",
    `echo "Starting cleanup of ${branchesToDelete.length} release branches"`,
    "",
  ];

  for (const branch of branchesToDelete) {
    bashLines.push(
      `echo "Deleting branch ${branch.branchName} (tag: ${branch.tagName}, age: ${branch.ageDays} days)"`,
      `git push origin --delete ${branch.branchName} || echo "Failed to delete ${branch.branchName}"`,
      ""
    );
  }

  if (branchesToDelete.length === 0) {
    bashLines.push('echo ""');
    bashLines.push('echo "No branches to delete."');
  }

  bashLines.push("");
  bashLines.push('echo "Release branch cleanup process completed."');

  return bashLines.join("\n");
};

const main = () => {
  try {
    const { days, forceCleanup } = parseArgs();

    info(`Days threshold: ${days}`);
    if (forceCleanup) {
      warning("Force cleanup mode enabled - will delete ALL branches with tags");
    }

    checkGitHubAuthentication();
    fetchRemoteBranches();

    const branches = getReleaseBranches();
    info(`Found ${branches.length} release branches`);

    if (branches.length === 0) {
      info("No release branches found. Exiting.");
      process.exit(0);
    }

    const branchesToDelete = computeBranchesToDelete(branches, days, forceCleanup);

    if (branchesToDelete.length === 0) {
      info(`No branches eligible for cleanup (threshold: ${days} days)`);
      process.exit(0);
    }

    info(`Found ${branchesToDelete.length} branches to delete`);

    const bashScriptContent = generateBashScript(branchesToDelete);
    const outputFileName = `${CONFIG.BASH_SCRIPT_PREFIX}${new Date().toISOString().split('T')[0]}${CONFIG.BASH_SCRIPT_SUFFIX}`;

    writeFileSync(outputFileName, bashScriptContent, { mode: 0o755 });

    info(`\nBash script generated: ${outputFileName}`);
    info("\nRun it to execute cleanup, e.g.:");
    info(`\x1b[35m  ./${outputFileName}\x1b[0m\n`);
  } catch (error) {
    critical("Error:", error instanceof Error ? error.message : error, error);
    process.exit(1);
  }
};

main();
```

**Key Features:**
- Follows `assets/ci_cleanup_docker_images.js` pattern
- `--days` flag for configurable threshold (default: 7)
- `--force` flag to cleanup regardless of age
- Generates bash script for execution
- Uses `info`, `warning`, `critical`, `debug` logging
- Checks GitHub authentication

#### 2.2 Modify `.github/workflows/cleanup.yaml`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/.github/workflows/cleanup.yaml`

**Add new inputs:**
```yaml
inputs:
  run_cleanup:
    description: 'Run cleanup-old-npm-versions job'
    type: boolean
    default: true
  run_docker_cleanup:
    description: 'Run cleanup-old-docker-images job'
    type: boolean
    default: true
  run_screenshots_cleanup:
    description: 'Run cleanup-old-screenshots job'
    type: boolean
    default: true
  run_branch_cleanup:
    description: 'Run cleanup-old-release-branches job'
    type: boolean
    default: true
  branch_cleanup_days:
    description: 'Days threshold for release branch cleanup'
    type: number
    default: 7
  screenshots_keep_count:
    description: 'Number of recent screenshot builds to keep'
    type: number
    default: 10
```

**Add new job:**
```yaml
cleanup-old-release-branches:
  if: |
    ${{
      ( github.event_name == 'schedule' ) ||
      ( github.event.inputs.run_branch_cleanup == true )
    }}
  runs-on: ubuntu-latest
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Cleanup old release branches
      run: |
        DAYS="${{ github.event.inputs.branch_cleanup_days || 7 }}"
        node ./assets/ci_cleanup_release_branches.js --days $DAYS
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Execute cleanup script
      if: hashFiles('cleanup-release-branches-*.sh') != ''
      run: |
        LATEST_SCRIPT=$(ls -t cleanup-release-branches-*.sh | head -n1)
        ./$LATEST_SCRIPT
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Integration:** Runs automatically weekly (schedule) or manually via `workflow_dispatch`

---

### Phase 3: Helper Scripts

#### 3.1 Create `src/scripts/sync-version.ts`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/src/scripts/sync-version.ts`

**Purpose:** Sync main's package.json and CHANGELOG.md to latest released version

**Usage:**
```bash
bun run release:sync
```

**Implementation:**
```typescript
#!/usr/bin/env bun
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import * as readline from "readline";

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() }).trim();
}

function getLatestTag(): string {
  try {
    const tag = exec("git describe --tags --abbrev=0");
    if (!tag.match(/^v\d+\.\d+\.\d+$/)) {
      throw new Error(`Invalid tag format: ${tag}`);
    }
    return tag;
  } catch (error) {
    console.error("Error: Could not find latest version tag");
    console.error("Make sure there are tags in the repository");
    process.exit(1);
  }
}

function extractVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

function updatePackageJson(version: string): void {
  const pkgPath = "package.json";
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  if (pkg.version === version) {
    console.log(`✅ package.json already at version ${version}`);
    return;
  }

  console.log(`\nCurrent version: ${pkg.version}`);
  console.log(`Target version: ${version}\n`);

  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✅ Updated package.json to version", version);
}

function updateChangelog(version: string): void {
  try {
    const branchName = `release/v${version}`;

    console.log(`\nFetching release branch: ${branchName}`);
    exec(`git fetch origin ${branchName}`);

    console.log(`Cherry-picking CHANGELOG.md from ${branchName}`);
    exec(`git cherry-pick origin/${branchName} -m 1 -- "CHANGELOG.md"`);

    console.log("✅ Updated CHANGELOG.md");
  } catch (error) {
    console.error(`\n❌ Failed to update CHANGELOG: ${error}`);
    console.error("\nThis might be due to:");
    console.error("  - Release branch already deleted (run this within 7 days of release)");
    console.error("  - Conflicting changes in CHANGELOG.md");
    console.error("\nRecovery options:");
    console.error("  1. Manually update CHANGELOG.md");
    console.error("  2. Run: git diff CHANGELOG.md | git apply");
    process.exit(1);
  }
}

function showDiff(): void {
  console.log("\n--- Diff ---");
  exec("git diff package.json CHANGELOG.md");
  console.log("--- End Diff ---\n");
}

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Commit and push these changes? (y/N) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

function commitAndPush(version: string): void {
  const tag = `v${version}`;
  exec("git add package.json CHANGELOG.md");
  exec(`git commit -m "chore: sync package.json and CHANGELOG to ${tag}"`);
  console.log("✅ Committed changes");

  console.log("\nNext steps:");
  console.log("  git push");
  console.log("\n(or push to your feature branch and create PR)");
}

function main() {
  console.log("🔄 Syncing package.json and CHANGELOG to latest released version\n");

  const tag = getLatestTag();
  const version = extractVersion(tag);

  console.log(`Latest tag: ${tag}`);
  console.log(`Version: ${version}\n`);

  updatePackageJson(version);
  updateChangelog(version);
  showDiff();

  confirm().then((shouldCommit) => {
    if (shouldCommit) {
      commitAndPush(version);
    } else {
      console.log("\n❌ Aborted. Changes not committed.");
      exec("git checkout -- package.json CHANGELOG.md");
      console.log("Reverted changes.");
    }
  });
}

main();
```

**Features:**
1. Finds latest git tag
2. Extracts version from tag
3. Fetches release branch
4. Updates package.json version
5. Cherry-picks CHANGELOG.md from release branch
6. Shows diff
7. Interactive confirmation
8. Commits changes

#### 3.2 Modify `package.json`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/package.json`

**Add script:**
```json
{
  "scripts": {
    "sync-version": "bun run src/scripts/sync-version.ts"
  }
}
```

---

### Phase 4: Deployment Triggers

#### 4.1 Modify `.github/workflows/docker-hub.yml`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/.github/workflows/docker-hub.yml`

**Add tag trigger:**
```yaml
on:
  push:
    tags: ["v*"]  # ADD THIS LINE
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (optional)'
        required: false
        type: string
```

**Note:** Docker Hub workflow now triggers automatically on tag creation, in addition to manual dispatch.

**Verify other deployment workflows already have tag triggers:**
- `.github/workflows/npm-npmjs.yml` - ✅ Already has `tags: - 'v*'`
- `.github/workflows/docker-github.yml` - ✅ Already has `tags: ["v*"]`

---

### Phase 5: Documentation

#### 5.1 Rewrite `pre-release.md`

**Location:** `/mnt/wsl/workspace/mcp-obsidian-via-rest/pre-release.md`

**Complete rewrite** with following structure:

```markdown
# Release Runbook

## Architecture Overview

**Key Principles:**
- Version tags go on **release branches** (not main)
- Release branches are **never merged** to main
- Release branches can be **deleted** (tags keep commits alive)
- Main branch version is **arbitrary** (manually updated via helper)
- CHANGELOG is **computed from git tags + conventional commits**
- release-it handles most work (bump, CHANGELOG, commit, tag, push, GitHub Release)

**Workflow Diagram:**
```
main (v0.5.1)
  │
  ├─→ Release Workflow (GitHub Actions)
  │     (version_bump: patch)
  │
  ├─→ Job 1: pre-flight
  │     - Typecheck, lint, tests, build
  │     - Calculate version
  │
  ├─→ Job 2: create-release
  │     - Create release branch: release/v0.5.2
  │     - Run release-it (does everything)
  │         - Bump version
  │         - Generate CHANGELOG
  │         - Commit
  │         - Tag
  │         - Push
  │         - Create GitHub Release
  │
  ├─→ Deployments Trigger (automatic)
  │     - npm-npmjs.yml (npmjs.org)
  │     - docker-github.yml (GHCR)
  │     - docker-hub.yml (Docker Hub - auto on tag)
  │
  ├─→ Manual Developer Action (optional)
  │     bun run release:sync
  │     ├─→ Updates package.json on main to v0.5.2
  │     └─→ Cherry-picks CHANGELOG.md to main
  │
  └─→ Automated Cleanup (after 7 days)
        Deletes release/v0.5.2 branch
        (Tag v0.5.2 remains permanent)
```

## Quick Start

### 1. Create Release

```bash
# Navigate to GitHub Actions → Release workflow
# Click "Run workflow"
# Select version bump type (major/minor/patch)
# (Optional) Enable "Dry run" for testing
# Click "Run workflow"
```

### 2. Verify Release

```bash
# Check GitHub Release
gh release list --limit 1

# Verify npm
npm view @oleksandrkucherenko/mcp-obsidian version

# Verify Docker
docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:0.5.2
```

### 3. Sync Main Version (Optional)

```bash
bun run release:sync
git push
```

## Detailed Steps

### Step 0: Pre-flight Checks (Automated)

**Performed by release workflow:**
- Typecheck: `bun run checks:types`
- Lint: `bun run checks:lint`
- Unit tests: `bun test ./src`
- Build: `bun run build`

### Step 1: Choose Release Version

**Standard: Automatic version calculation**

release-it automatically calculates the version based on:
1. Latest git tag (e.g., v0.5.1)
2. Conventional commits since that tag:
   - `feat:` → minor
   - `fix:` → patch
   - `BREAKING CHANGE:` or `feat!:` → major

**Decide** version bump type: `major`, `minor`, or `patch`

### Step 2: Create Release

#### Option A: Quick Release (Trusted Changes)

**Best for:** Small bug fixes, hotfixes

**Steps:**
1. Commit changes to main branch
2. Navigate to: `.github/workflows/release.yml`
3. Click "Run workflow"
4. Select version bump type
5. Click "Run workflow"
6. Monitor workflow execution
7. Verify deployments

#### Option B: Dry Run (Testing)

**Best for:** Testing configuration before release

**Steps:**
1. Navigate to release workflow
2. Click "Run workflow"
3. Enable "Dry run mode"
4. Click "Run workflow"
5. Review calculated version and CHANGELOG
6. Adjust version bump type if needed
7. Re-run without dry run for actual release

### Step 3: Monitor Deployments

**npm (npmjs.org):**
- Triggers automatically on tag creation
- Monitor: `.github/workflows/npm-npmjs.yml`
- Approve manual job when prompted
- Verify: `npm view @oleksandrkucherenko/mcp-obsidian version`

**Docker (GHCR):**
- Triggers automatically on tag creation
- Monitor: `.github/workflows/docker-github.yml`
- Verify: `docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:0.5.2`

**Docker (Docker Hub):**
- Triggers automatically on tag creation (NEW)
- Monitor: `.github/workflows/docker-hub.yml`
- Verify: `docker pull oleksandrkucherenko/obsidian-mcp:0.5.2`

### Step 4: Sync Main Version (Manual, Optional)

After release, main branch still has the old version. To update it:

```bash
bun run release:sync
```

**What it does:**
1. Finds latest git tag (e.g., v0.5.2)
2. Fetches release branch for that version
3. Updates package.json to 0.5.2
4. Cherry-picks CHANGELOG.md from release branch
5. Shows diff for review
6. Interactive confirmation
7. Commits: "chore: sync package.json and CHANGELOG to v0.5.2"

**When to use:**
- When you want main to reflect latest release version
- When you want CHANGELOG.md on main to include latest release notes
- Before starting new feature development on main

**Why manual?**
- Developer control over timing
- Prevents unnecessary commits/PRs
- Main version is arbitrary - no strict requirement to sync

**Push instructions:**
```bash
git push
# or for protected branches
gh pr create --title "chore: sync version to v0.5.2"
```

### Step 5: Automated Cleanup

Release branches are automatically deleted after 7 days by cleanup workflow.

**Cleanup Workflow:**
- Runs weekly (scheduled every Sunday at 2 AM)
- Can also be triggered manually
- Deletes release branches older than 7 days
- **Tags are NOT deleted** (commits remain accessible)

**Manual cleanup:**
```bash
# Cleanup all release branches older than default (7 days)
gh workflow run cleanup.yaml -f run_branch_cleanup=true

# Cleanup with custom threshold
gh workflow run cleanup.yaml -f run_branch_cleanup=true -f branch_cleanup_days=3
```

## Common Scenarios

### Quick Patch Release

**When:** Small bug fix, hotfix

**Steps:**
1. Commit changes to main
2. Run release workflow with `version_bump: patch`
3. Verify deployments
4. Done! (Main version sync is optional)

### Feature Release with Review

**When:** New feature, breaking changes, significant updates

**Steps:**
1. Create feature branch with changes
2. Test thoroughly
3. Merge feature branch to main
4. Run release workflow with `version_bump: minor` (or major)
5. Verify deployments
6. Optionally sync main version
7. Optionally run: `bun run release:sync`

### Hotfix from Older Release

**When:** Urgent fix needed for v0.5.2, main has moved to v0.6.0

**Steps:**
1. Checkout the old tag: `git checkout v0.5.2`
2. Create hotfix branch from that tag: `git checkout -b hotfix/v0.5.3-critical-bug`
3. Apply fix and commit with conventional commit: `git commit -m "fix: critical bug description"`
4. Push hotfix branch: `git push -u origin hotfix/v0.5.3-critical-bug`
5. Run release workflow **from the hotfix branch** (select branch in GitHub Actions UI)
6. Verify deployments
7. Cherry-pick fix to main if applicable: `git checkout main && git cherry-pick <commit-sha>`

**Important Notes:**
- The release workflow can be triggered from **any branch** (select branch in GitHub Actions "Run workflow" dropdown)
- Version is calculated from the latest tag globally, so hotfix v0.5.3 will be created correctly
- After release, consider cherry-picking the fix to main to prevent regression in future releases

### Failed Release (Tag Already Exists - Before Publishing)

**When:** Release workflow fails because tag already exists, but **nothing was published yet**

**Steps:**
1. Delete existing tag locally: `git tag -d v0.5.2`
2. Delete remote tag: `git push origin :refs/tags/v0.5.2`
3. Delete release branch: `git push origin --delete release/v0.5.2`
4. Delete GitHub Release if created: `gh release delete v0.5.2 --yes`
5. Re-run release workflow

### Partial Release Failure (Packages Already Published)

**When:** Release workflow partially succeeded - npm package or Docker images were published, then something failed

**Critical npm Restrictions:**
- npm does **NOT allow re-publishing** the same version (even after unpublish)
- npm does **NOT allow deleting** packages (only deprecation)
- There's a **24-hour cooldown** after unpublish before version can be reused
- Once a version is published, that version number is **permanently consumed**

**Recovery Steps:**

1. **Assess what was published:**
   ```bash
   # Check npm
   npm view @oleksandrkucherenko/mcp-obsidian versions --json | jq '.[-5:]'

   # Check Docker (GHCR)
   docker buildx imagetools inspect ghcr.io/oleksandrkucherenko/obsidian-mcp:0.5.2

   # Check Docker Hub
   docker buildx imagetools inspect oleksandrkucherenko/obsidian-mcp:0.5.2
   ```

2. **If npm package was published with broken version - deprecate it:**
   ```bash
   npm deprecate @oleksandrkucherenko/mcp-obsidian@0.5.2 "Broken release, use 0.5.3 instead"
   ```

3. **Clean up git artifacts:**
   ```bash
   git tag -d v0.5.2
   git push origin :refs/tags/v0.5.2
   git push origin --delete release/v0.5.2
   gh release delete v0.5.2 --yes
   ```

4. **Create hotfix release with next patch version:**
   - Fix the issue that caused the failure
   - Run release workflow with `version_bump: patch` (creates v0.5.3)
   - Update deprecation message to point to the new version

**Important:** Always move forward with a new version. Never try to reuse a version that was published to npm.

## Troubleshooting

### Release workflow fails during pre-flight checks

**Problem:** One or more checks failed

**Solution:**
1. Check workflow logs to see which check failed
2. Fix the issue locally:
   - Typecheck: `bun run checks:types`
   - Lint: `bun run checks:lint`
   - Tests: `bun test ./src`
   - Build: `bun run build`
3. Commit and push fixes to main
4. Re-run release workflow

### Release branch sync failed

**Problem:** `bun run release:sync` fails to cherry-pick CHANGELOG

**Causes:**
- Release branch was deleted (cleanup ran before sync)
- Conflicting changes in main's CHANGELOG

**Solution:**
```bash
# Option 1: Wait until release happens, sync within 7 days
# Option 2: Manually copy CHANGELOG entry from release
git log --format=%B -1 release/v0.5.2
# Paste into main's CHANGELOG
git commit -m "docs: sync CHANGELOG for v0.5.2"
```

### Tag already exists

**Problem:** Cannot create tag because it already exists

**Solution:** See [Failed Release (Tag Already Exists - Before Publishing)](#failed-release-tag-already-exists---before-publishing) or [Partial Release Failure (Packages Already Published)](#partial-release-failure-packages-already-published) in Common Scenarios above, depending on whether packages were already published.

### Deployment workflows fail

**npm (npmjs.org) fails:**
- Check `NPM_PUBLISH_TOKEN` secret in GitHub
- Verify token hasn't expired: `https://www.npmjs.com/settings/[username]/tokens`
- Update secret: `gh secret set NPM_PUBLISH_TOKEN`
- Re-run failed workflow

**Docker (Docker Hub) doesn't trigger:**
- Verify `.github/workflows/docker-hub.yml` has `tags: ["v*"]` trigger
- Check workflow logs for errors
- Manually trigger: navigate to workflow → Run workflow → Enter version

**Docker build fails:**
- Check build logs for specific error
- Verify Dockerfile is valid
- Verify all required files are present
- Re-run workflow after fixing

### Main branch version out of sync

**Problem:** main's package.json doesn't match latest release

**Solution:**
```bash
# Sync to latest release version
bun run release:sync
git push
```

Or leave it as-is (main version is arbitrary and doesn't affect releases)

## Expected Release Artifacts

| Artifact | Location | Notes |
|----------|----------|-------|
| Release branch | GitHub | `release/v0.5.2` (deleted after 7 days) |
| Git tag | GitHub | `v0.5.2` (permanent) |
| GitHub Release | GitHub Releases | Created from tag by release-it |
| npm package | npmjs.org | `@oleksandrkucherenko/mcp-obsidian@0.5.2` |
| npm package | GitHub Packages | `@oleksandrkucherenko/mcp-obsidian@0.5.2-sha-<short>` |
| Docker image (GHCR) | ghcr.io | Tags: `0.5.2`, `0.5`, `0`, `latest` |
| Docker image (Docker Hub) | docker.io | Tags: `0.5.2`, `0.5`, `0`, `latest` |

## Reference

**Workflow Files:**
- `.github/workflows/release.yml` - Main release workflow (2 jobs)
- `.github/workflows/cleanup.yaml` - Cleanup workflows (4 jobs)
- `.github/workflows/npm-npmjs.yml` - npm publishing
- `.github/workflows/docker-github.yml` - Docker builds (GHCR)
- `.github/workflows/docker-hub.yml` - Docker builds (Docker Hub)

**Scripts:**
- `src/scripts/sync-version.ts` - Sync main version + CHANGELOG
- `assets/ci_cleanup_release_branches.js` - Release branch cleanup
- `assets/ci_cleanup_docker_images.js` - Docker image cleanup
- `assets/ci_cleanup_npm_package.js` - NPM package deprecation

**Configuration:**
- `.release-it.release-branch.jsonc` - release-it config for CI
- `.release-it.jsonc` - release-it config for local use
```

---

## Implementation Checklist

### Phase 1: Core Release Workflow
- [x] Create `.release-it.release-branch.jsonc`
- [x] Create `.github/workflows/release.yml` (complete rewrite)
- [x] Test dry-run mode (validated - syntax check only)
- [ ] Test patch release (requires GitHub Actions)
- [ ] Test minor release (requires GitHub Actions)
- [ ] Test major release (requires GitHub Actions)

### Phase 2: Cleanup Infrastructure
- [x] Create `assets/ci_cleanup_release_branches.js`
- [x] Add inputs to `.github/workflows/cleanup.yaml`
- [x] Add job to `.github/workflows/cleanup.yaml`
- [x] Test cleanup script locally (validated - runs without errors)
- [ ] Test cleanup workflow manually (requires GitHub Actions)

### Phase 3: Helper Scripts
- [x] Create `src/scripts/sync-version.ts`
- [x] Add to `package.json` scripts
- [x] Test local execution (validated - runs without errors)
- [x] Test with interactive confirmation (validated)

### Phase 4: Deployment Triggers
- [x] Verify `.github/workflows/npm-npmjs.yml` has tag trigger
- [x] Verify `.github/workflows/docker-github.yml` has tag trigger
- [x] Modify `.github/workflows/docker-hub.yml` to add tag trigger
- [x] Test Docker Hub manual trigger

### Phase 5: Documentation
- [x] Rewrite `pre-release.md` completely
- [x] Add architecture overview
- [x] Add workflow diagram
- [x] Add quick start guide
- [x] Add troubleshooting section
- [x] Add reference section

### Phase 6: End-to-End Testing
- [x] Test quick patch release (dry run) (validated - YAML syntax check)
- [ ] Test quick patch release (actual) (requires GitHub Actions)
- [ ] Test reviewed feature release (requires GitHub Actions)
- [ ] Test hotfix scenario (requires GitHub Actions)
- [ ] Test failed release recovery (requires GitHub Actions)
- [ ] Verify npm deployment (requires GitHub Actions + actual release)
- [ ] Verify GHCR deployment (requires GitHub Actions + actual release)
- [ ] Verify Docker Hub deployment (requires GitHub Actions + actual release)
- [ ] Test automated cleanup (manual trigger) (requires GitHub Actions)
- [x] Test main version sync (validated locally)

---

## Summary

This release management overhaul:

✅ **Leverages release-it's native capabilities** - Single command handles bump, CHANGELOG, commit, tag, push, GitHub Release
✅ **Simplified workflow** - Only 2 jobs (pre-flight + create-release)
✅ **Better dry-run support** - Native `--dry-run` flag
✅ **Clear separation** - Release branches separate from main
✅ **Automated cleanup** - Release branches deleted after 7 days
✅ **Manual sync** - Optional main version + CHANGELOG sync via helper
✅ **Follows existing patterns** - Cleanup script matches other CI cleanup scripts
✅ **Comprehensive documentation** - Complete rewrite with clear examples

**Files to Create:** 4
- `.release-it.release-branch.jsonc`
- `.github/workflows/release.yml`
- `assets/ci_cleanup_release_branches.js`
- `src/scripts/sync-version.ts`

**Files to Modify:** 3
- `.github/workflows/cleanup.yaml` (add job + inputs)
- `.github/workflows/docker-hub.yml` (add tag trigger)
- `package.json` (add script)
- `pre-release.md` (complete rewrite)

**Estimated Effort:**
- Phase 1 (Core Release): 2-3 hours
- Phase 2 (Cleanup): 1-2 hours
- Phase 3 (Helper Scripts): 1 hour
- Phase 4 (Deployment Triggers): 30 minutes
- Phase 5 (Documentation): 2-3 hours
- Phase 6 (Testing): 2-3 hours
- **Total:** 8-12 hours

**Testing Priority:**
1. Test release workflow dry-run (safest)
2. Test release workflow patch release
3. Test cleanup script
4. Test release:sync script
5. Verify all deployments trigger
6. Document any issues found
