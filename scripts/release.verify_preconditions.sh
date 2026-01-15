#!/usr/bin/env bash
#
# Release Pre-conditions Verification Script
# Checks all requirements before running a release
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "ℹ️  $1"
}

section() {
    echo ""
    echo "=== $1 ==="
}

# Check toolchain
section "Toolchain"
if command -v bun &>/dev/null && command -v node &>/dev/null && command -v docker &>/dev/null; then
    pass "All required tools available (bun: $(bun --version), node: $(node --version), docker: $(docker --version | cut -d' ' -f3 | tr -d ','))"
else
    fail "Missing required tools"
    command -v bun &>/dev/null || echo "  - bun not found"
    command -v node &>/dev/null || echo "  - node not found"
    command -v docker &>/dev/null || echo "  - docker not found"
fi

# Check npm authentication
section "npm Authentication"
if npm whoami &>/dev/null; then
    NPM_USER=$(npm whoami)
    pass "npm authenticated as: $NPM_USER"

    # Check token file exists
    if test -f .secrets/npm_registry_publish_token; then
        pass "npm token file exists"
    else
        warn "npm token file missing (.secrets/npm_registry_publish_token)"
        info "Create at: https://www.npmjs.com/settings/$NPM_USER/tokens (Automation, Publish)"
    fi

    # Check publish permission (optional, may fail if package doesn't exist yet)
    if timeout 3 npm view @oleksandrkucherenko/mcp-obsidian version &>/dev/null; then
        pass "npm package exists and is accessible"
    else
        warn "Could not verify npm package (package may not exist yet or network issue)"
    fi
else
    fail "npm authentication failed"
    info "Check .secrets/npm_registry_publish_token or run: npm login"
fi

# Check Docker Hub authentication
section "Docker Hub Authentication"
if test -f .secrets/docker_hub_pat; then
    pass "Docker Hub token file exists"

    # Use helper script if available
    if test -f scripts/docker.whoami.sh; then
        DOCKER_OUTPUT=$(./scripts/docker.whoami.sh 2>&1)
        DOCKER_EXIT=$?
        if [ $DOCKER_EXIT -eq 0 ]; then
            # Success - extract username if available
            if echo "$DOCKER_OUTPUT" | grep -q "✅"; then
                DOCKER_USER=$(echo "$DOCKER_OUTPUT" | grep "✅" | sed 's/.*: //' | sed 's/ (via.*//')
                pass "Docker Hub authenticated as: $DOCKER_USER"
            else
                # Credential helper mode - assume valid
                pass "Docker Hub authentication configured (credential helper)"
            fi
        else
            fail "Docker Hub authentication failed"
            info "Run: echo \"\$DOCKER_HUB_TOKEN\" | docker login -u \"\$DOCKER_HUB_USERNAME\" --password-stdin"
        fi
    else
        warn "Helper script scripts/docker.whoami.sh not found, skipping Docker auth check"
    fi
else
    fail "Docker Hub token file missing (.secrets/docker_hub_pat)"
    info "Create at: https://app.docker.com/settings/personal-access-tokens (Read, Write, Delete)"
fi

# Check GitHub CLI authentication
section "GitHub CLI Authentication"
if gh auth status &>/dev/null; then
    GH_USER=$(gh api user --jq .login 2>/dev/null || echo "unknown")
    pass "GitHub CLI authenticated as: $GH_USER"

    # Check token file (optional for local runs)
    if test -f .secrets/github_token; then
        pass "GitHub token file exists"
    else
        info "GitHub token file missing (optional for local runs, CI uses GITHUB_TOKEN automatically)"
        info "To create: gh auth token > .secrets/github_token"
    fi
else
    fail "GitHub CLI authentication failed"
    info "Run: gh auth login"
fi

# Check CI secrets (GitHub repository)
section "CI Secrets (GitHub Repository)"
REPO="OleksandrKucherenko/mcp-obsidian-via-rest"
if gh secret list -R "$REPO" &>/dev/null; then
    SECRET_COUNT=$(gh secret list -R "$REPO" | grep -cE "NPM_PUBLISH_TOKEN|DOCKER_HUB_USERNAME|DOCKER_HUB_TOKEN")
    if [ "$SECRET_COUNT" -eq 3 ]; then
        pass "All 3 required CI secrets exist (NPM_PUBLISH_TOKEN, DOCKER_HUB_USERNAME, DOCKER_HUB_TOKEN)"

        # Show when secrets were last updated (cannot read actual values for security)
        SECRETS_JSON=$(gh api repos/"$REPO"/actions/secrets 2>/dev/null)
        if [ -n "$SECRETS_JSON" ]; then
            info "CI secret timestamps (verify they match local .secrets/ files):"
            echo "$SECRETS_JSON" | jq -r '.secrets[] | select(.name | test("NPM_PUBLISH_TOKEN|DOCKER_HUB")) | "  \(.name): \(.updated_at)"' 2>/dev/null || true
        fi
    else
        fail "Missing CI secrets (found $SECRET_COUNT/3)"
        info "Set secrets with:"
        info "  gh secret set NPM_PUBLISH_TOKEN -b\"\$NPMRC_DEFAULT_AUTH_TOKEN\" -R $REPO"
        info "  gh secret set DOCKER_HUB_USERNAME -b\"\$DOCKER_HUB_USERNAME\" -R $REPO"
        info "  gh secret set DOCKER_HUB_TOKEN -b\"\$DOCKER_HUB_TOKEN\" -R $REPO"
    fi
else
    fail "Cannot access GitHub repository secrets"
    info "Verify: gh auth status and repository access"
fi

# Check CI status
section "CI Status"
LATEST_RUN=$(gh run list --limit 1 -R "$REPO" --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "unknown")
if [ "$LATEST_RUN" = "success" ]; then
    pass "Latest CI run passed"
else
    warn "Latest CI run status: $LATEST_RUN"
    info "View runs: gh run list --limit 3 -R $REPO"
fi

# Check Obsidian API key (for e2e tests)
section "Obsidian API Key (for E2E tests)"
if test -n "$API_KEY"; then
    KEY_LEN=${#API_KEY}
    if [ "$KEY_LEN" -ge 32 ]; then
        pass "API_KEY loaded and meets minimum length (${KEY_LEN} chars)"
    else
        fail "API_KEY too short (${KEY_LEN} chars, need 32+)"
    fi

    if test -f .secrets/obsidian_local_rest_api_key; then
        pass "API key file exists"
    else
        warn "API key file missing (.secrets/obsidian_local_rest_api_key)"
    fi
else
    warn "API_KEY not loaded (required for e2e tests only)"
    info "Create: echo 'your-api-key' > .secrets/obsidian_local_rest_api_key && direnv reload"
fi

# Check GitHub packages token
section "GitHub Packages Token"
if test -n "$NPMRC_GITHUB_AUTH_TOKEN"; then
    pass "GitHub packages token loaded"

    if test -f .secrets/github_read_packages_token; then
        pass "GitHub packages token file exists"
    else
        warn "GitHub packages token file missing (.secrets/github_read_packages_token)"
    fi
else
    warn "GitHub packages token not loaded"
    info "Create classic token at: https://github.com/settings/tokens (read:packages scope)"
    info "Store: echo 'ghp_xxxx' > .secrets/github_read_packages_token && direnv reload"
fi

# Check .keep-versions file
section "Version Retention"
if test -f .keep-versions; then
    pass ".keep-versions file exists"
    info "Review to ensure new version will be preserved by cleanup jobs"
else
    warn ".keep-versions file not found"
fi

# Summary
echo ""
echo "=========================================="
echo "Summary:"
echo -e "  Passed:   ${GREEN}${PASSED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo -e "  Warnings: ${YELLOW}${WARNINGS}${NC}"
echo "=========================================="

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ All critical pre-conditions met${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED critical checks failed${NC}"
    exit 1
fi
