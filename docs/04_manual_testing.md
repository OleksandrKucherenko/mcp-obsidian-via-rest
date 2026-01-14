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
- [Testing with LLM CLIs](#testing-with-llm-clis)
  - [CLI Capability Snapshot](#cli-capability-snapshot)
  - [Quick Stdio Smoke Test](#quick-stdio-smoke-test)
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
| **http** | HTTP with JSON-RPC | Web-based clients, custom integrations | ✅ Stable |
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

**Pro Tip: Smart Multi-URL Configuration**

For WSL2 or environments with multiple possible Obsidian locations, configure multiple URLs:

```bash
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_URLS="[\"https://127.0.0.1:27124\",\"https://$WSL_GATEWAY_IP:27124\"]"
```

The MCP server will:
- Test all URLs in parallel
- Selects fastest responding URL
- Automatically reconnects to alternatives if connection fails
- Monitor health every 30 seconds

> **Important Note:** Multi-URL configuration (`API_URLS`) doesn't work with OpenCode CLI due to JSON parsing issues with environment variables containing arrays. Use the single `API_HOST` + `API_PORT` approach for OpenCode CLI instead. Multi-URL works fine for direct CLI testing and Docker.

See [E2E Verification Guide](./05_e2e_verification.md) for complete multi-URL setup examples.

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

HTTP transport is fully functional and supports standard MCP protocol over HTTP with SSE streaming.

### Configuration

To use HTTP transport, set the `MCP_TRANSPORTS` environment variable:

```bash
# Enable HTTP transport on port 3000
export MCP_TRANSPORTS=http
export MCP_HTTP_PORT=3000
```

### HTTP Testing with curl

See the **[Quick Command Line Testing](#quick-command-line-testing)** section for practical, tested HTTP commands.

### Important: HTTP Accept Headers

HTTP transport requires specific `Accept` headers to work correctly:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
```

Without the `Accept` header, the server will return:
```json
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}
```

### HTTP vs Stdio Transport

| Feature | Stdio | HTTP |
|---------|--------|------|
| Connection | Pipes to STDIN/STDOUT | HTTP POST requests |
| Streaming | Built-in | SSE (Server-Sent Events) |
| Session Management | Automatic | Requires initialize per connection |
| Best For | CLI tools, Desktop apps | Web clients, Remote access |

## Testing with OpenCode CLI

OpenCode CLI supports MCP servers via the `opencode.json` configuration file in your project root.

### Configuration Options

The project's `opencode.json` includes three pre-configured MCP server entries:

| Configuration | Description | Command | Default Status |
|---------------|-------------|---------|----------------|
| **mcp-obsidian** | Run from source code (development) | `bun run src/index.ts` | Disabled |
| **mcp-obsidian-built** | Run using installed binary | `mcp-obsidian` | Disabled |
| **mcp-obsidian-docker** | Run as Docker container | `docker run` | Disabled |

Enable only the configuration you want to use by setting `"enabled": true` in `opencode.json`.

### Environment Variables

Set the required environment variables before starting OpenCode:

```bash
# Required: Obsidian API Key
export API_KEY="your-obsidian-api-key-here"

# Optional: Obsidian REST API host (default: localhost)
export API_HOST="https://127.0.0.1"

# Optional: Obsidian REST API port (default: 27124)
export API_PORT="27124"

# For WSL2 accessing Windows host:
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_HOST="https://$WSL_GATEWAY_IP"
```

### Configuration 1: Run from Source Code

This is the recommended setup for development. It runs the MCP server directly from the source code with hot reload support.

#### Setup

1. Install dependencies and build the project:
   ```bash
   bun install
   bun run build
   ```

2. Update `opencode.json` to enable the source code configuration:
   ```json
   {
     "mcp": {
       "mcp-obsidian": {
         "type": "local",
         "command": ["bun", "run", "src/index.ts"],
         "environment": {
           "API_KEY": "{env:API_KEY}",
           "API_HOST": "{env:API_HOST}",
           "API_PORT": "{env:API_PORT}",
           "DEBUG": "mcp:*"
         },
         "enabled": true
       },
       "mcp-obsidian-built": { "enabled": false },
       "mcp-obsidian-docker": { "enabled": false }
     }
   }
   ```

3. Start OpenCode:
   ```bash
   opencode
   ```

#### Benefits

- **Hot reload**: Changes to source code are automatically reflected
- **Debug logging**: Enabled by default with `DEBUG=mcp:*`
- **Fast iteration**: No need to rebuild between changes
- **Source maps**: Full debugging support

### Configuration 2: Run as Built Binary

This setup uses the compiled binary. It's faster for production use and doesn't require rebuilding on code changes.

#### Setup

1. Build the project and install the binary:
   ```bash
   bun run build
   npm link  # or: bun link && bun link --global
   ```

2. Verify the binary is installed:
   ```bash
   mcp-obsidian --help
   ```

3. Update `opencode.json` to enable the built binary configuration:
   ```json
   {
     "mcp": {
       "mcp-obsidian": { "enabled": false },
       "mcp-obsidian-built": {
         "type": "local",
         "command": ["mcp-obsidian"],
         "environment": {
           "API_KEY": "{env:API_KEY}",
           "API_HOST": "{env:API_HOST}",
           "API_PORT": "{env:API_PORT}",
           "DEBUG": "mcp:*"
         },
         "enabled": true
       },
       "mcp-obsidian-docker": { "enabled": false }
     }
   }
   ```

4. Restart OpenCode:
   ```bash
   opencode
   ```

#### Benefits

- **Fast startup**: No build step required
- **Portable**: Works without Node.js/Bun installed in PATH
- **Production ready**: Compiled and optimized
- **Minimal dependencies**: Only the binary is needed

### Configuration 3: Run as Docker Container

This setup runs the MCP server in a Docker container. It provides isolation and consistent behavior across different environments.

#### Setup

1. Pull or build the Docker image:

   **Option A: Pull from GitHub Container Registry**
   ```bash
   docker pull ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
   ```

   **Option B: Build locally**
   ```bash
   bun run docker:latest
   # Or: docker build -t mcp/obsidian:latest -f Dockerfile .
   ```

2. Verify the image exists:
   ```bash
   docker images | grep obsidian-mcp
   ```

3. Update `opencode.json` to enable the Docker configuration:

   **Using locally built image:**
   ```json
   {
     "mcp": {
       "mcp-obsidian": { "enabled": false },
       "mcp-obsidian-built": { "enabled": false },
       "mcp-obsidian-docker": {
         "type": "local",
         "command": [
           "docker",
           "run",
           "--name",
           "mcp-obsidian",
           "--rm",
           "-i",
           "--network=host",
           "mcp/obsidian:latest"
         ],
         "environment": {
           "API_KEY": "{env:API_KEY}",
           "API_HOST": "{env:API_HOST}",
           "API_PORT": "{env:API_PORT}",
           "DEBUG": "mcp:*"
         },
         "enabled": true
       }
     }
   }
   ```

   **Using GHCR image:**
   ```json
   {
     "mcp": {
       "mcp-obsidian": { "enabled": false },
       "mcp-obsidian-built": { "enabled": false },
       "mcp-obsidian-docker": {
         "type": "local",
         "command": [
           "docker",
           "run",
           "--name",
           "mcp-obsidian",
           "--rm",
           "-i",
           "--network=host",
           "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
         ],
         "environment": {
           "API_KEY": "{env:API_KEY}",
           "API_HOST": "{env:API_HOST}",
           "API_PORT": "{env:API_PORT}",
           "DEBUG": "mcp:*"
         },
         "enabled": true
       }
     }
   }
   ```

4. Restart OpenCode:
   ```bash
   opencode
   ```

#### Docker-specific Options

For WSL2 or Docker Desktop scenarios, use host networking for better connectivity:

```json
{
  "command": [
    "docker",
    "run",
    "--name",
    "mcp-obsidian",
    "--rm",
    "-i",
    "--network=host"
  ]
}
```

For custom networking:

```json
{
  "command": [
    "docker",
    "run",
    "--name",
    "mcp-obsidian",
    "--rm",
    "-i",
    "-p",
    "3000:3000"
  ]
}
```

#### Benefits

- **Isolation**: No dependency conflicts with host system
- **Reproducible**: Same behavior across all environments
- **Clean**: No files left on the host (`--rm` flag)
- **Network isolation**: Can be configured with custom networking

#### Troubleshooting Docker

Remove old containers if they exist:

```bash
docker rm -f mcp-obsidian
```

Check Docker logs:

```bash
docker logs mcp-obsidian
```

### Testing with OpenCode

#### 1. Start OpenCode

```bash
opencode
```

#### 2. Initialize the project

```
/init
```

#### 3. Test the MCP server

In the OpenCode TUI, use prompts to test the MCP tools:

```
List MCP tools available from the obsidian server.
```

```
Use the mcp-obsidian tool to search for notes about JavaScript.
```

```
Use the mcp-obsidian tool to get content of Daily/2025-01-12.md.
```

#### 4. Inspect MCP status

OpenCode provides built-in MCP management:

```bash
# List all MCP servers and their status
opencode mcp list

# Test connection to a specific MCP server
opencode mcp debug mcp-obsidian
```

#### 5. Test MCP Tool Execution

Verified working approach for testing MCP tools with OpenCode:

```bash
# List available models
opencode models

# Use free model for testing (no API key required)
opencode run -m "opencode/big-pickle" \
  "List all available MCP tools from the obsidian server. Just list them, don't execute anything."
```

**Expected Output:**
```
1. get_note_content - Get content of obsidian note by file path
2. obsidian_search - Search for notes using a query string
3. obsidian_semantic_search - Search for notes using a query string
```

```bash
# Test search functionality
opencode run -m "opencode/big-pickle" \
  "Use the obsidian_search tool to search for notes about Docker"
```

**Expected Output:**
```
mcp-obsidian_obsidian_search {"query":"Docker"}

Found 76 notes about Docker. The search results include notes covering Docker configuration...
```

```bash
# Test get_note_content functionality
opencode run -m "opencode/big-pickle" \
  "Use get_note_content tool to read Skills/Docker/Overview.md"
```

### Advanced Configuration

#### Per-Agent Tool Control

You can control which MCP tools are available per agent in `AGENTS.md`:

```markdown
When working with documentation, use the `mcp-obsidian` tools to search and read notes.
```

#### HTTP Transport (Future)

Once HTTP transport is fully implemented, you can configure it in OpenCode:

```json
{
  "mcp": {
    "mcp-obsidian-http": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": false
    }
  }
}
```

#### Switching Between Configurations

To switch between configurations, simply change which entry has `"enabled": true` and restart OpenCode:

```json
{
  "mcp": {
    "mcp-obsidian": { "enabled": false },
    "mcp-obsidian-built": { "enabled": true },
    "mcp-obsidian-docker": { "enabled": false }
  }
}
```

## Quick Command Line Testing

These are the fastest, most practical commands to verify your MCP server is working correctly with your Obsidian instance.

> **Looking for complete E2E verification?** See [E2E Verification Guide](./05_e2e_verification.md) for:
> - Multi-URL smart configuration with automatic API discovery
> - Docker hosted MCP server testing
> - OpenCode CLI integration with tool execution verification
> - Complete end-to-end workflow verification

### Tested Configurations Summary

The following configurations have been verified and tested:

| Configuration | Status | Tool Recognition | Test Date |
|--------------|--------|------------------|------------|
| **Multi-URL Smart Config** | ✅ Verified | 3 tools detected | 2026-01-12 |
| **Docker Hosted Server** | ✅ Verified | 3 tools detected | 2026-01-12 |
| **OpenCode CLI Integration** | ✅ Verified | Tools executable | 2026-01-12 |
| **HTTP Transport** | ✅ Verified | Health endpoint | 2026-01-12 |

See [E2E Verification Guide](./05_e2e_verification.md) for detailed test results and verification steps.

### Setup Environment Variables

First, set your environment variables:

```bash
# Required: Obsidian API Key
export API_KEY="your-obsidian-api-key-here"

# For local Obsidian:
export API_HOST="https://localhost"

# For WSL2 accessing Windows host Obsidian:
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
export API_HOST="https://$WSL_GATEWAY_IP"

# Default port (usually 27124)
export API_PORT="27124"
```

### Test 1: Verify Obsidian API is Reachable

Before testing MCP, confirm you can reach Obsidian's REST API:

```bash
curl -k $API_HOST:$API_PORT
```

**Expected output:** JSON response with status "OK" and manifest info.

### Test 2: Stdio Mode - List Available Tools

Test that the MCP server starts and responds with tool list:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  bun run src/index.ts
```

**Expected output:** JSON with `result.tools` array containing `get_note_content`, `obsidian_search`, `obsidian_semantic_search`.

### Test 3: Stdio Mode - Search Notes

Test the search functionality:

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"obsidian_search","arguments":{"query":"JavaScript"}}}' | \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  bun run src/index.ts
```

**Expected output:** JSON with array of note file paths matching the search query.

### Test 4: Stdio Mode - Get Note Content

Test retrieving a specific note's content:

```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_note_content","arguments":{"filePath":"Skills/JavaScript/Jest/moduleNameMapper.md"}}}' | \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  bun run src/index.ts
```

**Expected output:** JSON with note content in `result.content` array.

### Test 5: HTTP Mode - Health Check

Test the HTTP transport's health endpoint:

```bash
# Start HTTP server in background
MCP_TRANSPORTS=http MCP_HTTP_PORT=3000 \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  bun run src/index.ts &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check health
curl -s http://localhost:3000/health

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

**Expected output:** `{"status":"healthy","timestamp":"...","transport":"http","authEnabled":false}`

### Test 6: HTTP Mode - Initialize Connection

Test MCP protocol over HTTP:

```bash
# Start HTTP server in background
MCP_TRANSPORTS=http MCP_HTTP_PORT=3000 \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  bun run src/index.ts &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Initialize connection
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

**Expected output:** JSON with server capabilities and info (via SSE format with `event: message` and `data:` prefix).

### Summary of Expected Behavior

| Test | Command | Expected Result |
|------|---------|-----------------|
| Obsidian API | `curl -k $API_HOST:$API_PORT` | JSON with status "OK" |
| Stdio tools/list | `echo ... \| bun run src/index.ts` | List of 3 tools |
| Stdio obsidian_search | `echo ... \| bun run src/index.ts` | Array of note paths |
| Stdio get_note_content | `echo ... \| bun run src/index.ts` | Note content in JSON |
| HTTP health | `curl http://localhost:3000/health` | Healthy status |
| HTTP initialize | `curl POST /mcp` | Server info in SSE format |

### One-Liner Quick Test

For a quick smoke test, combine all checks into one command:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
  timeout 5 bun run src/index.ts | grep -q "get_note_content" && \
  echo "✅ MCP Server is working!"
```

### Automated Test Script

Use the provided test script for comprehensive testing:

```bash
# Setup environment
export API_KEY="your-obsidian-api-key"
export API_HOST="https://localhost"
export API_PORT="27124"

# Run quick test (basic checks only)
./tests/manual/opencode/test.mcp_quick.sh

# Run quick test with search query
./tests/manual/opencode/test.mcp_quick.sh "TypeScript"
```

The script tests:
1. Obsidian API connectivity
2. MCP server tools listing
3. Search functionality (if query provided)
4. HTTP transport health check

## Testing with LLM CLIs

This section captures how to do quick manual checks with popular LLM CLIs (Codex, Gemini, Claude).
These CLIs typically connect to MCP servers via a `mcp.json` file or CLI-specific flags.
Use `--help` for the exact wiring in your installed version.

### CLI Capability Snapshot

```bash
codex --help
gemini --help
claude --help
```

What to look for in the help output:

- **Codex CLI**: `mcp` (manage MCP servers) and `mcp-server` (run MCP server, stdio)
- **Gemini CLI**: `mcp` command plus MCP-related allowlist flags (server names/tools)
- **Claude CLI**: `--mcp-config` / `--strict-mcp-config` flags and `mcp` command

### Gemini CLI: Concrete MCP Commands

Gemini uses `settings.json` plus `gemini mcp` subcommands to manage MCP servers.
Use project scope (`.gemini/settings.json`) by default.

#### Add stdio MCP server

```bash
gemini mcp add \
  -e API_KEY=your-obsidian-api-key \
  -e API_HOST=https://127.0.0.1 \
  -e API_PORT=27124 \
  obsidian-stdio \
  bun run src/index.ts
```

#### Add HTTP MCP server (streamable HTTP)

```bash
gemini mcp add --transport http obsidian-http http://localhost:3000/mcp
```

#### Add SSE MCP server

```bash
gemini mcp add --transport sse obsidian-sse http://localhost:3000/sse
```

#### List and remove servers

```bash
gemini mcp list
gemini mcp remove obsidian-stdio
```

#### In-chat inspection

```text
/mcp
```

This shows connected servers, tools, and resources. You can reference resources as
`@obsidian-stdio://path/to/note` in the chat.

#### One-shot prompt (non-interactive)

Gemini accepts a positional prompt argument, which makes a simple bash one-liner:

```bash
gemini --allowed-mcp-server-names obsidian-stdio \
  "List MCP tools available from obsidian-stdio."
```

If you want to allow a specific tool without confirmation:

```bash
gemini --allowed-mcp-server-names obsidian-stdio \
  --allowed-tools get_note_content \
  "Call get_note_content on Daily Notes/2025-01-12.md."
```

Note: `-p/--prompt` is deprecated; prefer the positional prompt shown above.

### Kilo Code CLI: MCP Configuration

Kilo CLI supports MCP servers, but uses its own config files.

- Global config: `~/.kilocode/cli/global/settings/mcp_settings.json`
- Project config: `.kilocode/mcp.json` (takes precedence)

#### Example (stdio)

```json
{
  "mcpServers": {
    "obsidian-stdio": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "env": {
        "API_KEY": "your-obsidian-api-key",
        "API_HOST": "https://127.0.0.1",
        "API_PORT": "27124"
      }
    }
  }
}
```

#### Example (streamable HTTP)

```json
{
  "mcpServers": {
    "obsidian-http": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

#### Example (SSE)

```json
{
  "mcpServers": {
    "obsidian-sse": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

Supported options include `command`, `args`, `env`, `type` (`stdio`, `streamable-http`, `sse`),
`url`, `headers`, `alwaysAllow`, `disabled`, and `timeout` (seconds).

Project-level config overrides the global config when both are present.

Auto-approval can be toggled with:

```bash
export KILO_AUTO_APPROVAL_MCP_ENABLED=true
```

### Quick Stdio Smoke Test

#### 1. Create a local MCP config

```bash
cat > mcp.json <<'JSON'
{
  "mcpServers": {
    "obsidian-stdio": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_HOST": "https://127.0.0.1",
        "API_PORT": "27124",
        "DEBUG": "mcp:*"
      }
    }
  }
}
JSON
```

#### 2. Run a CLI with MCP enabled

Claude Code accepts a config directly:

```bash
claude --mcp-config ./mcp.json -p "List MCP tools available from the obsidian server."
```

For Codex and Gemini, register or load the MCP config using their MCP management command:

```bash
codex mcp --help
gemini mcp --help
```

Then run the CLI and prompt it to list tools or call one:

```text
List MCP tools available from the obsidian server and call get_note_content on a known file.
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

### Configuration Examples Script

Use the provided configuration examples script to see all tested configurations:

```bash
# View all configuration examples
./tests/manual/opencode/demo.config.sh
```

This script displays ready-to-use commands for:
1. Multi-URL smart configuration
2. Docker with multi-URL
3. OpenCode CLI integration
4. Quick test commands
5. OpenCode MCP configuration options

### Quick Testing Aliases (Optional)

Add these to your shell config (`~/.bashrc`, `~/.zshrc`) for faster testing:

```bash
# Test MCP server with tools/list
alias mcp-test='echo '\''{"jsonrpc":"2.0","id":1,"method":"tools/list"}'\'' | bun run src/index.ts'

# Test MCP server search
alias mcp-search='echo '\''{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"obsidian_search","arguments":{"query":"$1"}}}'\'' | bun run src/index.ts'

# Test Obsidian API connectivity
alias obsidian-ping='curl -k $API_HOST:$API_PORT'
```

Usage:
```bash
mcp-test                    # List available tools
mcp-search "TypeScript"     # Search for TypeScript notes
obsidian-ping              # Test Obsidian API connection
```

## Additional Resources

- [MCP Inspector Repository](https://github.com/modelcontextprotocol/inspector)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Project Documentation](./readme.md)
- [Implementation Plan](./plans/multi-transport-implementation-plan.md)
- **[E2E Verification Guide](./05_e2e_verification.md)** - Complete end-to-end testing with verified configurations
- **[Helper Scripts](../tests/manual/opencode/)** - `test.mcp_quick.sh` and `demo.config.sh` for automated testing
