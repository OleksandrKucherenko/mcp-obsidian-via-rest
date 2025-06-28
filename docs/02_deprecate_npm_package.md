# npm Package Deprecation Script: Usage & CI/CD Integration

This document describes the purpose, functionality, and usage of the `ci_cleanup_npm_package.js` script found in [`assets/ci_cleanup_npm_package.js`]. This script automates the deprecation of old npm package versions, making it ideal for integration into CI/CD pipelines.

---

## Overview

The script identifies package versions older than 30 days (excluding the latest 3 and optionally the latest of each major release) and generates a bash script to deprecate those versions on npm. It supports custom keep/exclude patterns via a `.keep-versions` file.

- **Location:** `assets/ci_cleanup_npm_package.js`
- **Language:** Node.js (22+ recommended)
- **Purpose:** Automate npm deprecation for old package versions
- **Output:** Bash script to deprecate old versions

---

## How It Works

1. **Fetches version/time data** from the npm registry for the specified package.
2. **Excludes**:
   - The latest 3 published versions (by default)
   - Versions matching patterns in `.keep-versions` (if present)
   - (Optional) The latest version of each major release (`--keep-latest-major-releases`)
3. **Identifies versions older than 30 days** (configurable in script).
4. **Generates a bash script** to deprecate these versions using `npm deprecate`.

---

## Prerequisites

- Node.js 22 LTS or later
- npm authentication (must be logged in with publish/deprecate rights)
- `assets/ci_cleanup_npm_package.js` available in your repo
- (Optional) `.keep-versions` file in the working directory

---

## Usage

### Local (Manual)
```sh
node assets/ci_cleanup_npm_package.js <package-name> [--keep-latest-major-releases]
```
- If `<package-name>` is omitted, the script uses the name from `package.json`.
- Use `--keep-latest-major-releases` to always keep the latest version of each major (e.g., 1.x, 2.x).

### With a `.keep-versions` File
- Place `.keep-versions` in the root directory.
- Each line is a version or pattern to keep (e.g., `1.2.3`, `1.*`).
- Prefix with `!` to explicitly *not* keep a version/pattern.
- Lines starting with `#` are comments.

Example:
```
# Keep all 2.x versions
2.*
# Never keep 1.0.0
!1.0.0
```

---

## Handling Special Characters and Scoped Packages

- **Scoped packages** (e.g., `@scope/package`) are fully supported. Pass the scoped name directly as `<package-name>`, or have it in your `package.json`.
- The script and generated bash script will use the full name (including `@scope/`).
- **Filename note:** The generated bash script will include the full package name, but all `/` characters are replaced with `-` to avoid accidental folder creation. For example, for `@scope/package`, the filename will be `deprecate-@scope-package-old-versions.sh`.

## Bash Script Executable by Default

- The generated bash script is always saved with executable permissions (`chmod 755`). You can run it directly with:
  ```sh
  ./deprecate-<package-name>-old-versions.sh
  ```
  No manual `chmod` step is required.

---

## CI/CD Integration Example (GitHub Actions)

```yaml
jobs:
  deprecate-old-versions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org/'
      - name: Install dependencies
        run: npm ci
      - name: Run deprecation script
        run: |
          node assets/ci_cleanup_npm_package.js <package-name>
          bash deprecate-<package-name>-old-versions.sh
        env:
          NPMJS_AUTH_TOKEN: ${{ secrets.GITHUB_NPM_TOKEN }}
```
- Replace `<package-name>` with your actual package name.
- Ensure `GITHUB_NPM_TOKEN` is set as a repository secret with publish/deprecate permissions.

---

## Script Flow (Internal)

1. **parseArgs**: Parses CLI arguments, determines package name & options.
2. **fetchPackageTimeData**: Retrieves version/time data from npm registry.
3. **processVersionEntries**: Validates and sorts version entries.
4. **loadKeepVersionsFile**: Loads and parses `.keep-versions` file (if present).
5. **getLatestPerMajor**: Determines the latest version for each major release.
6. **buildKeepVersionsSet**: Builds the set of versions to keep based on rules and patterns.
7. **fetchDeprecatedVersions**: Fetches already deprecated versions.
8. **computeVersionsToDeprecate**: Determines which versions should be deprecated.
9. **generateVersionSummary**: Prepares a summary for output.
10. **generateBashScript**: Writes a bash script to deprecate the identified versions.

---

## Troubleshooting

- **npm auth errors:** Ensure your `NPMJS_AUTH_TOKEN` or npm login is valid and has publish/deprecate rights.
- **No versions deprecated:** Check your `.keep-versions` file and script options; recent versions are always kept.
- **Script errors:** Run with Node.js 22+ and check for missing dependencies.

---

## Exit Codes
- `0`: Success
- `1`: General error (e.g., invalid arguments, fetch failure)
- `2`: No versions to deprecate (not an error, just nothing to do)

---

## Customization
- Edit the `CONFIG` object at the top of the script to change default values (days, keep count, etc).
- Extend the logger for advanced logging needs.

---

For further details, see the script source in [`assets/ci_cleanup_npm_package.js`].
