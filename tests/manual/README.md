# Manual Testing Scripts

This directory contains helper scripts for manual testing and verification of MCP server configurations.

## Scripts

### `test.mcp_quick.sh`

Automated test script that verifies MCP server is working correctly with your Obsidian instance.

**Usage:**
```bash
# Set environment variables
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"  # or WSL2 gateway IP
export API_PORT="27124"

# Run quick test (basic checks only)
./test.mcp_quick.sh

# Run with search query
./test.mcp_quick.sh "TypeScript"
```

**Tests performed:**
1. ✅ Obsidian API connectivity
2. ✅ MCP server tools listing
3. ⚠️ Search functionality (optional, may timeout on slow networks)
4. ✅ HTTP transport health check

### `demo.config.sh`

Displays ready-to-use configuration examples for different scenarios.

**Usage:**
```bash
./demo.config.sh
```

**Examples included:**
1. Multi-URL smart configuration with automatic API discovery
2. Docker container with multi-URL support
3. OpenCode CLI integration
4. Quick test commands
5. OpenCode MCP configuration options

## Quick Start

```bash
# 1. View configuration examples
./demo.config.sh

# 2. Run automated tests
./test.mcp_quick.sh

# 3. Test specific search query
./test.mcp_quick.sh "Docker"
```

## Requirements

- Obsidian Desktop running with Local REST API enabled
- API Key from Obsidian Settings → Community Plugins → Local REST API
- Network access to Obsidian's REST API

## Troubleshooting

If tests fail:

1. **Obsidian API not reachable:**
   ```bash
   curl -k https://localhost:27124
   ```

2. **WSL2 connectivity issues:**
   ```bash
   export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
   export API_HOST="https://$WSL_GATEWAY_IP"
   ```

3. **Docker container issues:**
   ```bash
   docker images | grep mcp-obsidian
   docker rm -f mcp-obsidian
   ```

## Related Documentation

- [Manual Testing Guide](../../docs/04_manual_testing.md)
- [E2E Verification Guide](../../docs/05_e2e_verification.md)
- [Project README](../../readme.md)
