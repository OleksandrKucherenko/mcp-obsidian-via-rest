# Pre-release checklist (CD runbook)

Sequential checklist for preparing a release. Follow top to bottom without branching.

## 1. Pre-flight verification

- [ ] Sync to latest main: `git fetch --prune --tags` and `git pull`
- [ ] Confirm clean working tree: `git status`
- [ ] Confirm toolchain availability: `bun --version`, `node --version`, `docker --version`
- [ ] Confirm GitHub access: `gh auth status` and `gh release list --limit 1`
- [ ] Confirm npm access: `npm whoami`
- [ ] **CRITICAL:** Verify npm token is valid (token in `.secrets/npm_registry_publish_token` must be active and not expired)
- [ ] Review `.keep-versions` to ensure the new major/minor version will be preserved by cleanup jobs
- [ ] **CRITICAL:** Verify CI workflows exist: `ls .github/workflows/*.yml`
- [ ] **CRITICAL:** Verify CI secrets are configured: `gh secret list -R OleksandrKucherenko/mcp-obsidian-via-rest`
  - Required: `NPM_PUBLISH_TOKEN` (for npmjs.org)
  - Required: `GHCR_PAT` or `GITHUB_TOKEN` (auto-provided by GitHub Actions for GHCR Docker images, but required for local run)
  - Required: `DOCKER_HUB_ACCESS_TOKEN` and `DOCKER_HUB_USERNAME` (for Docker Hub)
- [ ] **CRITICAL:** Verify CI is working: `gh run list --limit 3 -R OleksandrKucherenko/mcp-obsidian-via-rest` (last runs should be green)

## 2. Choose release version

### Standard: Automatic version calculation

- [ ] Confirm SemVer intent matches the change set:
  - Breaking changes or incompatible API/config → MAJOR
  - Backward-compatible new features → MINOR
  - Bug fixes only → PATCH
- [ ] Decide the version bump type: `major`, `minor`, or `patch`

**Note:** release-it automatically calculates the version based on:
1. Latest git tag (e.g., v0.5.1)
2. Conventional commits since that tag (feat → minor, fix → patch, BREAKING → major)

### Forced version (override automatic calculation)

Use this when you want to release a specific version that differs from release-it's calculation.

**When to use forced version:**
- You want a patch release but commits include `feat:` (release-it would suggest minor)
- You want to skip a version number (e.g., jump from 0.5.1 to 0.5.3)
- You're releasing hotfix from a different branch
- CHANGELOG should reflect manual versioning

**How to force a specific version:**

```bash
# 1. First, see what release-it would calculate automatically
bun run release:dry --ci --no-git --no-github

# 2. To force a specific version (e.g., 0.5.2 instead of calculated 0.6.0):
bun run release-it 0.5.2 --ci --no-git

# 3. Review the generated CHANGELOG and package.json
git diff CHANGELOG.md package.json

# 4. Commit and push
git add CHANGELOG.md package.json
git commit -m "chore(release): v0.5.2"
git push

# 5. Create and push tag
git tag v0.5.2
git push origin v0.5.2

# 6. Create GitHub Release
gh release create v0.5.2 --notes "Release v0.5.2"
```

**Important considerations:**
- CHANGELOG will still compare from the latest git tag (v0.5.1) to your forced version (v0.5.2)
- The CHANGELOG entry header will show `[0.5.2]` but comparison URL will be `v0.5.1...v0.5.2`
- If your forced version doesn't match commit types, consider updating CHANGELOG manually to explain why

## 3. Test locally (optional but recommended)

- [ ] Install dependencies: `bun install`
- [ ] Typecheck: `bun run checks:types`
- [ ] Lint: `bun run checks:lint`
- [ ] Unit tests: `bun test`
- [ ] Build package: `bun run build`

## 4. Create automated release

- [ ] Navigate to: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/release.yml
- [ ] Click "Run workflow"
- [ ] Select version bump type (major/minor/patch)
- [ ] (Optional) Enable dry-run mode to test without creating actual release
- [ ] Click "Run workflow"
- [ ] Monitor the workflow at: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions

**The automated workflow will:**
1. Run all pre-flight checks (typecheck, lint, tests)
2. Generate CHANGELOG with release-it
3. Bump version in package.json
4. Commit changes to main branch
5. Create and push git tag (vX.Y.Z)
6. Create GitHub Release

### Alternative: Manual release process

If the automated workflow fails, follow these manual steps:

#### Manual: Update content

- [ ] Update `CHANGELOG.md` with release notes
- [ ] Update `readme.md` and `docs/` to reflect user-visible changes
- [ ] Verify `package.json` metadata (name, version, bin, publishConfig) is correct

#### Manual: Create release

- [ ] Run the release command locally:
  ```bash
  # For patch release
  bun run release-it patch --ci --no-git

  # Or for specific version
  bun run release-it X.Y.Z --ci --no-git
  ```
- [ ] Review and commit changes:
  ```bash
  git add CHANGELOG.md package.json
  git commit -m "chore(release): vX.Y.Z"
  git push
  ```
- [ ] Create and push git tag:
  ```bash
  git tag vX.Y.Z
  git push origin vX.Y.Z
  ```
- [ ] Create GitHub Release:
  ```bash
  gh release create vX.Y.Z --notes "Release notes..."
  ```

## 5. Monitor CI/CD workflows

After publishing the GitHub Release, the following workflows trigger automatically:

### npmjs.org workflow (PRIMARY - critical)

- Workflow: `.github/workflows/npmjs-npm-publish.yml`
- [ ] Monitor workflow at: <https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions>
- [ ] Approve the "Publish to npmjs" manual job when prompted
- [ ] Verify workflow completes successfully

### GitHub Packages workflow (INFORMATIONAL ONLY)

- Workflow: `.github/workflows/npm-github.yml`
- [ ] Monitor workflow (non-blocking if it fails with "Cannot publish over existing version")

### Docker workflow (PRIMARY - critical)

- Workflow: `.github/workflows/docker-github.yml`
- [ ] Monitor workflow completes successfully

### Docker Hub workflow (PRIMARY - critical)

- Workflow: `.github/workflows/docker-hub.yml`
- [ ] Navigate to: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/docker-hub.yml
- [ ] Click "Run workflow"
- [ ] Enter version tag (optional, or leave blank for latest)
- [ ] Click "Run workflow"
- [ ] Monitor workflow completes successfully

## 8. Verify deployment

- [ ] Verify npmjs version: `npm view @oleksandrkucherenko/mcp-obsidian version`
- [ ] Verify GitHub Packages version: `npm view @oleksandrkucherenko/mcp-obsidian --registry https://npm.pkg.github.com`
- [ ] Verify GHCR tags: `docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:<tag>`
- [ ] Verify GHCR tags: `docker pull ghcr.io/oleksandrkucherenko/obsidian-vnc:<tag>`

---

## Expected release outputs

| Output | Location | Tags |
| :--- | :--- | :--- |
| Git tag | GitHub | `vX.Y.Z` |
| GitHub Release | GitHub Releases | `Release vX.Y.Z` |
| npm package | <https://www.npmjs.com/package/@oleksandrkucherenko/mcp-obsidian> | `X.Y.Z` |
| GitHub Package | GitHub Packages | `X.Y.Z-sha-<short>` |
| Docker image (GHCR) | `ghcr.io/oleksandrkucherenko/obsidian-mcp` | `latest`, `X.Y.Z`, `X.Y`, `X` |
| Docker image (GHCR) | `ghcr.io/oleksandrkucherenko/obsidian-vnc` | `latest`, `X.Y.Z`, `X.Y`, `X` |
| Docker image (Docker Hub) | `oleksandrkucherenko/obsidian-mcp` | `latest`, `X.Y.Z`, `X.Y`, `X` |

---

## Troubleshooting

### npmjs.org workflow fails with "Access token expired or revoked"

1. Regenerate token at <https://www.npmjs.com/settings/oleksandrkucherenko/tokens/>
2. Update local file: `echo "NEW_TOKEN_HERE" > .secrets/npm_registry_publish_token`
3. Update GitHub secret: `gh secret set NPM_PUBLISH_TOKEN -b"$(cat .secrets/npm_registry_publish_token)" -R OleksandrKucherenko/mcp-obsidian-via-rest`
4. Re-run failed workflow from <https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions>

### GitHub Packages workflow fails with "Cannot publish over existing version"

This occurs when the `sha-<short>` tag was already used. This is **non-blocking** - npmjs.org and Docker workflows are the critical ones. The GitHub Packages workflow is informational only.
