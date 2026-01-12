# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides access to Obsidian vaults via the Local REST API plugin. The server can run as a standalone Node/Bun application or as a Docker container, enabling AI assistants to read, search, and interact with Obsidian notes.

**Key Architecture:**
- MCP Server (`src/index.ts`) - Exposes tools and resources via stdio transport
- Obsidian API Client (`src/client/obsidian-api.ts`) - Wraps the Obsidian Local REST API with retry logic and error handling
- Configuration System (`src/config.ts`) - Loads config from .env files, JSON config files, and environment variables

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

# Run Docker container (requires API_KEY and API_HOST env vars)
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

### MCP Server Implementation

The MCP server (`src/index.ts`) registers:

**Tools:**
- `get_note_content` - Retrieves note content and metadata by file path
- `obsidian_search` - Searches notes using query strings
- `obsidian_semantic_search` - Semantic search (currently same as regular search)

**Resources:**
- `obsidian://{name}` - Resource template for accessing notes via URI (e.g., `obsidian://Skills/JavaScript/CORS.md`)

**Health Check:**
- Creates/updates `/tmp/mcp_healthy` file every 5 seconds for Docker health monitoring

### Configuration Loading Priority

The configuration system (`src/config.ts`) loads settings in this order (highest priority first):
1. Environment variables (`API_KEY`, `API_HOST`, `API_PORT`)
2. `.env.[NODE_ENV].local` files
3. `.env.local` files (skipped in test mode)
4. `.env.[NODE_ENV]` files
5. `.env` file
6. JSON config file (specified via `--config` or defaults to `configs/config.default.jsonc`)
7. Hardcoded defaults

**WSL2 Support:**
- Use `$WSL_GATEWAY_IP` for `API_HOST` when Obsidian runs on Windows host
- The `.envrc` file (loaded by direnv) automatically sets this variable

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
- Use `API_KEY` and `API_HOST` environment variables

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

2. **Set API_HOST:**
   ```bash
   export API_HOST="https://$WSL_GATEWAY_IP"
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

**Optional:**
- `API_HOST` - REST API host (default: "localhost", WSL2: "$WSL_GATEWAY_IP")
- `API_PORT` - REST API port (default: "27124")
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
```

### Manual STDIN Testing
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' | DEBUG=mcp:* bun run src/index.ts
```

### Load Custom Config
```bash
bun run src/index.ts --config ./configs/config.wsl2.jsonc
```
