# OpenCode MCP Configurations

This directory contains to `opencode.json` configuration file for OpenCode CLI MCP server integration.

## DIRENV Integration

This project uses [DIRENV](https://direnv.net/) to automatically load environment variables when entering the project directory.

**Variables automatically loaded:**
- `API_KEY` - Obsidian Local REST API key
- `API_HOST` - Obsidian REST API host (WSL gateway or localhost)
- `API_PORT` - Obsidian REST API port (27124)
- `WSL_GATEWAY_IP` - WSL2 gateway IP for Windows host access
- `API_URLS` - Multi-URL configuration for automatic failover

**Just enter the directory - no manual exports needed:**
```bash
cd /path/to/mcp-obsidian-via-rest

# Variables are automatically loaded by DIRENV!

opencode mcp list
```

For complete DIRENV setup instructions, see [Environment Variables (DIRENV)](./docs/06_direnv_setup.md).

## Available Configurations

The `opencode.json` file includes 3 pre-configured MCP server options:

**Note:** Multi-URL configurations (`mcp-obsidian-multi` and `mcp-obsidian-docker-multi`) are not included because OpenCode CLI doesn't properly parse environment variables containing JSON arrays. Use `API_HOST` + `API_PORT` approach instead.

### 1. `mcp-obsidian` (default, enabled)

Runs the MCP server from source code with hot reload support.

**Environment variables required:**
```bash
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"  # or WSL2 gateway IP
export API_PORT="27124"
```

**Best for:** Development, hot reload, debugging

### 2. `mcp-obsidian-built` (disabled)

Runs the MCP server using the compiled binary.

**Setup:**
```bash
bun run build
npm link  # or: bun link && bun link --global
```

**Environment variables required:**
```bash
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"
export API_PORT="27124"
```

**Best for:** Production use, fast startup, no dependencies

### 4. `mcp-obsidian-docker` (disabled)

Runs the MCP server in a Docker container.

**Environment variables required:**
```bash
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"
export API_PORT="27124"
```

**Docker image required:**
```bash
# Build locally
bun run docker:latest

# Or pull from GHCR
docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
```

**Best for:** Isolation, reproducible behavior, clean execution
 
## How to Switch Configurations

Edit `opencode.json` and set `"enabled": true` for the desired configuration:

```json
{
  "mcp": {
    "mcp-obsidian": { "enabled": false },
    "mcp-obsidian-built": { "enabled": true },
    "mcp-obsidian-docker": { "enabled": false }
  }
}
```

## Using with OpenCode CLI

### List MCP Servers

```bash
opencode mcp list
```

### Test MCP Connection

```bash
opencode mcp debug mcp-obsidian
```

### Use MCP Tools

```bash
opencode run -m "opencode/big-pickle" \
  "List all available MCP tools from the obsidian server"
```

```bash
opencode run -m "opencode/big-pickle" \
  "Use the obsidian_search tool to search for notes about Docker"
```

## Troubleshooting

### Error: "Configuration is invalid"

**Cause:** OpenCode doesn't support the `"description"` field in MCP server configurations.

**Solution:** Ensure your MCP configuration only uses these fields:
- `type` - must be "local" or "remote"
- `command` - array of command and arguments (for local)
- `environment` - object of environment variables (for local)
- `enabled` - boolean
- `url` - string (for remote)
- `headers` - object (for remote)

### Error: "MCP error -32000: Connection closed"

**Cause:** Environment variables are not set or MCP server failed to start.

**Solution:** Set required environment variables:
```bash
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"
export API_PORT="27124"
```

### WSL2 Gateway IP

For WSL2 accessing Windows host Obsidian:

```bash
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_HOST="https://$WSL_GATEWAY_IP"
```

## Additional Resources

- [Manual Testing Guide](../docs/04_manual_testing.md)
- [E2E Verification Guide](../docs/05_e2e_verification.md)
- [OpenCode Documentation](https://opencode.ai/docs/mcp-servers)
- [Quick Test Scripts](../tests/manual/opencode/)
