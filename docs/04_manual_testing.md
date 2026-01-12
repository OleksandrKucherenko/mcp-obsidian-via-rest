# Manual Testing with MCP Inspector

This guide explains how to manually test the MCP Obsidian server using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) tool.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Transport Modes](#transport-modes)
- [Testing with Stdio Transport](#testing-with-stdio-transport)
  - [Local Development](#local-development)
  - [Docker Container](#docker-container)
- [Testing with HTTP Transport](#testing-with-http-transport)
- [Available MCP Tools and Resources](#available-mcp-tools-and-resources)
- [Configuration Options](#configuration-options)
- [Troubleshooting](#troubleshooting)

## Overview

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a powerful debugging tool for Model Context Protocol (MCP) servers. It provides:

- **Interactive UI** - Visual interface for testing MCP tools and resources
- **Protocol Inspection** - View all JSON-RPC messages exchanged
- **Tool Testing** - Call tools with parameters and see results
- **Resource Browsing** - Explore available resources and read their contents
- **Connection Debugging** - Diagnose connection issues

## Prerequisites

Before testing, ensure you have:

1. **Obsidian Desktop** running with [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) enabled
2. **Obsidian API Key** - Copy from Obsidian Settings → Community Plugins → Local REST API
3. **Network Access** - MCP server must be able to reach Obsidian's REST API
4. **Bun** runtime installed (`brew install bun` or from [bun.sh](https://bun.sh))

## Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest.git
cd mcp-obsidian-via-rest

# Install dependencies
bun install

# Build the project
bun run build
```

### Verify Installation

```bash
# Check that MCP Inspector is available
bunx @modelcontextprotocol/inspector --help

# Verify the server can load (quick check)
bun run src/index.ts --help 2>/dev/null || echo "Server loads successfully"
```

## Transport Modes

The MCP Obsidian server supports multiple transport modes for different use cases:

| Transport | Description | Use Case | Status |
|-----------|-------------|----------|--------|
| **stdio** | Standard Input/Output | MCP clients (Claude Desktop, Windsurf) | ✅ Stable |
| **http** | HTTP with JSON-RPC | Web-based clients, custom integrations | 🚧 In Development |
| **sse** | Server-Sent Events | Real-time streaming (future) | 📋 Planned |

## Testing with Stdio Transport

### Local Development

#### 1. Set Environment Variables

```bash
# Required: Obsidian API Key (minimum 32 characters)
export API_KEY="your-obsidian-api-key-here"

# Optional: Obsidian REST API host (default: localhost)
# For WSL2 accessing Windows host:
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_HOST="https://$WSL_GATEWAY_IP"

# Optional: Obsidian REST API port (default: 27124)
export API_PORT="27124"

# Optional: Enable debug logging
export DEBUG="mcp:*"
```

#### 2. Start MCP Inspector (Local)

```bash
# Run inspector with local source
bun run mcp:inspector:local
```

This command:
```bash
bunx @modelcontextprotocol/inspector \
  -e DEBUG=mcp:* \
  -e API_KEY=$API_KEY \
  -e API_HOST=https://$WSL_GATEWAY_IP \
  bun run src/index.ts
```

The Inspector will open in your browser at `http://localhost:5173`.

#### 3. Test in Inspector

**What you should see:**

1. **Connection Status** - Green indicator showing "Connected"
2. **Server Info** - Server name and version displayed
3. **Tools Tab** - List of available tools:
   - `get_note_content` - Get note content by file path
   - `obsidian_search` - Search notes by query
   - `obsidian_semantic_search` - Semantic search notes
4. **Resources Tab** - Resource templates:
   - `obsidian://*` - Access notes via URI pattern

**Example Test - Get Note Content:**

1. Click on the `get_note_content` tool
2. Enter a file path (e.g., `Daily Notes/2025-01-12.md`)
3. Click "Execute"
4. View the note content in the response

**Example Test - Search Notes:**

1. Click on the `obsidian_search` tool
2. Enter a search query (e.g., "JavaScript")
3. Click "Execute"
4. View matching note paths in the response

**Example Test - Read Resource:**

1. Go to the "Resources" tab
2. Find `obsidian://` resource template
3. Enter a note name (e.g., `Skills/JavaScript/CORS`)
4. Click "Read"
5. View the note content

### Docker Container

#### 1. Set Environment Variables

```bash
# Same as local development
export API_KEY="your-obsidian-api-key-here"
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_HOST="https://$WSL_GATEWAY_IP"
```

#### 2. Build Docker Image

```bash
# Build latest image
bun run docker:latest

# Or build with specific tag
docker build -t mcp-obsidian:test .
```

#### 3. Start MCP Inspector (Docker)

```bash
# Run inspector with Docker container
bun run mcp:inspector:docker
```

This command:
```bash
bunx @modelcontextprotocol/inspector \
  -e DEBUG=mcp:* \
  -e API_KEY=$API_KEY \
  -e API_HOST=https://$WSL_GATEWAY_IP \
  docker run --name mcp-obsidian \
    --env DEBUG --env API_KEY --env API_HOST \
    --rm -a STDOUT -i \
    mcp/obsidian:latest
```

#### 4. Test in Inspector

Same testing steps as local development - the Inspector UI is identical.

## Testing with HTTP Transport

> **Note:** HTTP transport is currently under development. The basic endpoint structure is implemented, but full MCP protocol support is planned for future releases.

### Current Status

- ✅ HTTP server starts on configured port
- ✅ `/health` endpoint available
- ✅ MCP JSON-RPC endpoint structure at `/mcp`
- 🚧 Full MCP protocol integration (planned)

### Manual HTTP Testing (Without Inspector)

You can test the HTTP transport manually using curl:

```bash
# Set environment variables
export API_KEY="your-api-key"
export API_HOST="https://127.0.0.1"
export API_PORT="27124"

# Start the server with HTTP transport enabled (future implementation)
# TRANSPORTS=http bun run src/index.ts

# Test health endpoint
curl http://localhost:3000/health

# Test MCP endpoint (basic response)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "test",
    "params": {}
  }'
```

## Available MCP Tools and Resources

### Tools

| Tool | Description | Parameters | Example |
|------|-------------|------------|--------|
| `get_note_content` | Get content of an Obsidian note by file path | `filePath: string` | `{"filePath": "Daily/2025-01-12.md"}` |
| `obsidian_search` | Search for notes using a query string | `query: string` | `{"query": "JavaScript tutorial"}` |
| `obsidian_semantic_search` | Semantic search for notes | `query: string` | `{"query": "async patterns"}` |

### Resources

| Resource | URI Pattern | Description | Example |
|----------|-------------|-------------|---------|
| `obsidian://` | `obsidian://{name}` | Access notes by name | `obsidian://Skills/JavaScript/CORS` |

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | ✅ Yes | - | Obsidian Local REST API key (min 32 chars) |
| `API_HOST` | No | `localhost` | Obsidian REST API host |
| `API_PORT` | No | `27124` | Obsidian REST API port |
| `DEBUG` | No | - | Debug logging filter (e.g., `mcp:*`) |
| `NODE_ENV` | No | `development` | Environment mode |

### Configuration File

You can also use a JSON configuration file:

```bash
# Run with custom config
bun run src/index.ts --config ./configs/config.my.jsonc
```

Example configuration file:

```jsonc
{
  // Obsidian REST API configuration
  "apiKey": "your-api-key-here-minimum-32-chars",
  "host": "https://127.0.0.1",
  "port": 27124,

  // Transport configuration (future)
  "transports": {
    "stdio": { "enabled": true },
    "http": {
      "enabled": false,
      "port": 3000,
      "host": "0.0.0.0",
      "path": "/mcp"
    },
    "sse": {
      "enabled": false,
      "path": "/sse"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. "Failed to connect" Error

**Symptoms:** Inspector shows red "Failed to connect" status.

**Solutions:**
- Verify Obsidian is running with Local REST API enabled
- Check firewall rules allow connections to Obsidian's port (27124)
- Ensure `API_KEY` environment variable is set correctly
- Test Obsidian API directly: `curl -k https://localhost:27124`

#### 2. "Obsidian API error" in Logs

**Symptoms:** Server exits with "Obsidian API error" message.

**Solutions:**
- Verify `API_HOST` is reachable from your environment
- For WSL2: Use `export API_HOST="https://$WSL_GATEWAY_IP"`
- Check Windows Firewall allows inbound connections on port 27124
- Verify API key is correct and has sufficient length (32+ chars)

#### 3. "Module not found" Error

**Symptoms:** Error about missing modules when running Inspector.

**Solutions:**
- Run `bun install` to install dependencies
- Run `bun run build` to build the project
- Verify you're using Node.js 18+ or Bun 1.0+

#### 4. Inspector Opens But Shows No Tools

**Symptoms:** Inspector UI loads but tools/resources are empty.

**Solutions:**
- Check the Inspector's "Console" tab for error messages
- Verify server logs with `DEBUG=mcp:*` enabled
- Ensure server initialization completed successfully

#### 5. Docker Container Issues

**Symptoms:** Docker inspector fails to start.

**Solutions:**
- Verify Docker image exists: `docker images | grep mcp-obsidian`
- Build image first: `bun run docker:latest`
- Check Docker daemon is running: `docker ps`
- Remove old container: `docker rm -f mcp-obsidian`

### Debug Mode

Enable comprehensive debug logging:

```bash
# Enable all MCP-related debug logs
export DEBUG="mcp:*"

# Or enable specific namespaces
export DEBUG="mcp:server,mcp:client,mcp:transports:*"

# Run inspector with debug output
bun run mcp:inspector:local
```

### Health Check

The server creates a health file for monitoring:

```bash
# Check if server is healthy (Docker)
ls -la /tmp/mcp_healthy

# View health file contents
cat /tmp/mcp_healthy

# Check file modification time
stat /tmp/mcp_healthy
```

### Manual STDIN Testing

Test the server directly without Inspector:

```bash
# Enable debug logging
export DEBUG="mcp:*"
export API_KEY="your-api-key"
export API_HOST="https://127.0.0.1"

# Send initialize request via echo
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' | \
  bun run src/index.ts
```

## Useful Commands Reference

```bash
# Local development with Inspector
bun run mcp:inspector:local

# Docker with Inspector
bun run mcp:inspector:docker

# Run server directly
bun run src/index.ts

# Run in development mode with hot reload
bun run start:dev

# Run all unit tests
bun test ./src

# Run E2E tests (requires Obsidian running)
bun test:e2e

# Type checking
bun run checks:types

# Linting
bun run checks:lint

# Format code
bun run checks:format
```

## Additional Resources

- [MCP Inspector Repository](https://github.com/modelcontextprotocol/inspector)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Project Documentation](./readme.md)
- [Implementation Plan](./plans/multi-transport-implementation-plan.md)
