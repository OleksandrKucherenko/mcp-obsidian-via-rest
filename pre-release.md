# Pre-release checklist (CD runbook)

Sequential checklist for preparing a release. Follow top to bottom without branching.

## Verify

- [ ] Sync to latest main: `git fetch --prune --tags` and `git pull`
- [ ] Confirm clean working tree: `git status`
- [ ] Confirm toolchain availability: `bun --version`, `node --version`, `docker --version`
- [ ] Confirm GitHub access: `gh auth status` and `gh release list --limit 1`
- [ ] Confirm npm access: `npm whoami`
- [ ] Record intended version/tag from `bun run release:dry` (example format: `vX.Y.Z` or `vX.Y.Z-rc.1`)
- [ ] Review `.keep-versions` to ensure the new major/minor is preserved by cleanup jobs
- [ ] **CRITICAL:** Verify npm token is valid before releasing (token in `.secrets/npm_registry_publish_token` must be active and not expired)

  **Note:** If npmjs.org workflow fails with "Access token expired or revoked":
  1. Regenerate token at https://www.npmjs.com/settings/oleksandrkucherenko/tokens/
  2. Update local file: `echo "NEW_TOKEN_HERE" > .secrets/npm_registry_publish_token`
  3. Update GitHub secret: `gh secret set NPM_PUBLISH_TOKEN -b"$(cat .secrets/npm_registry_publish_token)" -R OleksandrKucherenko/mcp-obsidian-via-rest`
  4. Re-run failed workflow from Actions tab

## Update

- [ ] Update `CHANGELOG.md` to match the planned release notes from `bun run release:dry`
- [ ] Update `readme.md` and `docs/` to reflect any user-visible changes
- [ ] Verify `package.json` metadata (name, version, bin, publishConfig) is correct
- [ ] Verify `configs/config.default.jsonc` and `configs/config.wsl2.jsonc` reflect current defaults

## Deprecation preview (.keep-versions)

- [ ] Generate npm deprecation report: `node assets/ci_cleanup_npm_package.js "$(jq -r '.name' package.json)"`
- [ ] Inspect generated script: `cat deprecate-@oleksandrkucherenko-mcp-obsidian-old-versions.sh`
- [ ] Set owner for GHCR cleanup: `export GH_OWNER="$(gh repo view --json owner -q .owner.login)"`
- [ ] Generate GHCR cleanup report (obsidian-mcp): `node assets/ci_cleanup_docker_images.js "$GH_OWNER" "obsidian-mcp" --force`
- [ ] Inspect generated script: `cat cleanup-docker-$GH_OWNER-obsidian-mcp-old-images.sh`
- [ ] Generate GHCR cleanup report (obsidian-vnc): `node assets/ci_cleanup_docker_images.js "$GH_OWNER" "obsidian-vnc" --force`
- [ ] Inspect generated script: `cat cleanup-docker-$GH_OWNER-obsidian-vnc-old-images.sh`
- [ ] Update `.keep-versions` with keep rules, then rerun the above steps to confirm the final keep/delete lists

## Choose release type and version

- [ ] Confirm SemVer intent matches the change set (breaking change = major, new feature = minor, fix only = patch)
- [ ] Record the recommended next version from `bun run release:dry`
- [ ] Decide the final version number and tag format: `vX.Y.Z` or `vX.Y.Z-rc.N`

### MAJOR release

- [ ] Use when there are breaking changes or incompatible API/config changes
- [ ] Force the release type if needed: `bun run release-it major`
- [ ] Force an exact version if needed: `bun run release-it X.Y.Z`

### MINOR release

- [ ] Use when adding backward-compatible features
- [ ] Force the release type if needed: `bun run release-it minor`
- [ ] Force an exact version if needed: `bun run release-it X.Y.Z`

### PATCH release

- [ ] Use for backward-compatible bug fixes only
- [ ] Force the release type if needed: `bun run release-it patch`
- [ ] Force an exact version if needed: `bun run release-it X.Y.Z`

## Test

- [ ] Install dependencies: `bun install`
- [ ] Typecheck: `bun run checks:types`
- [ ] Lint: `bun run checks:lint`
- [ ] Unit tests: `bun test`
- [ ] E2E tests: `bun run test:e2e`
- [ ] Container tests: `bun run test:containers`
- [ ] Build package: `bun run publish:prepare`
- [ ] Dry-run npm publish: `npm publish --dry-run --access public --registry="https://registry.npmjs.org/"`

## Communicate (during release)

- [ ] Draft release notes with features, fixes, breaking changes, and upgrade steps
- [ ] Add migration notes for any config or CLI changes
- [ ] Paste the final release notes into the GitHub Release text

## Release outputs and deployables

- [ ] Git tag `vX.Y.Z` and GitHub Release `Release vX.Y.Z`
- [ ] npmjs package: `@oleksandrkucherenko/mcp-obsidian`
- [ ] GitHub Packages npm package: `@oleksandrkucherenko/mcp-obsidian`
- [ ] GHCR images: `ghcr.io/oleksandrkucherenko/obsidian-mcp`
- [ ] GHCR images: `ghcr.io/oleksandrkucherenko/obsidian-vnc`
- [ ] Docker tags produced: `latest`, `X.Y.Z`, `X.Y`, `X`, `sha-<short>`
- [ ] GitHub Actions publishing behavior:
- [ ] `.github/workflows/npmjs-npm-publish.yml` updates changelog, builds, dry-runs, and publishes to npmjs on tag/approval
- [ ] `.github/workflows/github-npm-publish.yml` runs tests, builds, and publishes GitHub Packages with `-sha-<short>` tag
- [ ] `.github/workflows/github-docker-publish.yml` builds and pushes GHCR images for `obsidian-mcp` and `obsidian-vnc`

## Monitor

- [ ] Monitor workflows: `.github/workflows/npmjs-npm-publish.yml`
- [ ] Monitor workflows: `.github/workflows/github-npm-publish.yml`
- [ ] Monitor workflows: `.github/workflows/github-docker-publish.yml`
- [ ] Verify npmjs version: `npm view @oleksandrkucherenko/mcp-obsidian version`
- [ ] Verify GitHub Packages version: `npm view @oleksandrkucherenko/mcp-obsidian --registry https://npm.pkg.github.com`
- [ ] Verify GHCR tags: `docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:<tag>`
- [ ] Verify GHCR tags: `docker pull ghcr.io/oleksandrkucherenko/obsidian-vnc:<tag>`

## Troubleshooting workflow failures

### npmjs.org workflow fails with "Access token expired or revoked"

If npmjs publish workflow fails due to expired token:

1. Regenerate npm token at https://www.npmjs.com/settings/oleksandrkucherenko/tokens/
2. Update local file: `echo "NEW_TOKEN_HERE" > .secrets/npm_registry_publish_token`
3. Update GitHub secret: `gh secret set NPM_PUBLISH_TOKEN -b"$(cat .secrets/npm_registry_publish_token)" -R OleksandrKucherenko/mcp-obsidian-via-rest`
4. Re-run failed workflow from https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions

### GitHub Packages workflow fails with "Cannot publish over existing version"

This occurs when the `sha-<short>` tag was already used. The workflow publishes with `sha-<short>` tags which can conflict. This is non-blocking - npmjs.org and Docker publish workflows are the critical ones.

**Note:** GitHub Packages workflow is informational only. Primary publishing is done via npmjs.org workflow.
