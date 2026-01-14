# End-to-End MCP Server Verification Guide

This guide provides practical, tested steps to verify the MCP Obsidian server is working correctly in various configurations.

## Prerequisites

1. **Obsidian Desktop** running with [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) enabled
2. **API Key** - Copy from Obsidian Settings → Community Plugins → Local REST API
3. **Network Access** - MCP server must be able to reach Obsidian's REST API

## Test Environment

- **Obsidian Host:** Windows 11 with REST API on `https://localhost:27124`
- **WSL2 Gateway IP:** `172.26.32.1`
- **API Key:** `190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9`

## Configuration 1: Multi-URL Smart Configuration

The MCP server supports automatic URL discovery and failover by providing multiple Obsidian API URLs.

### Benefits

- **Automatic URL Selection**: Tests all URLs in parallel and selects the fastest
- **Self-Healing**: Monitors connection health and reconnects to alternative URLs
- **WSL2 Support**: Can try both localhost and Windows host gateway IPs

### Setup

```bash
# Set API key
export API_KEY="your-obsidian-api-key"

# Get WSL2 gateway IP
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

# Configure multiple URLs (order doesn't matter - server tests all in parallel)
export API_URLS="[\"https://127.0.0.1:27124\",\"https://$WSL_GATEWAY_IP:27124\"]"

# Run MCP server with auto-discovery
bun run src/index.ts
```

### Test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  API_KEY=$API_KEY API_URLS="$API_URLS" \
  timeout 10 bun run src/index.ts
```

**Expected Result:** JSON response with 3 tools: `get_note_content`, `obsidian_search`, `obsidian_semantic_search`

## Configuration 2: Docker Hosted MCP Server

The MCP server can be run as a Docker container for isolation and consistent behavior.

### Build Docker Image

```bash
# Build from source
bun run docker:latest

# Or pull from GitHub Container Registry
docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:latest

# Verify image exists
docker images | grep obsidian
```

### Run Docker Container

```bash
# With host networking (best for WSL2)
docker run --name mcp-obsidian --rm -i --network=host \
  -e API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9" \
  -e API_URLS="[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\"]" \
  mcp/obsidian:latest

# With port mapping (for standard Docker)
docker run --name mcp-obsidian --rm -i -p 27124:27124 \
  -e API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9" \
  -e API_URLS="[\"https://host.docker.internal:27124\"]" \
  mcp/obsidian:latest
```

### Test Docker MCP Server

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  docker run --rm -i \
    -e API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9" \
    -e API_URLS="[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\"]" \
    mcp/obsidian:latest
```

**Expected Result:** JSON response with tools list

## Configuration 3: OpenCode CLI Integration

OpenCode CLI automatically discovers and uses MCP servers configured in `opencode.json`.

### Prerequisites

```bash
# Install OpenCode CLI (if not already installed)
curl -fsSL https://opencode.ai/install | bash

# Verify installation
opencode --version
```

### Configuration

The project's `opencode.json` is pre-configured with three MCP server options:

```json
{
  "mcp": {
    "mcp-obsidian": {
      "type": "local",
      "command": ["bun", "run", "src/index.ts"],
      "enabled": true
    },
    "mcp-obsidian-built": { "enabled": false },
    "mcp-obsidian-docker": { "enabled": false }
  }
}
```

### Environment Variables

```bash
export API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9"
export API_HOST="https://172.26.32.1"
export API_PORT="27124"
```

### Test 1: Verify MCP Server Connection

```bash
opencode mcp list
```

**Expected Output:**
```
MCP Servers
●  ✓ mcp-obsidian connected
│     bun run src/index.ts
```

### Test 2: List MCP Tools

```bash
opencode run -m "opencode/big-pickle" \
  "List all available MCP tools from the mcp-obsidian server. Just list them, don't execute anything."
```

**Expected Output:**
```
1. get_note_content - Get content of obsidian note by file path
2. obsidian_search - Search for notes using a query string
3. obsidian_semantic_search - Search for notes using a query string
```

### Test 3: Execute MCP Tool

```bash
opencode run -m "opencode/big-pickle" \
  "Use the obsidian_search tool to search for notes about Docker"
```

**Expected Output:**
```
mcp-obsidian_obsidian_search {"query":"Docker"}

Found X notes about Docker. The search results include notes covering...
```

### Test 4: Get Note Content

```bash
opencode run -m "opencode/big-pickle" \
  "Use get_note_content tool to read Skills/Docker/Overview.md"
```

## Configuration 4: Quick Test Script

Use the provided `test.mcp_quick.sh` script for automated testing:

```bash
# Setup environment
export API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9"
export API_HOST="https://172.26.32.1"
export API_PORT="27124"

# Run quick test (basic checks)
./test.mcp_quick.sh

# Run with search query
./test.mcp_quick.sh "JavaScript"
```

The script tests:
1. ✅ Obsidian API connectivity
2. ✅ MCP server tools listing
3. ⚠️ Search functionality (optional, may timeout on slow networks)
4. ✅ HTTP transport health check

## Summary Table

| Configuration | Status | Command | Tool Recognition |
|--------------|--------|---------|------------------|
| Multi-URL (local) | ✅ Working | `bun run src/index.ts` | ✅ 3 tools detected |
| Docker container | ✅ Working | `docker run mcp/obsidian:latest` | ✅ 3 tools detected |
| OpenCode CLI | ✅ Working | `opencode mcp list` | ✅ 3 tools detected and executable |
| HTTP transport | ✅ Working | `MCP_TRANSPORTS=http bun run src/index.ts` | ✅ Health endpoint functional |

## Troubleshooting

### Issue: "Cannot reach Obsidian API"

**Solution:** Test with curl first:
```bash
curl -k https://localhost:27124
curl -k https://172.26.32.1:27124
```

### Issue: Docker container can't reach Obsidian

**Solution:** Use host networking for WSL2:
```bash
docker run --network=host -e API_KEY=...
```

For standard Docker, use special DNS name:
```bash
docker run -e API_HOST="https://host.docker.internal" ...
```

### Issue: OpenCode shows MCP server as disabled

**Solution:** Update `opencode.json` and set `"enabled": true`:
```json
{
  "mcp": {
    "mcp-obsidian": { "enabled": true }
  }
}
```

### Issue: Search timeout in test.mcp_quick.sh

**Solution:** Increase timeout or skip search test:
```bash
# The script will continue even if search times out
./test.mcp_quick.sh
```

## Additional Resources

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) - Visual debugging tool
- [OpenCode CLI](https://opencode.ai) - AI coding agent with MCP support
- [Project Documentation](./04_manual_testing.md) - Comprehensive testing guide
