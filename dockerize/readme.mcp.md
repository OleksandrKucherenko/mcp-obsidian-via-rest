# obsidian-mcp

A Dockerized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides AI assistants with secure access to your [Obsidian](https://obsidian.md/) vault via the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api). This image enables seamless integration between AI tools (Claude Code, Gemini, OpenCode, Kilo Code, Codex, GitHub Copilot CLI) and your personal knowledge base.

---

## Image Location

| Registry                  | Image Reference                                |
| ------------------------- | ---------------------------------------------- |
| Docker Hub                | `oleksandrkucherenko/obsidian-mcp:tag`         |
| GitHub Container Registry | `ghcr.io/oleksandrkucherenko/obsidian-mcp:tag` |

---

## Supported Tags

| Tag                   | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `latest`              | Latest stable release (recommended for production)      |
| `vX.Y.Z`              | Specific version (e.g., `v0.6.0`)                       |
| `vX.Y`                | Latest patch release for a minor version (e.g., `v0.6`) |
| `vX`                  | Latest release for a major version (e.g., `v0`)         |
| `next`                | Latest pre-release (alpha/beta/rc)                      |
| `alpha`, `beta`, `rc` | Pre-release builds for testing                          |
| `sha-<commit>`        | Build from specific commit SHA                          |

---

## What's Inside

### Base Image

- **Base**: `oven/bun:1.2-alpine` (Alpine Linux with Bun runtime)
- **Architecture**: Multi-arch support (`linux/amd64`, `linux/arm64`)

### Included Components

- **Runtime**: Bun 1.2 (fast JavaScript runtime)
- **Process Manager**: Tini (init system for proper signal handling)
- **HTTP Server**: Hono (lightweight web framework for HTTP transport)
- **MCP SDK**: `@modelcontextprotocol/sdk` (official MCP server SDK)

### Exposed Ports

| Port   | Protocol | Description                                   |
| ------ | -------- | --------------------------------------------- |
| `3000` | HTTP     | MCP HTTP transport endpoint (default: `/mcp`) |

### Default User

- **User**: `bun` (non-root)
- **Home**: `/home/bun`

### Health Check

- **Endpoint**: `http://localhost:3000/health`
- **Interval**: 10 seconds
- **Timeout**: 5 seconds
- **Start Period**: 30 seconds
- **Retries**: 5

---

## Quick Start

### Pull the Image

```bash
docker pull oleksandrkucherenko/obsidian-mcp:latest
```

### Minimal Run (Stdio Transport)

```bash
docker run --rm -i \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  oleksandrkucherenko/obsidian-mcp:latest
```

### Minimal Run (HTTP Transport)

```bash
docker run --rm \
  -p 3000:3000 \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  oleksandrkucherenko/obsidian-mcp:latest
```

---

## Configuration

### Environment Variables

| Variable             | Required | Default             | Description                                                                                                    |
| -------------------- | -------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `API_KEY`            | Yes      | -                   | Obsidian Local REST API key (min 32 characters)                                                                |
| `API_URLS`           | No*      | `[]`                | JSON array of Obsidian API URLs for failover (e.g., `["https://127.0.0.1:27124","https://172.26.32.1:27124"]`) |
| `API_HOST`           | No*      | `https://127.0.0.1` | Legacy single URL host (use `API_URLS` for failover)                                                           |
| `API_PORT`           | No*      | `27124`             | Legacy single URL port (use `API_URLS` for failover)                                                           |
| `MCP_TRANSPORTS`     | No       | `stdio,http`        | Comma-separated transports: `stdio`, `http`                                                                    |
| `MCP_HTTP_PORT`      | No       | `3000`              | HTTP transport port                                                                                            |
| `MCP_HTTP_HOST`      | No       | `0.0.0.0`           | HTTP transport bind address                                                                                    |
| `MCP_HTTP_PATH`      | No       | `/mcp`              | HTTP transport endpoint path                                                                                   |
| `MCP_HTTP_TOKEN`     | No       | -                   | Bearer token for HTTP transport authentication                                                                 |
| `API_TEST_TIMEOUT`   | No       | `2000`              | URL health check timeout in milliseconds                                                                       |
| `API_RETRY_INTERVAL` | No       | `30000`             | Retry interval for failed connections (ms)                                                                     |
| `DEBUG`              | No       | -                   | Debug logging (e.g., `mcp:*`)                                                                                  |

\* Either `API_URLS` OR `API_HOST`+`API_PORT` must be provided. `API_URLS` is recommended for production.

### Volumes

| Path                           | Description         |
| ------------------------------ | ------------------- |
| No persistent volumes required | Stateless container |

### Entrypoint / CMD

- **Entrypoint**: `/sbin/tini -s --` (init system for proper signal handling)
- **CMD**: `bun run dist/index.js` (start MCP server)

---

## Usage Examples

### Production Example with Failover

```bash
docker run --name mcp-obsidian \
  --restart unless-stopped \
  -p 3000:3000 \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124","https://172.26.32.1:27124","https://host.docker.internal:27124"]' \
  -e MCP_TRANSPORTS="stdio,http" \
  oleksandrkucherenko/obsidian-mcp:latest
```

### Local Development with Debug Logs

```bash
docker run --rm -i \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  -e DEBUG="mcp:*" \
  oleksandrkucherenko/obsidian-mcp:latest
```

### HTTP Transport with Authentication

```bash
docker run --rm \
  -p 3000:3000 \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  -e MCP_HTTP_TOKEN="your-secret-token" \
  oleksandrkucherenko/obsidian-mcp:latest
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  mcp-obsidian:
    image: oleksandrkucherenko/obsidian-mcp:latest
    container_name: mcp-obsidian
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - API_KEY=${OBSIDIAN_API_KEY}
      - API_URLS=["https://127.0.0.1:27124","https://172.26.32.1:27124"]
      - MCP_TRANSPORTS=stdio,http
      - MCP_HTTP_TOKEN=${MCP_HTTP_TOKEN}
      - DEBUG=mcp:*
```

### WSL2 Example

```bash
# Determine WSL gateway IP
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

docker run --rm -i \
  -e API_KEY="your-obsidian-api-key" \
  -e API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124", "https://host.docker.internal:27124"]' \
  oleksandrkucherenko/obsidian-mcp:latest
```

---

## Healthchecks

The MCP server supports multiple healthcheck methods. Choose the one that best fits your use case.

### Method 1: HTTP Endpoint (Recommended for HTTP Transport)

Best for containers with HTTP transport enabled. Checks the `/health` endpoint directly.

```yaml
healthcheck:
  test: [ "CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health" ]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**Manual check:**

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' mcp-obsidian

# Check health endpoint directly
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-16T12:00:00.000Z",
  "transport": "http",
  "authEnabled": false
}
```

### Method 2: Heartbeat File (Recommended for Stdio Transport)

Best for containers with stdio transport only. The MCP server updates a heartbeat file every 5 seconds.

```yaml
healthcheck:
  test: [ "CMD", "stat", "/tmp/mcp_healthy" ]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**How it works:**

- The MCP server creates `/tmp/mcp_healthy` on startup
- The file's modification time is updated every 5 seconds
- If the file exists, the container is considered healthy

### Method 3: Heartbeat File with Age Check (Most Reliable)

Best for production deployments. Checks both file existence and recent modification time.

```yaml
healthcheck:
  test: [ "CMD-SHELL", "test -f /tmp/mcp_healthy && test $(($(date +%s) - $(stat -c %Y /tmp/mcp_healthy))) -lt 30" ]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**How it works:**

- Checks if `/tmp/mcp_healthy` exists
- Verifies the file was modified within the last 30 seconds
- If file is older than 30 seconds, the container is considered unhealthy

### Built-in HEALTHCHECK (Dockerfile)

The Dockerfile includes a default health check using the HTTP endpoint:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

**Note:** This default can be overridden in docker-compose files or `docker run` commands.

### Comprehensive Health Status

For detailed health information including Obsidian API connection and all transports:

```bash
curl http://localhost:3000/health?full=true
```

**Response:**

```json
{
  "healthy": true,
  "obsidian": {
    "connected": true,
    "url": "https://127.0.0.1:27124",
    "lastCheck": 1737033600000
  },
  "transports": {
    "stdio": { "running": true, "enabled": true },
    "http": { "running": true, "enabled": true }
  },
  "uptime": 3600,
  "timestamp": 1737033600000
}
```

---

## Security Notes

### User Permissions

- Container runs as **non-root user** `bun` (UID/GID determined by base image)
- No privileged operations required for normal operation

### Secrets Handling

- **API Key**: Pass via environment variable `API_KEY` (minimum 32 characters)
- **HTTP Token**: Pass via `MCP_HTTP_TOKEN` for Bearer authentication
- Use Docker secrets or orchestration tools (Kubernetes, Docker Swarm) for production deployments

### Network Security

- HTTP transport binds to `0.0.0.0:3000` by default (all interfaces)
- Restrict access using firewall rules or network policies
- Use `MCP_HTTP_TOKEN` to protect HTTP endpoint from unauthorized access

### CVE Scanning

- Base image (`oven/bun:1.2-alpine`) is regularly updated
- Alpine Linux provides minimal attack surface
- Dependabot and GitHub Actions monitor for vulnerabilities

---

## Troubleshooting

### Common Issues

#### Container exits immediately

```bash
# Check logs
docker logs mcp-obsidian

# Common causes:
# - Invalid API_KEY (must be 32+ characters)
# - Obsidian REST API not running
# - Network connectivity issues
```

#### Connection refused to Obsidian API

```bash
# Verify Obsidian REST API is accessible
curl --insecure https://127.0.0.1:27124

# Check firewall rules (Windows)
netsh advfirewall firewall show rule name=all | findstr 27124

# Test from container
docker run --rm --network=host busybox wget -qO- --no-check-certificate https://127.0.0.1:27124
```

#### Health check failing

```bash
# Check health status
docker inspect --format='{{json .State.Health}}' mcp-obsidian | jq

# Verify HTTP transport is enabled
docker exec mcp-obsidian env | grep MCP_TRANSPORTS
```

#### Debug logging

```bash
# Enable debug logs
docker run --rm -i \
  -e API_KEY="your-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  -e DEBUG="mcp:*" \
  oleksandrkucherenko/obsidian-mcp:latest
```

### Debug Tips

```bash
# View container logs
docker logs -f mcp-obsidian

# Inspect container state
docker inspect mcp-obsidian

# Execute shell in container
docker exec -it mcp-obsidian sh

# Check environment variables
docker exec mcp-obsidian env | grep -E 'API_|MCP_'

# Test HTTP endpoint
curl -v http://localhost:3000/health

# Test with MCP Inspector
docker run --rm -i \
  -e API_KEY="your-api-key" \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  oleksandrkucherenko/obsidian-mcp:latest | \
  bunx @modelcontextprotocol/inspector
```

---

## MCP Tools & Resources

### Tools

| Tool                       | Description                                       | Parameters                             |
| -------------------------- | ------------------------------------------------- | -------------------------------------- |
| `get_note_content`         | Retrieve content and metadata of an Obsidian note | `filePath` (string) - Path to the note |
| `obsidian_search`          | Search notes using a query string                 | `query` (string) - Search query        |
| `obsidian_semantic_search` | Semantic search for notes                         | `query` (string) - Search query        |

### Resources

| Resource      | URI Pattern         | Description                                                   |
| ------------- | ------------------- | ------------------------------------------------------------- |
| Obsidian Note | `obsidian://{path}` | Access notes via URI (e.g., `obsidian://Daily/2025-01-16.md`) |

---

## Transports

### Stdio Transport (Default)

- Best for local MCP clients
- Uses standard input/output for JSON-RPC communication
- Requires `-i` flag in `docker run` to keep STDIN open

### HTTP Transport

- Best for remote access
- Supports SSE (Server-Sent Events) streaming
- Includes optional Bearer token authentication
- Endpoint: `http://localhost:3000/mcp`

---

## CLI Tools Configuration

### Claude Code CLI

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS", "oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      }
    }
  }
}
```

### Gemini CLI

```bash
gemini mcp add \
  -e API_KEY=<your-obsidian-api-key> \
  -e API_URLS='["https://host.docker.internal:27124"]' \
  obsidian \
  docker run --rm -i oleksandrkucherenko/obsidian-mcp:latest
```

### OpenCode CLI

```json
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["docker", "run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS", "oleksandrkucherenko/obsidian-mcp:latest"],
      "environment": {
        "API_KEY": "{env:API_KEY}",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      },
      "enabled": true
    }
  }
}
```

### Kilo Code CLI

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS", "oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      }
    }
  }
}
```

### Codex CLI

```bash
codex mcp add obsidian \
  --command "docker run --rm -i -e API_KEY -e API_URLS oleksandrkucherenko/obsidian-mcp:latest" \
  --env API_KEY=<your-obsidian-api-key> \
  --env 'API_URLS=["https://host.docker.internal:27124"]'
```

### GitHub Copilot CLI

```json
{
  "mcpServers": {
    "obsidian": {
      "type": "local",
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS", "oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "${OBSIDIAN_API_KEY}",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      },
      "tools": ["*"]
    }
  }
}
```

---

## Build + Publish Info (for Maintainers)

### Dockerfile Location

- **MCP Image**: `./Dockerfile` (root directory)
- **VNC Image**: `./dockerize/Dockerfile` (separate image with Obsidian + VNC)

### CI Pipeline

- **GitHub Actions**: `.github/workflows/docker-hub.yml`
- **Triggers**: Version tags (`v*`) and manual workflow dispatch
- **Platforms**: `linux/amd64`, `linux/arm64`

### Build Locally

```bash
# Build MCP image
docker build -t obsidian-mcp:latest .

# Build for specific platform
docker buildx build --platform linux/amd64 -t obsidian-mcp:latest .

# Build and push to Docker Hub
docker buildx build --platform linux/amd64,linux/arm64 -t oleksandrkucherenko/obsidian-mcp:latest --push .
```

### Publish New Version

1. Create and push a version tag:

   ```bash
   git tag v0.6.0
   git push origin v0.6.0
   ```

2. GitHub Actions will automatically:
   - Build multi-arch images
   - Push to Docker Hub (`oleksandrkucherenko/obsidian-mcp`)
   - Push to GHCR (`ghcr.io/oleksandrkucherenko/obsidian-mcp`)
   - Update Docker Hub description

3. Tags are applied automatically:
   - Stable releases get `latest`, `vX.Y.Z`, `vX.Y`, `vX`
   - Pre-releases get `next` and specific tags (`alpha`, `beta`, `rc`)

---

## Changelog / Versioning Policy

### Versioning

- **Semantic Versioning**: Follows SemVer (`MAJOR.MINOR.PATCH`)
- **Pre-releases**: Use hyphenated suffixes (e.g., `0.6.0-rc.1`, `0.6.0-alpha.1`)

### Release Types

| Type        | Tag Example      | `latest` Tag  |
| ----------- | ---------------- | ------------- |
| Stable      | `v0.6.0`         | ✅ Updated     |
| Pre-release | `v0.7.0-rc.1`    | ❌ Not updated |
| Pre-release | `v0.7.0-alpha.1` | ❌ Not updated |

### Changelog

- Full changelog: [CHANGELOG.md](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/blob/main/CHANGELOG.md)
- Releases: [GitHub Releases](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/releases)

---

## Links

- **Source Code**: [github.com/OleksandrKucherenko/mcp-obsidian-via-rest](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest)
- **NPM Package**: [@oleksandrkucherenko/mcp-obsidian](https://www.npmjs.com/package/@oleksandrkucherenko/mcp-obsidian)
- **Docker Hub**: [oleksandrkucherenko/obsidian-mcp](https://hub.docker.com/r/oleksandrkucherenko/obsidian-mcp)
- **GHCR**: [ghcr.io/oleksandrkucherenko/obsidian-mcp](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/container/obsidian-mcp)
- **Obsidian**: [obsidian.md](https://obsidian.md/)
- **Local REST API Plugin**: [github.com/coddingtonbear/obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

---

## License

MIT License - see [LICENSE](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/blob/main/LICENSE) for details.
