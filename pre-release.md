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

- [ ] Confirm SemVer intent matches the change set:
  - Breaking changes or incompatible API/config → MAJOR
  - Backward-compatible new features → MINOR
  - Bug fixes only → PATCH
- [ ] Decide the version bump type: `major`, `minor`, or `patch`

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
