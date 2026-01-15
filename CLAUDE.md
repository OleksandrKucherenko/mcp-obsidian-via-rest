# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides access to Obsidian vaults via the Local REST API plugin. The server can run as a standalone Node/Bun application or as a Docker container, enabling AI assistants to read, search, and interact with Obsidian notes.

**Multi-Transport Architecture:**
- **Transport Manager** (`src/transports/manager.ts`) - Manages lifecycle of multiple transport types
- **MCP Server Factory** (`src/server/mcp-server.ts`) - Creates MCP server instances with tools and resources
- **Transports:**
  - `stdio` - Standard input/output transport (default, best for local MCP clients)
  - `http` - HTTP JSON-RPC with streaming support (best for remote access)
- **Self-Healing API** (`src/api/self-healing.ts`) - Automatic URL selection and reconnection
- **Configuration System** (`src/config.ts`) - Multi-URL and transport configuration

## Development Commands

### Building and Running
```bash
# Install dependencies
bun install

# Build production bundle
bun run build

# Run locally (development mode with DEBUG logs)
bun run start:dev

# Run locally (production mode)
bun run start
```

### Testing
```bash
# Unit tests (src/**/*.test.ts)
bun test ./src

# E2E tests (requires Obsidian REST API running)
bun test:e2e

# Container tests (uses testcontainers)
bun test:containers
```

### Code Quality
```bash
# Type checking
bun run checks:types

# Linting (Biome)
bun run checks:lint

# Formatting (Biome)
bun run checks:format

# Unused code detection
bun run checks:knip
```

### Docker Operations
```bash
# Build local Docker image
bun run docker:latest

# Run Docker container (requires API_KEY and API_URLS env vars)
bun run docker:run

# Start E2E test environment (dockerized Obsidian)
bun run docker:e2e:start

# Stop E2E test environment
bun run docker:e2e:stop
```

### MCP Inspector (Debugging)
```bash
# Debug with local source
bun run mcp:inspector:local

# Debug with Docker container
bun run mcp:inspector:docker
```

### Publishing
```bash
# Prepare package for publishing
bun run publish:prepare

# Create release (uses release-it)
bun run release

# Dry-run release
bun run release:dry

# Create conventional commit
bun run commit
```

## Architecture Details

### Multi-Transport Architecture

The MCP server supports multiple transport types simultaneously. Each transport gets its own isolated MCP server instance with tools and resources registered.

**Transport Manager** (`src/transports/manager.ts`):
- Accepts a server factory function that creates new MCP server instances
- Creates a separate server instance for each enabled transport
- Manages lifecycle (start/stop) for all transports
- Provides status information for all transports

**Why Separate Server Instances?**
The MCP SDK's `server.connect(transport)` method replaces any existing transport. To support multiple transports simultaneously, each transport needs its own server instance.

**Architecture Diagram:**
```
┌─────────────────────────────────────────┐
│       Self-Healing Obsidian API         │
│  (Multi-URL selection & reconnection)    │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │  Server Factory     │
        │  (creates instances)│
        └──────────┬──────────┘
                   │
            ┌──────┴──────┐
            │             │
      ┌─────▼───┐   ┌─────▼────┐
      │  MCP    │   │   MCP    │
      │ Server  │   │  Server  │
      │ (stdio) │   │  (http)  │
      └────┬────┘   └─────┬────┘
           │              │
      ┌────▼────┐   ┌─────▼──────┐
      │ Stdio   │   │   HTTP     │
      │Transport│   │ Transport  │
      └─────────┘   │ (Hono +    │
                    │  SSE)      │
                    └────────────┘
```

### MCP Server Implementation

The MCP server factory (`src/server/mcp-server.ts`) creates server instances that register:

**Tools:**
- `get_note_content` - Retrieves note content and metadata by file path
- `obsidian_search` - Searches notes using query strings
- `obsidian_semantic_search` - Semantic search (currently same as regular search)

**Resources:**
- `obsidian://{name}` - Resource template for accessing notes via URI (e.g., `obsidian://Skills/JavaScript/CORS.md`)

Each server instance is independent, so tools/resources are registered on each instance separately.

### HTTP Transport

**Hono-based HTTP Server** (`src/transports/http.transport.ts`):
- Uses `WebStandardStreamableHTTPServerTransport` for full MCP protocol support
- Supports JSON-RPC over HTTP POST
- Supports SSE streaming for responses
- Includes `/health` endpoint for health checks
- Optional Bearer token authentication via `MCP_HTTP_TOKEN`

**Request Logger** (`src/transports/hono-logger.ts`):
- Logs incoming/outgoing HTTP requests
- Uses `debug` library (writes to stderr, not stdout)
- Inspired by Hono's built-in logger middleware

### Self-Healing API

**Self-Healing Wrapper** (`src/api/self-healing.ts`):
- Tests multiple URLs in parallel on startup
- Selects fastest responding URL
- Monitors connection health every 30 seconds
- Automatically reconnects to alternative URLs on failure
- Uses exponential backoff to prevent connection thrashing

**URL Tester** (`src/api/url-tester.ts`):
- Tests multiple URLs in parallel using `Promise.all`
- Measures latency for each URL
- Returns results sorted by response time

### Configuration Loading Priority

The configuration system (`src/config.ts`) loads settings in this order (highest priority first):

1. Environment variables (`API_KEY`, `API_URLS`, or legacy `API_HOST`+`API_PORT`)
2. `.env.[NODE_ENV].local` files
3. `.env.local` files (skipped in test mode)
4. `.env.[NODE_ENV]` files
5. `.env` file
6. JSON config file (specified via `--config` or defaults to `configs/config.default.jsonc`)
7. Hardcoded defaults

**WSL2 Support:**

- Use `API_URLS` with multiple URLs including `$WSL_GATEWAY_IP` for automatic failover
- The `.envrc` file (loaded by direnv) automatically sets WSL_GATEWAY_IP variable
- Example: `API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124"]'`

### Obsidian API Client

The client (`src/client/obsidian-api.ts`) features:
- Axios-based HTTP client with self-signed certificate support
- Automatic retry logic (5 retries, 1 second timeout per request)
- Bearer token authentication via `Authorization` header
- Comprehensive error handling with detailed logging

**Implemented Endpoints:**
- Core: list notes, read/write notes, search, get metadata
- Active Note: get/set/close active note, append/patch content
- Commands: list available Obsidian commands
- Extended: batch file reading, directory listing, JSON-based search

**Not Implemented (throw "Not implemented"):**
- Command execution
- Periodic notes (daily/weekly/monthly notes)
- Note deletion

### Testing Strategy

**Unit Tests** (`src/**/*.test.ts`):
- Test individual modules and functions
- Mock external dependencies
- Run with `bun test ./src`

**E2E Tests** (`tests/*.e2e.test.ts`):
- Require a running Obsidian instance with Local REST API plugin
- Test real API calls against actual Obsidian vault
- Use `API_KEY` and `API_URLS` (or legacy `API_HOST`) environment variables

**Container Tests** (`tests/*.containers.test.ts`):
- Use testcontainers to spin up dockerized Obsidian
- Test MCP server in containerized environment
- Require Docker daemon running

### Docker Setup

The project includes a dockerized Obsidian setup for automated testing:
- Base image: Uses VNC for GUI access (port 5900)
- Required capabilities: `--cap-add SYS_ADMIN --device /dev/fuse --security-opt apparmor:unconfined` (for AppImage mounting)
- Obsidian REST API exposed on port 27124
- Test vault located at `dockerize/obsidian/data/vault-tests`

## WSL2 Development Notes

When developing on WSL2 with Obsidian running on Windows host:

1. **Get Windows host IP:**
   ```bash
   export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
   ```

2. **Configure API_URLS with automatic failover:**
   ```bash
   export API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124"]'
   ```

   For legacy single-URL configuration:
   ```bash
   export API_HOST="https://$WSL_GATEWAY_IP"
   export API_PORT="27124"
   ```

3. **Verify connectivity:**
   ```bash
   http --verify=no https://$WSL_GATEWAY_IP:27124
   ```

4. **Windows Firewall:**
   - Must allow inbound connections on port 27124
   - Add rule: `New-NetFirewallRule -DisplayName "WSL2 Obsidian REST API" -Direction Inbound -LocalPort 27124 -Protocol TCP -Action Allow`

## Code Style

- **Formatter:** Biome (2 spaces, 120 line width, semicolons as needed)
- **Linter:** Biome with recommended rules
- **Import Organization:** Enabled via Biome
- **TypeScript:** Strict mode enabled, bundler module resolution
- **Pre-commit Hooks:** Lint-staged + Husky for automatic formatting/linting

## Environment Variables

**Required:**
- `API_KEY` - Obsidian Local REST API key (minimum 32 characters)

**Obsidian API Configuration:**
- `API_URLS` - JSON array of multiple URLs for automatic failover (e.g., `["https://127.0.0.1:27124","https://172.26.32.1:27124"]`)
- `API_HOST` - Single REST API host (fallback for legacy config, default: "localhost")
- `API_PORT` - REST API port (default: "27124")
- `API_TEST_TIMEOUT` - Timeout in milliseconds for API health checks (default: "2000")
- `API_RETRY_INTERVAL` - Interval in milliseconds for reconnection attempts (default: "30000")

**Transport Configuration:**
- `MCP_TRANSPORTS` - Comma-separated list of transports to enable (default: "stdio,http", options: "stdio,http")
  - `stdio` - Standard input/output transport (for local MCP clients)
  - `http` - HTTP transport with built-in SSE streaming support (for remote access)
- `MCP_HTTP_PORT` - HTTP transport port (default: "3000")
- `MCP_HTTP_HOST` - HTTP bind address (default: "0.0.0.0")
- `MCP_HTTP_PATH` - MCP endpoint path (default: "/mcp")
- `MCP_HTTP_TOKEN` - Bearer token for HTTP authentication (optional, enables auth)

**Debugging:**
- `DEBUG` - Debug logging filter (e.g., "mcp:*" for all MCP logs)
- `NODE_ENV` - Environment mode (development/production/test)

**Testing (testcontainers):**
- `TESTCONTAINERS_RYUK_DISABLED` - Set to "true" to disable resource reaper

## Publishing Process

The project publishes to:
- **NPM (npmjs.org):** `@oleksandrkucherenko/mcp-obsidian`
- **GitHub Packages:** `@oleksandrkucherenko/mcp-obsidian`
- **Docker Registry (GHCR):** `ghcr.io/oleksandrkucherenko/obsidian-mcp`

Release workflow:
1. Run `bun run release` (uses release-it + conventional-changelog)
2. GitHub Actions automatically publish to all registries
3. Cleanup workflows run monthly to remove old packages/images

## Common Patterns

### Running with Specific Transports

**Stdio only (default):**
```bash
bun run start
# or explicitly
MCP_TRANSPORTS=stdio bun run start
```

**HTTP only:**
```bash
MCP_TRANSPORTS=http MCP_HTTP_PORT=3000 bun run start
```

**Both transports simultaneously:**
```bash
MCP_TRANSPORTS=stdio,http MCP_HTTP_PORT=3000 bun run start
```

**HTTP with authentication:**
```bash
MCP_TRANSPORTS=http MCP_HTTP_TOKEN=secret123 bun run start
```

### Testing HTTP Transport

**Health check:**
```bash
curl http://localhost:3000/health
```

**Initialize MCP connection:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
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
```

**List tools:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

### Running Single Test File
```bash
bun test ./tests/obsidian-api.e2e.test.ts
```

### Debug Logging
```bash
# Enable all MCP logs
DEBUG=mcp:* bun run src/index.ts

# Enable specific log namespaces
DEBUG=mcp:client,mcp:config bun run src/index.ts

# Show STDIN/STDOUT communication
DEBUG=mcp:push,mcp:pull bun run src/index.ts

# Show transport logs
DEBUG=mcp:transports:* bun run src/index.ts
```

### Manual STDIN Testing
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' | DEBUG=mcp:* bun run src/index.ts
```

### Multi-URL Configuration

**WSL2 with automatic failover:**
```bash
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124"]' \
MCP_TRANSPORTS=http \
bun run start
```

**Docker with multiple URLs:**
```bash
docker run --rm -p 3000:3000 \
  -e API_KEY=xxx \
  -e API_URLS='["https://host.docker.internal:27124","https://172.17.0.1:27124"]' \
  -e MCP_TRANSPORTS=http \
  ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
```

### Load Custom Config
```bash
bun run src/index.ts --config ./configs/config.wsl2.jsonc
```

### Diagnostic Scripts

The project includes diagnostic scripts in the `scripts/` directory for troubleshooting connectivity and environment issues:

**WSL2 Network Diagnostics:**
```bash
./scripts/diag.wsl2_networking.sh
```
Comprehensive WSL2 network diagnostics showing:
- WSL2 and Windows host IP addresses
- Network interfaces and Docker networks
- DNS configuration (both WSL and Windows)
- Listening ports on both WSL and Windows sides

**Verify API Access from Docker:**
```bash
./scripts/diag.docker_api.sh [port]
```
Tests Obsidian API connectivity from inside a Docker container using both direct IP and `host.docker.internal`. Default port: 27124

**macOS Docker/Colima Diagnostics:**
```bash
./scripts/diag.docker_colima.sh
```
Diagnoses Docker/Colima issues on macOS Apple Silicon:
- Colima status and Docker environment
- Architecture compatibility (ARM64 vs x86_64 emulation)
- FUSE capability tests
- Container build verification
