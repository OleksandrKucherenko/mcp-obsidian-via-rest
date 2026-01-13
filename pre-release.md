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
- [ ] **CRITICAL:** Verify CI workflows exist: `ls .github/workflows/npm-*.yml .github/workflows/docker-*.yml`
- [ ] **CRITICAL:** Verify CI secrets are configured: `gh secret list -R OleksandrKucherenko/mcp-obsidian-via-rest`
  - Required: `NPM_PUBLISH_TOKEN` (for npmjs.org)
  - Required: `GHCR_PAT` or `GITHUB_TOKEN` (auto-provided by GitHub Actions for GHCR Docker images, but required for local run)
  - Required: `DOCKER_HUB_ACCESS_TOKEN` and `DOCKER_HUB_USERNAME` (for Docker Hub)
- [ ] **CRITICAL:** Verify CI is working: `gh run list --limit 3 -R OleksandrKucherenko/mcp-obsidian-via-rest` (last runs should be green)

## 2. Choose release version

- [ ] Run dry-run to see recommended version: `bun run release:dry`
- [ ] Record the recommended next version from output (example format: `vX.Y.Z` or `vX.Y.Z-rc.1`)
- [ ] Confirm SemVer intent matches the change set:
  - Breaking changes or incompatible API/config → MAJOR
  - Backward-compatible new features → MINOR
  - Bug fixes only → PATCH
- [ ] Decide the final version number and tag format: `vX.Y.Z` or `vX.Y.Z-rc.N`

## 3. Update content

- [ ] Update `CHANGELOG.md` to match the planned release notes from `bun run release:dry`
- [ ] Update `readme.md` and `docs/` to reflect any user-visible changes
- [ ] Verify `package.json` metadata (name, version, bin, publishConfig) is correct
- [ ] Verify `configs/config.default.jsonc` and `configs/config.wsl2.jsonc` reflect current defaults
- [ ] (Optional) Review cleanup preview: `node assets/ci_cleanup_npm_package.js "$(jq -r '.name' package.json)"` and `node assets/ci_cleanup_docker_images.js "$GH_OWNER" "obsidian-mcp" --force`

## 4. Test locally

- [ ] Install dependencies: `bun install`
- [ ] Typecheck: `bun run checks:types`
- [ ] Lint: `bun run checks:lint`
- [ ] Unit tests: `bun test`
- [ ] E2E tests: `bun run test:e2e`
- [ ] Container tests: `bun run test:containers`
- [ ] Build package: `bun run publish:prepare`
- [ ] Dry-run npm publish: `npm publish --dry-run --access public --registry="https://registry.npmjs.org/"`

## 5. Create release

- [ ] Run the release command:
  - For automatic version increment: `bun run release` (or `bun run release-it major|minor|patch`)
  - For exact version: `bun run release-it X.Y.Z`
- [ ] Confirm the release:
  - Git tag `vX.Y.Z` created and pushed
  - GitHub Release created (draft status)
  - Changelog updated
  - package.json version bumped

## 6. Add release notes

- [ ] Navigate to the draft GitHub Release: `gh release view vX.Y.Z --web`
- [ ] Draft release notes with:
  - Features added
  - Fixes applied
  - Breaking changes (if any)
  - Migration notes for config or CLI changes
  - Upgrade steps for users
- [ ] Publish the GitHub Release (this triggers CI/CD workflows)

## 7. Monitor CI/CD workflows

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
