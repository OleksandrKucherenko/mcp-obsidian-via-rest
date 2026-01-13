# Configuration Options Reference

Complete reference for `.release-it.json` configuration options.

## Git Options

```json
{
  "git": {
    "commit": true,
    "commitMessage": "chore: release v${version}",
    "commitArgs": [],
    "tag": true,
    "tagName": "v${version}",
    "tagAnnotation": "Release ${version}",
    "tagArgs": [],
    "push": true,
    "pushArgs": ["--follow-tags"],
    "pushRepo": "origin",
    "requireBranch": "main",
    "requireCleanWorkingDir": true,
    "requireCommits": true,
    "requireUpstream": true
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `commit` | `true` | Create a commit |
| `commitMessage` | `"Release ${version}"` | Commit message template |
| `tag` | `true` | Create a Git tag |
| `tagName` | `"${version}"` | Tag name template (recommend `"v${version}"`) |
| `tagAnnotation` | `"Release ${version}"` | Tag annotation |
| `tagArgs` | `[]` | Extra args for `git tag` (e.g., `["-s"]` for GPG signing) |
| `push` | `true` | Push to remote |
| `requireBranch` | `false` | Required branch name or pattern |
| `requireCleanWorkingDir` | `true` | Abort if working dir is dirty |
| `requireCommits` | `false` | Require commits since last tag |
| `requireUpstream` | `true` | Require upstream tracking branch |

## GitHub Options

```json
{
  "github": {
    "release": true,
    "releaseName": "v${version}",
    "releaseNotes": null,
    "draft": false,
    "preRelease": false,
    "autoGenerate": false,
    "assets": [],
    "host": null,
    "timeout": 0,
    "comments": {
      "submit": false,
      "issue": ":rocket: _Released in v${version}_"
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `release` | `false` | Create GitHub release |
| `releaseName` | `"Release ${version}"` | Release title |
| `releaseNotes` | `null` | Custom release notes function |
| `draft` | `false` | Create as draft release |
| `preRelease` | `false` | Mark as pre-release (auto-detected for semver pre-releases) |
| `assets` | `[]` | Glob patterns for release assets |
| `host` | `null` | GitHub Enterprise host |
| `comments.submit` | `false` | Comment on resolved issues |
| `comments.issue` | Template | Comment template for issues |

### Draft Release Workflow

Create draft, review, then publish:

```json
{ "github": { "release": true, "draft": true } }
```

Publish draft later:

```bash
release-it --no-increment --no-git --no-npm --github.update --no-github.draft
```

## NPM Options

```json
{
  "npm": {
    "publish": true,
    "publishPath": ".",
    "publishArgs": [],
    "tag": null,
    "otp": null,
    "skipChecks": false,
    "timeout": 0,
    "versionArgs": [],
    "allowSameVersion": false
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `publish` | `true` | Publish to npm |
| `publishPath` | `"."` | Path to package (for monorepos: `"dist"`) |
| `tag` | `"latest"` | npm dist-tag (`"next"`, `"beta"`, etc.) |
| `skipChecks` | `false` | Skip npm auth checks (required for OIDC) |
| `otp` | `null` | One-time password for 2FA |
| `timeout` | `0` | Timeout for npm operations (ms) |
| `publishArgs` | `[]` | Extra args for `npm publish` (e.g., `["--provenance"]`) |

### Skip npm Publishing

For non-npm projects or when only tagging:

```json
{ "npm": { "publish": false } }
```

Or use CLI: `release-it --no-npm`

## Hooks

```json
{
  "hooks": {
    "before:init": [],
    "after:init": [],
    "before:bump": [],
    "after:bump": [],
    "before:git:release": [],
    "after:git:release": [],
    "before:github:release": [],
    "after:github:release": [],
    "before:npm:release": [],
    "after:npm:release": [],
    "before:release": [],
    "after:release": []
  }
}
```

### Hook Examples

**Quality gates before release:**

```json
{
  "hooks": {
    "before:init": ["npm run lint", "npm test", "npm run build"]
  }
}
```

**Build after version bump:**

```json
{
  "hooks": {
    "after:bump": "npm run build"
  }
}
```

**Notifications after release:**

```json
{
  "hooks": {
    "after:release": "echo 'Released ${name} v${version}' | slack-notify"
  }
}
```

### Available Template Variables

| Variable | Description |
|----------|-------------|
| `${version}` | New version |
| `${latestVersion}` | Previous version |
| `${changelog}` | Generated changelog |
| `${name}` | Package name |
| `${repo.owner}` | Repository owner |
| `${repo.repository}` | Repository name |

## Plugins Configuration

### Conventional Changelog

```json
{
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": {
        "name": "conventionalcommits",
        "types": [
          { "type": "feat", "section": "Features" },
          { "type": "fix", "section": "Bug Fixes" },
          { "type": "perf", "section": "Performance" },
          { "type": "docs", "section": "Documentation", "hidden": false },
          { "type": "refactor", "section": "Refactoring", "hidden": true }
        ]
      },
      "infile": "CHANGELOG.md",
      "header": "# Changelog",
      "ignoreRecommendedBump": false
    }
  }
}
```

Version bump mapping:
- `feat:` → minor
- `fix:` → patch
- `feat!:` or `BREAKING CHANGE:` → major

### Bumper Plugin (Non-npm Projects)

For projects with version in non-standard files:

```json
{
  "plugins": {
    "@release-it/bumper": {
      "in": "VERSION",
      "out": ["VERSION", "composer.json", "pubspec.yaml"]
    }
  }
}
```

## Full Production Example

```json
{
  "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}",
    "requireBranch": "main",
    "requireCleanWorkingDir": true,
    "requireCommits": true
  },
  "github": {
    "release": true,
    "releaseName": "v${version}",
    "assets": ["dist/*.zip"]
  },
  "npm": {
    "publish": true,
    "publishArgs": ["--provenance"]
  },
  "hooks": {
    "before:init": [
      "git fetch --prune --prune-tags origin",
      "npm run lint",
      "npm test"
    ],
    "after:bump": "npm run build"
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "conventionalcommits",
      "infile": "CHANGELOG.md"
    }
  }
}
```
