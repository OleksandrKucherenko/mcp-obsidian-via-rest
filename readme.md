# mcp-obsidian

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OleksandrKucherenko/mcp-obsidian-via-rest)  

[![NPM (npmjs.org)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npm-npmjs.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npm-npmjs.yml) [![NPM (GitHub)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npm-github.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npm-github.yml)

[![Docker (GitHub)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/docker-github.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/docker-github.yml) [![Docker (Docker Hub)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/docker-hub.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/docker-hub.yml)

[![Screenshots](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml) [![Cleanup](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml)

---

<!-- TOC -->

- [mcp-obsidian](#mcp-obsidian)
  - [Configure MCP](#configure-mcp)
    - [Multi-URL Configuration (Recommended)](#multi-url-configuration-recommended)
    - [HTTP Transport Configuration](#http-transport-configuration)
      - [Decoupled Configuration with Authentication](#decoupled-configuration-with-authentication)
    - [Stdio Transport Configuration](#stdio-transport-configuration)
    - [Legacy Single-URL Configuration](#legacy-single-url-configuration)
    - [Health Endpoint](#health-endpoint)
  - [CLI Tools Configuration](#cli-tools-configuration)
    - [Claude Code CLI](#claude-code-cli)
    - [Gemini CLI](#gemini-cli)
    - [OpenCode CLI](#opencode-cli)
    - [Kilo Code CLI](#kilo-code-cli)
    - [Codex CLI](#codex-cli)
    - [GitHub Copilot CLI](#github-copilot-cli)
    - [Quick Reference](#quick-reference)
  - [Setup and Troubleshooting](#setup-and-troubleshooting)
    - [Setup](#setup)
    - [Verify that the Obsidian REST API is running (Windows Host, MacOS, Linux)](#verify-that-the-obsidian-rest-api-is-running-windows-host-macos-linux)
    - [WSL2, Docker hosted on Ubuntu](#wsl2-docker-hosted-on-ubuntu)
    - [Verify Windows Firewall](#verify-windows-firewall)
    - [Disable/Enable Firewall](#disableenable-firewall)
    - [Verify Connectivity on BusyBox Container](#verify-connectivity-on-busybox-container)
  - [Dockerized Obsidian](#dockerized-obsidian)

<!-- /TOC -->

## Configure MCP

### Multi-URL Configuration (Recommended)

**Use `API_URLS` for automatic failover and self-healing.** The server tests all URLs in parallel, selects the fastest one, and automatically reconnects on failure.

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian",
        "--rm",
        "-i",  // Keep STDIN open for stdio transport
        "-p", "3000:3000",
        "-e", "API_KEY",
        "-e", "API_URLS",
        "-e", "DEBUG", // for logs
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        // JSON array - automatically tests and selects fastest URL
        "API_URLS": "[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\",\"https://host.docker.internal:27124\"]",
        "DEBUG": "mcp:*"
      }
    }
  }
}
```

**Self-Healing Features:**

- ✅ Parallel URL testing on startup
- ✅ Automatic selection of fastest URL
- ✅ Health monitoring every 30 seconds
- ✅ Automatic failover on connection loss
- ✅ Exponential backoff to prevent thrashing

**Available transports:**

- `stdio` - Standard input/output (default, best for local MCP clients)
- `http` - HTTP JSON-RPC with SSE streaming (best for remote access)

**WSL2 Example:**

```bash
# Automatically determine WSL gateway IP
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

# Configure with multiple fallback URLs
API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124", "https://host.docker.internal:27124"]'
```

### HTTP Transport Configuration

The MCP server supports HTTP transport for remote access with automatic URL failover:

```jsonc
{
  "mcpServers": {
    "obsidian-http": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian-http",
        "--rm",
        "-p", "3000:3000",
        "-e", "API_KEY",
        "-e", "API_URLS",
        "-e", "MCP_HTTP_PATH",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        "API_URLS": "[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\",\"https://host.docker.internal:27124\"]",
        "MCP_HTTP_PATH": "/mcp" // endpoint path (default is: /mcp)
      }
    }
  }
}
```

#### Decoupled Configuration with Authentication

```bash
# Automatically determine WSL gateway IP
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

# Configure with multiple fallback URLs
API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124", "https://host.docker.internal:27124"]'

# run MCP server on docker separately from IDE
docker run --name mcp-obsidian-http --rm \
  -p 3000:3000 \
  -e API_KEY="<secret_key>" \
  -e API_URLS="${API_URLS}" \
  -e MCP_HTTP_TOKEN=<your-secret-token-here> \
  ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
```

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <your-secret-token-here>"
      }      
    }
  }
}
```

Clients must include the Authorization header:

```http
Authorization: Bearer your-secret-token-here
```

### Stdio Transport Configuration

For local development with stdio transport (default):

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian-windsurf",
        "--interactive",
        "--rm",
        "-e", "API_KEY",
        "-e", "API_URLS",
        "-e", "DEBUG",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        "API_URLS": "[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\"]",
        "DEBUG": "mcp:*" // default: disabled logs
      }
    }
  }
}
```

- `--rm`  - Automatically remove the container and its associated anonymous volumes when it exits
- `-i, --interactive` - Keep STDIN open
- `-e, --env` - Set environment variables
- `--name string` - Assign a name to the container
- `-p, --publish` - Publish container port to host

- [NPM Package Releases](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/npm/mcp-obsidian)
- [Docker Image Releases](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/container/obsidian-mcp)

### Legacy Single-URL Configuration

For backward compatibility, you can still use single-URL configuration with `API_HOST` and `API_PORT`:

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian",
        "--rm",
        "-i",
        "-e", "API_KEY",
        "-e", "API_HOST",
        "-e", "API_PORT",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        "API_HOST": "https://172.26.32.1",  // single URL without failover
        "API_PORT": "27124"
      }
    }
  }
}
```

**Note:** Single-URL configuration does not provide automatic failover or health monitoring. Use `API_URLS` for production deployments.

### Health Endpoint

When HTTP transport is enabled, the server exposes a health check endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-12T12:00:00.000Z",
  "transport": "http",
  "authEnabled": false
}
```

For comprehensive health status including Obsidian API connection and all transports, you can use the `getHealthStatus()` function which returns:

```json
{
  "healthy": true,
  "obsidian": {
    "connected": true,
    "url": "https://obsidian:27124",
    "lastCheck": 1705065600000
  },
  "transports": {
    "stdio": { "running": true, "enabled": true },
    "http": { "running": true, "enabled": true }
  },
  "uptime": 3600,
  "timestamp": 1705065600000
}
```

## CLI Tools Configuration

This section shows how to configure popular AI CLI tools to use the MCP Obsidian server.

```bash
# MacOs or Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Claude Code CLI

**Docker:**
```bash
# Create mcp.json configuration
cat > mcp.json << 'EOF'
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS", "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      }
    }
  }
}
EOF

# Run Claude with MCP config
claude --mcp-config ./mcp.json
```

**NPX/Bunx:**
```bash
cat > mcp.json << 'EOF'
{
  "mcpServers": {
    "obsidian": {
      "command": "bunx",
      "args": ["-y", "@oleksandrkucherenko/mcp-obsidian"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://127.0.0.1:27124\"]"
      }
    }
  }
}
EOF

claude --mcp-config ./mcp.json
```

### Gemini CLI

**Docker:**
```bash
gemini mcp add \
  -e API_KEY=<your-obsidian-api-key> \
  -e API_URLS='["https://host.docker.internal:27124"]' \
  obsidian \
  docker run --rm -i ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
```

**NPX/Bunx:**
```bash
gemini mcp add \
  -e API_KEY=<your-obsidian-api-key> \
  -e API_URLS='["https://127.0.0.1:27124"]' \
  obsidian \
  bunx -y @oleksandrkucherenko/mcp-obsidian
```

**HTTP Transport (remote server):**
```bash
gemini mcp add --transport http obsidian-http http://localhost:3000/mcp
```

**List and manage servers:**
```bash
gemini mcp list
gemini mcp remove obsidian
```

### OpenCode CLI

Create `opencode.json` in your project root:

**Docker:**
```jsonc
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["docker", "run", "--rm", "-i",
        "-e", "API_KEY", "-e", "API_URLS",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"],
      "environment": {
        "API_KEY": "{env:API_KEY}",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      },
      "enabled": true
    }
  }
}
```

**NPX/Bunx:**
```jsonc
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["bunx", "-y", "@oleksandrkucherenko/mcp-obsidian"],
      "environment": {
        "API_KEY": "{env:API_KEY}",
        "API_URLS": "[\"https://127.0.0.1:27124\"]"
      },
      "enabled": true
    }
  }
}
```

**HTTP Transport:**
```jsonc
{
  "mcp": {
    "obsidian-http": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

### Kilo Code CLI

Create `.kilocode/mcp.json` in your project or `~/.kilocode/cli/global/settings/mcp_settings.json` globally:

**Docker:**
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      }
    }
  }
}
```

**NPX/Bunx:**
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "bunx",
      "args": ["-y", "@oleksandrkucherenko/mcp-obsidian"],
      "env": {
        "API_KEY": "<your-obsidian-api-key>",
        "API_URLS": "[\"https://127.0.0.1:27124\"]"
      }
    }
  }
}
```

**HTTP Transport:**
```json
{
  "mcpServers": {
    "obsidian-http": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

### Codex CLI

**Docker:**
```bash
# Register MCP server
codex mcp add obsidian \
  --command "docker run --rm -i -e API_KEY -e API_URLS ghcr.io/oleksandrkucherenko/obsidian-mcp:latest" \
  --env API_KEY=<your-obsidian-api-key> \
  --env 'API_URLS=["https://host.docker.internal:27124"]'
```

**NPX/Bunx:**
```bash
codex mcp add obsidian \
  --command "bunx -y @oleksandrkucherenko/mcp-obsidian" \
  --env API_KEY=<your-obsidian-api-key> \
  --env 'API_URLS=["https://127.0.0.1:27124"]'
```

### GitHub Copilot CLI

Create `~/.copilot/mcp-config.json` (or `.copilot/mcp-config.json` in repo root):

**Docker:**
```json
{
  "mcpServers": {
    "obsidian": {
      "type": "local",
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "API_KEY", "-e", "API_URLS",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"],
      "env": {
        "API_KEY": "${OBSIDIAN_API_KEY}",
        "API_URLS": "[\"https://host.docker.internal:27124\"]"
      },
      "tools": ["*"]
    }
  }
}
```

**NPX/Bunx:**
```json
{
  "mcpServers": {
    "obsidian": {
      "type": "local",
      "command": "bunx",
      "args": ["-y", "@oleksandrkucherenko/mcp-obsidian"],
      "env": {
        "API_KEY": "${OBSIDIAN_API_KEY}",
        "API_URLS": "[\"https://127.0.0.1:27124\"]"
      },
      "tools": ["*"]
    }
  }
}
```

**Note:** Copilot CLI v0.0.340+ requires `${VAR}` syntax for environment variable expansion. Set `OBSIDIAN_API_KEY` in your shell before running.

### Quick Reference

| CLI Tool    | Config File                  | Docker Support | HTTP Transport |
| ----------- | ---------------------------- | -------------- | -------------- |
| Claude Code | `mcp.json`                   | ✅              | ✅              |
| Gemini      | `settings.json`              | ✅              | ✅              |
| OpenCode    | `opencode.json`              | ✅              | ✅              |
| Kilo Code   | `.kilocode/mcp.json`         | ✅              | ✅              |
| Codex       | CLI commands                 | ✅              | ✅              |
| Copilot     | `~/.copilot/mcp-config.json` | ✅              | ✅              |

For detailed testing and verification, see [Manual Testing Guide](./docs/04_manual_testing.md).

## Setup and Troubleshooting

### Setup

- Run [Obsidian Desktop Application](https://obsidian.md/) and enable [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) in Settings.

![Obsidian Local REST API Setup](./docs/obsidian-setup.jpg)

This setting will allow you to connect to the Local REST API from any network interface (not only localhost, which is critical for WSL2 setup).

- Copy the API Key from Obsidian Settings; you will need it for the MCP configuration.

- Verify that the Obsidian Local REST API is running and accessible from your machine.

- Next Step is always to verify the network setup on your machine (firewall rules, etc).

### Verify that the Obsidian REST API is running (Windows Host, MacOS, Linux)

Run in Windows CMD terminal:

```shell
# windows CMD, verify that port is listening (that rest api is running)
netstat -an | findstr 27124
# Expected output:
#   TCP    0.0.0.0:27124           0.0.0.0:0               LISTENING

# Verify that Obsidian Local REST API is working
curl --insecure https://localhost:27124
wget --no-check-certificate -S https://localhost:27124
http --verify=no https://localhost:27124
```

Expected REST API response:

```json
{
  "status": "OK",
  "manifest": {
    "id": "obsidian-local-rest-api",
    "name": "Local REST API",
    "version": "3.2.0",
    "minAppVersion": "0.12.0",
    "description": "Get, change or otherwise interact with your notes in Obsidian via a REST API.",
    "author": "Adam Coddington",
    "authorUrl": "https://coddingtonbear.net/",
    "isDesktopOnly": true,
    "dir": ".obsidian/plugins/obsidian-local-rest-api"
  },
  "versions": {
    "obsidian": "1.8.10",
    "self": "3.2.0"
  },
  "service": "Obsidian Local REST API",
  "authenticated": false
}
```

### WSL2, Docker hosted on Ubuntu

```mermaid
graph LR
    subgraph "Windows Machine"
      obs("Obsidian Application")
    
      subgraph "WSL2"
        subgraph "Ubuntu"
          subgraph "Docker"
            mcp("mcp-obsidian:latest")
          end
        end
      end

      firewall(["Windows Firewall"]) -->|27124| obs

      mcp -->|https://$WSL_GATEWAY_IP:27124| firewall

      IDE -.->|MCP Server Tools| mcp
    end
```

Run inside the WSL2 Ubuntu Terminal:

```bash
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
echo $WSL_GATEWAY_IP # expected something like: 172.26.32.1

# Verify that Obsidian Local REST API is working 
curl --insecure https://$WSL_GATEWAY_IP:27124
wget --no-check-certificate -S https://$WSL_GATEWAY_IP:27124
http --verify=no https://$WSL_GATEWAY_IP:27124
```

### Verify Windows Firewall

Run GUI and Setup Manual The Rules:

```shell
# Windows Defender Firewall / Inbound Rules. Press Win+R and type WF.msc or firewall.cpl
WF.msc
firewall.cpl # and then press 'Advanced settings'
```

Or Run in Windows PowerShell as Administrator:

```shell
# Add firewall rule to allow port 27124 (Run in Admin PowerShell)
New-NetFirewallRule -DisplayName "WSL2 Obsidian REST API" -Direction Inbound -LocalPort 27123,27124 -Protocol TCP -Action Allow
```

Or Run in Windows CMD terminal:

```shell
# check firewall rules (CMD) that manage 27124 port
netsh advfirewall firewall show rule name=all | findstr /C:"Rule Name" /C:"LocalPort" /C:"RemotePort" | findstr /C:"27124"

# display rules that has WSL2 keyword in own name
netsh advfirewall firewall show rule name=all | grep -A 13 WSL2

# display rule definition by port number (4 line after, 9 lines before)
netsh advfirewall firewall show rule name=all | grep -A 4 -B 9 27124
```

### Disable/Enable Firewall

Execute in Windows PowerShell as Administrator:

```shell
# Temporarily turn off firewall (for testing ONLY, not recommended for regular use)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Restore Firewall state
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Verify Connectivity on BusyBox Container

These steps allow us to confirm that the network setup is correct and the container can connect to the Local REST API.

Execute inside the WSL2 Ubuntu terminal:

```bash
export WSL_GATEWAY_IP=$(ip route | grep default | awk '{print $3}')
echo "Windows host IP from WSL2: $WSL_GATEWAY_IP"
# Output:
#   Windows host IP from WSL2: 172.26.32.1

# run docker container to verify the connectivity from Docker inside
docker run --rm -it --network=host busybox sh

# inside the container run:
which wget
# /bin/wget

export WINDOWS_HOST_IP="172.26.32.1"
echo $WINDOWS_HOST_IP
# 172.26.32.1

# try to connect to the Local REST API
wget -qO- --no-check-certificate "https://$WINDOWS_HOST_IP:27124"
wget -qO- --no-check-certificate https://172.26.32.1:27124
```

## Dockerized Obsidian

[Obsidian Dockerized](./docs/obsidian.md)
