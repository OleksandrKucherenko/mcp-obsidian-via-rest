# Manual Release Workflow Verification

This guide helps you verify the release workflow logic locally before pushing tags and triggering actual publishing.

<!-- TOC -->

- [Manual Release Workflow Verification](#manual-release-workflow-verification)
  - [Prerequisites](#prerequisites)
  - [Scenario 1: Publish New Major/Minor Version](#scenario-1-publish-new-majorminor-version)
    - [Step 1: Dry Run with release-it](#step-1-dry-run-with-release-it)
    - [Step 2: Verify Generated Files](#step-2-verify-generated-files)
    - [Step 3: Manual Version Update Test](#step-3-manual-version-update-test)
  - [Scenario 2: Publish Patch/Hotfix Version](#scenario-2-publish-patchhotfix-version)
    - [Step 1: Create Hotfix Scenario](#step-1-create-hotfix-scenario)
    - [Step 2: Test Patch Version Release](#step-2-test-patch-version-release)
    - [Step 3: Verify Patch Logic](#step-3-verify-patch-logic)
    - [Step 4: Cleanup](#step-4-cleanup)
  - [Scenario 3: Publish Release Candidate RC](#scenario-3-publish-release-candidate-rc)
    - [Step 1: Test RC Version](#step-1-test-rc-version)
    - [Step 2: Simulate Workflow RC Detection](#step-2-simulate-workflow-rc-detection)
    - [Step 3: Test Multiple RC Formats](#step-3-test-multiple-rc-formats)
  - [Complete Workflow Simulation](#complete-workflow-simulation)
    - [Full Test Script](#full-test-script)
    - [Run the Test Script](#run-the-test-script)
  - [Manual Verification Checklist](#manual-verification-checklist)
    - [✅ Pre-Push Checklist](#-pre-push-checklist)
    - [✅ Version-Specific Checks](#-version-specific-checks)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues:](#common-issues)
  - [Next Steps](#next-steps)

<!-- /TOC -->

## Prerequisites

1. **Install Dependencies:**
   ```bash
   bun install
   ```

2. **Set Environment Variables:**

   **Method 1: GitHub CLI (Recommended)**
   ```bash
   # Install GitHub CLI if not already installed
   # Ubuntu/Debian: sudo apt install gh
   # macOS: brew install gh
   # Windows: winget install GitHub.cli
   
   # Login with required scopes
   gh auth login --scopes "repo,write:packages,read:user,user:email" --web
   
   # Verify authentication
   gh auth status
   
   # Set environment variable
   export GITHUB_TOKEN=$(gh auth token)
   
   # Make it persistent (add to ~/.bashrc or ~/.zshrc)
   echo 'export GITHUB_TOKEN=$(gh auth token)' >> ~/.bashrc
   source ~/.bashrc
   ```

   **Method 2: Manual Token (GitHub Web Interface)**
   ```bash
   # Set token manually
   export GITHUB_TOKEN="your_github_token_here"
   ```

   **Required Token Scopes:**
   ```
   repo                    # Full repository access
   write:packages          # If publishing to GitHub Packages  
   read:user               # Read user profile
   user:email              # Access user email   

   Repository permissions (Fine-grained tokens):
   Actions: Read           # Read workflow runs
   Contents: Write         # Create/modify files, tags, branches
   Issues: Write           # Create/modify issues (for release notes)
   Metadata: Read          # Read repository metadata
   Pull requests: Write    # Create/modify PRs (if using PR workflow)
   Repository projects: Write  # If using GitHub Projects
   ```

   **GitHub CLI Scope Explanation:**
   ```bash
   gh auth login --scopes "repo,write:packages,read:user,user:email"
   #                      ^^^^  ^^^^^^^^^^^^^^  ^^^^^^^^^  ^^^^^^^^^^
   #                      │     │               │         └─ Access email
   #                      │     │               └─ Read user profile  
   #                      │     └─ Publish packages (npm/GitHub)
   #                      └─ Full repo access (tags, releases, commits)
   ```

   **Verify Token Permissions:**
   ```bash
   # Test GitHub API access
   gh api user --jq '.login'
   
   # Test repository access
   gh repo view --json name,owner
   
   # Test release permissions
   gh release list --limit 1
   
   # Test token with release-it
   bun run release:dry --verbose
   ```

   **Token Management:**
   ```bash
   # Refresh token if needed
   gh auth refresh --scopes "repo,write:packages,read:user,user:email"
   
   # Switch between accounts
   gh auth switch
   
   # Check current authentication status
   gh auth status
   
   # Logout (revoke token)
   gh auth logout
   ```

3. **Clean Working Directory:**
   ```bash
   git status  # should be clean
   ```

## Scenario 1: Publish New Major/Minor Version

### Step 1: Dry Run with release-it
```bash
# Let release-it determine the next version based on commits
bun run release:dry

# Or specify a version manually
bun run release-it 1.2.0 --dry-run --ci --no-git --no-github --conventional-commits --npm.skip.publish
```

### Step 2: Verify Generated Files
After dry run, check:

```bash
# 1. Check if CHANGELOG.md was updated
head -n 20 CHANGELOG.md

# 2. Verify package.json version (should still be original)
jq -r '.version' package.json

# 3. Check what release-it would do
echo "Release-it would create tag: v$(jq -r '.version' package.json)"
```

### Step 3: Manual Version Update Test
```bash
# Simulate what the workflow does
TEST_VERSION="1.2.0"

# Update package.json
jq ".version = \"$TEST_VERSION\"" package.json > package.json.tmp
mv package.json.tmp package.json

# Verify the change
echo "Updated version: $(jq -r '.version' package.json)"

# Restore original version
git checkout package.json
```

## Scenario 2: Publish Patch/Hotfix Version

### Step 1: Create Hotfix Scenario
```bash
# Make a small commit that would trigger a patch
echo "// Minor fix" >> src/index.ts
git add src/index.ts
git commit -m "fix: minor bug fix for hotfix testing"
```

### Step 2: Test Patch Version Release
```bash
# Test patch version bump
bun run release-it patch --dry-run --ci --no-git --no-github --conventional-commits --npm.skip.publish

# Or specify exact patch version
bun run release-it 1.1.1 --dry-run --ci --no-git --no-github --conventional-commits --npm.skip.publish
```

### Step 3: Verify Patch Logic
```bash
# Check the generated changelog for patch entry
grep -A 5 -B 5 "fix:" CHANGELOG.md || echo "No fix entries found"

# Verify version increment logic
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "Current version: $CURRENT_VERSION"
echo "Expected patch would be: $(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."($3+1)}')"
```

### Step 4: Cleanup
```bash
# Remove test commit
git reset --hard HEAD~1
```

## Scenario 3: Publish Release Candidate (RC)

### Step 1: Test RC Version
```bash
# Test RC version creation
TEST_RC_VERSION="1.2.0-rc.1"

bun run release-it $TEST_RC_VERSION --dry-run --ci --no-git --no-github --conventional-commits --npm.skip.publish
```

### Step 2: Simulate Workflow RC Detection
```bash
# Test the npm tag detection logic from workflow
TEST_VERSION="1.2.0-rc.1"

if [[ "$TEST_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+-.+ ]]; then
  echo "✅ Detected as pre-release: $TEST_VERSION"
  if [[ "$TEST_VERSION" =~ -([a-zA-Z]+) ]]; then
    NPM_TAG="${BASH_REMATCH[1]}"
    echo "✅ npm tag would be: $NPM_TAG"
  else
    NPM_TAG="prerelease"
    echo "✅ npm tag would be: $NPM_TAG (fallback)"
  fi
else
  echo "❌ Not detected as pre-release"
fi
```

### Step 3: Test Multiple RC Formats
```bash
# Test different RC version formats
for version in "1.2.0-rc.1" "1.2.0-alpha.1" "1.2.0-beta.2" "1.2.0-0-sha-abc1234"; do
  echo "Testing version: $version"
  
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-.+ ]]; then
    if [[ "$version" =~ -([a-zA-Z]+) ]]; then
      echo "  → npm tag: ${BASH_REMATCH[1]}"
    else
      echo "  → npm tag: prerelease"
    fi
  else
    echo "  → npm tag: latest (stable)"
  fi
  echo ""
done
```

## Complete Workflow Simulation

### Full Test Script
Create this test script to simulate the entire workflow:

```bash
#!/bin/bash
# save as: test-release-workflow.sh

set -e

echo "🧪 Testing Release Workflow Locally"
echo "=================================="

# Function to test version extraction
test_version_extraction() {
  local test_tag="$1"
  local expected_version="$2"
  
  # Simulate GitHub ref
  export GITHUB_REF="refs/tags/$test_tag"
  
  # Extract version (same logic as workflow)
  if [[ $GITHUB_REF == *"refs/tags/v"* ]]; then
    VERSION=${GITHUB_REF#refs/tags/v}
  else
    VERSION=$(jq -r '.version' package.json)
  fi
  
  echo "Tag: $test_tag → Version: $VERSION"
  if [[ "$VERSION" == "$expected_version" ]]; then
    echo "✅ PASS"
  else
    echo "❌ FAIL (expected: $expected_version)"
  fi
  echo ""
}

# Test version extraction
echo "1. Testing Version Extraction:"
test_version_extraction "v1.2.3" "1.2.3"
test_version_extraction "v1.2.0-rc.1" "1.2.0-rc.1"
test_version_extraction "v1.2.0-0-alpha.1" "1.2.0-0-alpha.1"
test_version_extraction "v1.2.0-0-sha-abc1234" "1.2.0-0-sha-abc1234"

# Test package.json update
echo "2. Testing package.json Update:"
BACKUP_VERSION=$(jq -r '.version' package.json)
TEST_VERSION="9.9.9-test"

jq ".version = \"$TEST_VERSION\"" package.json > package.json.tmp
mv package.json.tmp package.json

UPDATED_VERSION=$(jq -r '.version' package.json)
if [[ "$UPDATED_VERSION" == "$TEST_VERSION" ]]; then
  echo "✅ package.json update works"
else
  echo "❌ package.json update failed"
fi

# Restore original version
jq ".version = \"$BACKUP_VERSION\"" package.json > package.json.tmp
mv package.json.tmp package.json
echo "✅ Restored original version: $BACKUP_VERSION"
echo ""

# Test release-it dry run
echo "3. Testing release-it Dry Run:"
if bun run release:dry > /dev/null 2>&1; then
  echo "✅ release-it dry run works"
else
  echo "❌ release-it dry run failed"
fi

echo ""
echo "🎉 All tests completed!"
```

### Run the Test Script
```bash
# Make executable and run
chmod +x test-release-workflow.sh
./test-release-workflow.sh
```

## Manual Verification Checklist

Before pushing any version tag, verify:

### ✅ Pre-Push Checklist
- [ ] `bun run release:dry` runs without errors
- [ ] CHANGELOG.md contains expected entries
- [ ] Version format is valid semver
- [ ] Working directory is clean
- [ ] All tests pass: `bun test`

### ✅ Version-Specific Checks

**For Stable Releases (1.2.3):**
- [ ] No pre-release identifier in version
- [ ] Changelog shows appropriate version section
- [ ] Version follows semantic versioning rules

**For Pre-releases (1.2.3-rc.1):**
- [ ] Version contains pre-release identifier
- [ ] Pre-release type is appropriate (rc, alpha, beta)
- [ ] npm tag detection works correctly

**For Hotfixes:**
- [ ] Version increments patch number only
- [ ] Changelog shows fix entries
- [ ] No breaking changes included

## Troubleshooting

### Common Issues:

1. **release-it fails:**
   ```bash
   # Check GitHub token
   echo $GITHUB_TOKEN
   
   # Verify git config
   git config --list | grep -E "(user.name|user.email)"
   ```

2. **Version extraction fails:**
   ```bash
   # Test manually
   export GITHUB_REF="refs/tags/v1.2.3"
   echo ${GITHUB_REF#refs/tags/v}
   ```

3. **jq not found:**
   ```bash
   # Install jq
   sudo apt-get install jq  # Ubuntu/Debian
   brew install jq          # macOS
   ```

## Next Steps

After successful local verification:

1. **Create and push tag:**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

2. **Monitor GitHub Actions:**
   - Check workflow progress in GitHub Actions tab
   - Verify package is published with correct version
   - Confirm npm dist-tag is correct for pre-releases

3. **Test published package:**
   ```bash
   # For stable releases
   npm info @oleksandrkucherenko/mcp-obsidian
   
   # For pre-releases
   npm info @oleksandrkucherenko/mcp-obsidian@rc
   ```
