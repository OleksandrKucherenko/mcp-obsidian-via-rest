# GitHub Actions Workflow Examples

Complete GitHub Actions workflow examples for release-it.

## Manual Trigger with Version Selection

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      release-type:
        description: 'Release type'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major
          - prepatch
          - preminor
          - premajor

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

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
        run: npm run release -- ${{ github.event.inputs.release-type }} --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Auto-Release on Main Branch Push

```yaml
name: Release on Merge
on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    # Only release if commit message indicates intent
    if: "!contains(github.event.head_commit.message, 'skip-release')"
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - run: npm run release -- --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## OIDC Trusted Publishing (Most Secure)

Eliminates long-lived NPM tokens using OpenID Connect.

### Prerequisites

1. Configure at npmjs.com → Package → Settings → Publishing access → Add CI/CD workflow
2. Set `"npm": { "skipChecks": true }` in `.release-it.json`

```yaml
name: Release with OIDC
on:
  workflow_dispatch:
    inputs:
      release-type:
        description: 'Release type (patch, minor, major)'
        required: false
        default: ''

permissions:
  contents: write
  id-token: write  # Required for OIDC

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      # OIDC requires npm >= 11.5.1
      - run: npm install -g npm@latest
      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Release
        run: |
          if [ -n "${{ github.event.inputs.release-type }}" ]; then
            npx release-it ${{ github.event.inputs.release-type }} --ci
          else
            npx release-it --ci
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # No NPM_TOKEN needed - OIDC handles authentication
```

## Pre-Release Workflow

Separate workflow for beta/alpha releases:

```yaml
name: Pre-Release
on:
  workflow_dispatch:
    inputs:
      prerelease-type:
        description: 'Pre-release identifier'
        required: true
        default: 'beta'
        type: choice
        options:
          - alpha
          - beta
          - rc
      version-bump:
        description: 'Version bump type'
        required: true
        default: 'preminor'
        type: choice
        options:
          - prepatch
          - preminor
          - premajor

permissions:
  contents: write

jobs:
  prerelease:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Pre-Release
        run: |
          npm run release -- ${{ github.event.inputs.version-bump }} \
            --preRelease=${{ github.event.inputs.prerelease-type }} \
            --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## With Build Matrix (Multiple Node Versions)

```yaml
name: Test and Release
on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test

  release:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - run: npm run release -- --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Publishing to GitHub Packages

```yaml
name: Release to GitHub Packages
on:
  workflow_dispatch:

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@your-org'

      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - run: npm run release -- --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Requires `publishConfig` in `package.json`:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Dry Run for Pull Requests

Test release config without publishing:

```yaml
name: Release Dry Run
on:
  pull_request:
    branches: [main]
    paths:
      - '.release-it.json'
      - 'package.json'
      - '.github/workflows/release*.yml'

jobs:
  dry-run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Dry Run Release
        run: npm run release -- --dry-run --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Authentication Troubleshooting

### NPM_TOKEN Setup

1. Go to npmjs.com → Access Tokens
2. Generate New Token → Automation (for CI/CD)
3. Add to repository: Settings → Secrets → Actions → New secret
4. Name: `NPM_TOKEN`

### GITHUB_TOKEN Permissions

Default `GITHUB_TOKEN` is auto-provided. Set permissions in workflow:

```yaml
permissions:
  contents: write    # Push tags, create releases
  id-token: write    # OIDC (if using Trusted Publishing)
  packages: write    # GitHub Packages (if applicable)
```

### SSH Authentication (Alternative)

For pushing via SSH instead of HTTPS:

1. Generate SSH key: `ssh-keygen -t ed25519 -C "release@ci"`
2. Add public key as Deploy Key (with write access)
3. Add private key as secret `SSH_PRIVATE_KEY`

```yaml
- uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
```

## Critical Reminders

| Requirement | Why |
|-------------|-----|
| `fetch-depth: 0` | Changelog needs full git history |
| `permissions: contents: write` | Push tags, create releases |
| Configure git user | Commits require author identity |
| `--ci` flag | Non-interactive mode for automation |
