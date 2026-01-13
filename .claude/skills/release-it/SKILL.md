---
name: release-it
description: "Automate versioned releases of NPM packages to GitHub repositories. Use this skill when setting up or configuring release-it for version bumping, changelog generation, npm publishing, GitHub releases, and CI/CD integration. Triggers include requests to: (1) Set up automated releases for an npm package, (2) Configure release-it for a project, (3) Create GitHub Actions workflows for releases, (4) Set up conventional commits with changelog generation, (5) Configure pre-release versioning (alpha/beta/rc), (6) Troubleshoot release-it issues."
---

# Release-It Skill

Automate NPM package versioning, changelog generation, and publishing with release-it.

## Core Workflow Overview

Setting up release-it involves these steps:

1. Install release-it and plugins
2. Create configuration file (`.release-it.json`)
3. Configure Git and GitHub settings
4. Set up changelog generation (optional but recommended)
5. Create GitHub Actions workflow for CI/CD
6. Configure authentication (NPM_TOKEN or OIDC)

## Step 1: Installation

```bash
# Recommended: interactive setup
npm init release-it

# Manual installation
npm install --save-dev release-it
npm install --save-dev @release-it/conventional-changelog  # Optional: for changelogs
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "release": "release-it",
    "release:dry": "release-it --dry-run",
    "release:ci": "release-it --ci"
  }
}
```

**Requirement:** Node.js 20 or higher for release-it v19+.

## Step 2: Configuration File

Create `.release-it.json` in project root. See [references/config-options.md](references/config-options.md) for all options.

### Minimal Configuration

```json
{
  "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}"
  },
  "github": {
    "release": true
  },
  "npm": {
    "publish": true
  }
}
```

### Production Configuration (Recommended)

```json
{
  "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}",
    "requireBranch": "main",
    "requireCleanWorkingDir": true,
    "requireCommits": true,
    "requireUpstream": true
  },
  "github": {
    "release": true,
    "releaseName": "v${version}"
  },
  "npm": {
    "publish": true
  },
  "hooks": {
    "before:init": ["npm run lint", "npm test"],
    "after:bump": "npm run build"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": {
        "name": "conventionalcommits",
        "types": [
          { "type": "feat", "section": "Features" },
          { "type": "fix", "section": "Bug Fixes" },
          { "type": "perf", "section": "Performance" }
        ]
      },
      "infile": "CHANGELOG.md",
      "header": "# Changelog"
    }
  }
}
```

## Step 3: GitHub Actions Workflow

Create `.github/workflows/release.yml`. See [references/github-actions.md](references/github-actions.md) for complete examples.

### Standard Workflow (Token-Based Auth)

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      release-type:
        description: 'Release type (patch, minor, major)'
        required: false

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # CRITICAL: Required for changelog generation

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Release
        run: |
          if [ -n "${{ github.event.inputs.release-type }}" ]; then
            npm run release -- ${{ github.event.inputs.release-type }} --ci
          else
            npm run release -- --ci
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### OIDC Authentication (Recommended for Security)

For npm Trusted Publishing without long-lived tokens:

1. Configure trusted publisher at npmjs.com → Package Settings
2. Update config: `"npm": { "skipChecks": true }`
3. Use workflow with `id-token: write` permission

```yaml
permissions:
  contents: write
  id-token: write

steps:
  # ... checkout and setup ...
  - run: npm install -g npm@latest  # OIDC requires npm >= 11.5.1
  - run: npx release-it --ci
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      # NPM_TOKEN not needed with OIDC
```

## Step 4: NPM Authentication Setup

### For Token-Based Auth

Create `.npmrc` in project root:

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Generate automation token at npmjs.com → Access Tokens → Generate New Token → Automation.

### For Scoped Packages

Add to `package.json`:

```json
{
  "name": "@myorg/my-package",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

## Semantic Versioning Commands

```bash
release-it patch      # 1.2.3 → 1.2.4
release-it minor      # 1.2.3 → 1.3.0
release-it major      # 1.2.3 → 2.0.0

# Pre-releases
release-it major --preRelease=beta     # 1.3.0 → 2.0.0-beta.0
release-it --preRelease                # 2.0.0-beta.0 → 2.0.0-beta.1
release-it --preRelease=rc             # 2.0.0-beta.1 → 2.0.0-rc.0
release-it major                       # 2.0.0-rc.0 → 2.0.0
```

Pre-releases automatically set npm dist-tag to the identifier (e.g., `npm install pkg@beta`).

## Lifecycle Hooks

Execute commands at specific release stages:

| Hook | Timing | Use Case |
|------|--------|----------|
| `before:init` | Before any operations | Lint, test, fetch tags |
| `after:bump` | After version bump | Build, generate assets |
| `before:release` | Before release ops | Final validation |
| `after:release` | After everything | Notifications, cleanup |

**Example:** Ensure fresh tags in CI:

```json
{
  "hooks": {
    "before:init": "git fetch --prune --prune-tags origin"
  }
}
```

## Dry Run and Debugging

```bash
release-it --dry-run        # Simulate release without changes
release-it --release-version # Print next version only
release-it --changelog       # Print changelog only
release-it -V               # Verbose: show hook output
release-it -VV              # Very verbose: show all commands
NODE_DEBUG=release-it:* release-it  # Full debug output
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Empty changelog | Use `fetch-depth: 0` in checkout action |
| Tag already exists | Add `git fetch --prune --prune-tags origin` to `before:init` hook |
| npm auth fails | Verify `NPM_TOKEN` secret or use OIDC |
| Permission denied (git push) | Ensure `contents: write` permission |
| Pre-release on wrong channel | Set `npm.tag` explicitly in config |

## Configuration Priority

1. CLI arguments (highest)
2. `.release-it.json` / `.release-it.js` / `.release-it.yaml`
3. `release-it` property in `package.json` (lowest)

## Files to Create

For a complete setup, create these files:

1. `.release-it.json` - Configuration
2. `.github/workflows/release.yml` - CI/CD workflow
3. `.npmrc` - NPM registry authentication
4. `CHANGELOG.md` - Changelog (if using conventional-changelog plugin)

## Reference Files

- [references/config-options.md](references/config-options.md) - Complete configuration reference
- [references/github-actions.md](references/github-actions.md) - GitHub Actions workflow examples
