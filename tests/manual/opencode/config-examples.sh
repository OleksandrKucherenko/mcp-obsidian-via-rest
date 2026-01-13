#!/bin/bash
# MCP Server Configuration Examples
# This script provides ready-to-use configuration examples for different scenarios

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}MCP Server Configuration Examples${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Get WSL2 gateway IP if available
if command -v ip &>/dev/null; then
	WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}' 2>/dev/null || echo "127.0.0.1")
else
	WSL_GATEWAY_IP="127.0.0.1"
fi

echo -e "${YELLOW}Configuration${NC}"
echo -e "  WSL Gateway IP: ${WSL_GATEWAY_IP}"
echo ""

echo -e "${BLUE}1. Multi-URL Smart Configuration${NC}"
echo -e "${GREEN}Description:${NC} Automatic API discovery and failover"
cat <<'EOF'
# Example environment setup
export API_KEY="your-obsidian-api-key-here"
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_URLS="[\"https://127.0.0.1:27124\",\"https://$WSL_GATEWAY_IP:27124\"]"

# Run MCP server
bun run src/index.ts
EOF
echo ""

echo -e "${BLUE}2. Docker with Multi-URL${NC}"
echo -e "${GREEN}Description:${NC} Docker container with automatic API discovery"
cat <<'EOF'
# Run Docker container with host networking
docker run --name mcp-obsidian --rm -i --network=host \
  -e API_KEY="your-obsidian-api-key-here" \
  -e API_URLS="[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\"]" \
  mcp/obsidian:latest
EOF
echo ""

echo -e "${BLUE}3. OpenCode CLI with Source Code${NC}"
echo -e "${GREEN}Description:${NC} Use OpenCode CLI with local MCP server"
cat <<'EOF'
# Set environment
export API_KEY="your-obsidian-api-key-here"
export API_HOST="https://172.26.32.1"
export API_PORT="27124"

# Verify MCP server is connected
opencode mcp list

# Test MCP tool
opencode run -m "opencode/big-pickle" "Search for notes about Docker using the obsidian_search tool"
EOF
echo ""

echo -e "${BLUE}4. Quick Test Commands${NC}"
echo ""
echo -e "${YELLOW}Test MCP server with multi-URL:${NC}"
cat <<'EOF'
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  API_KEY=$API_KEY \
  API_URLS='["https://127.0.0.1:27124","https://172.26.32.1:27124"]' \
  bun run src/index.ts
EOF
echo ""

echo -e "${YELLOW}Test Docker MCP server:${NC}"
cat <<'EOF'
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  docker run --rm -i \
    -e API_KEY="your-api-key" \
    -e API_URLS='["https://127.0.0.1:27124","https://172.26.32.1:27124"]' \
    mcp/obsidian:latest
EOF
echo ""

echo -e "${YELLOW}Test search via MCP:${NC}"
cat <<'EOF'
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"obsidian_search","arguments":{"query":"Docker"}}}' | \
  API_KEY=$API_KEY \
  API_URLS='["https://127.0.0.1:27124","https://172.26.32.1:27124"]' \
  timeout 15 bun run src/index.ts
EOF
echo ""

echo -e "${BLUE}5. OpenCode MCP Configuration${NC}"
echo -e "${GREEN}Description:${NC} Edit opencode.json to enable different configurations"
cat <<'EOF'
# Enable source code (default)
{
  "mcp": {
    "mcp-obsidian": { "enabled": true },
    "mcp-obsidian-multi": { "enabled": false },
    "mcp-obsidian-docker": { "enabled": false }
  }
}

# Enable multi-URL configuration
{
  "mcp": {
    "mcp-obsidian": { "enabled": false },
    "mcp-obsidian-multi": { "enabled": true },
    "mcp-obsidian-docker": { "enabled": false }
  }
}

# Enable Docker configuration
{
  "mcp": {
    "mcp-obsidian": { "enabled": false },
    "mcp-obsidian-multi": { "enabled": false },
    "mcp-obsidian-docker": { "enabled": true }
  }
}
EOF
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}For complete E2E testing guide, see:${NC}"
echo -e "  docs/05_e2e_verification.md"
echo -e "${BLUE}=========================================${NC}"
