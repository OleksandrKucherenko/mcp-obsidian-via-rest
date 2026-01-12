# mcp-obsidian

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OleksandrKucherenko/mcp-obsidian-via-rest) [![Docker Images](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-docker-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-docker-publish.yml) [![NPM (npmjs.org)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npmjs-npm-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npmjs-npm-publish.yml) 

[![NPM (GitHub)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-npm-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-npm-publish.yml) [![Screenshots](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml) [![Cleanup](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml)

---

<!-- TOC -->

- [mcp-obsidian](#mcp-obsidian)
  - [Configure MCP](#configure-mcp)
    - [Multi-Transport Configuration](#multi-transport-configuration)
    - [HTTP Transport Configuration](#http-transport-configuration)
    - [Authentication (Optional)](#authentication-optional)
    - [Stdio Transport Configuration](#stdio-transport-configuration)
    - [Multi-URL Configuration (Self-Healing)](#multi-url-configuration-self-healing)
    - [Health Endpoint](#health-endpoint)
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

### Multi-Transport Configuration

The MCP server supports running multiple transports simultaneously. Each transport gets its own isolated MCP server instance, allowing you to use stdio for local development while also exposing HTTP for remote access.

```jsonc
{
  "mcpServers": {
    "obsidian-multi": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian-multi",
        "--rm",
        "-i",  // Keep STDIN open for stdio transport
        "-p", "3000:3000",
        "-e", "API_KEY",
        "-e", "API_HOST",
        "-e", "MCP_TRANSPORTS",
        "-e", "MCP_HTTP_PORT",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        "API_HOST": "https://172.26.32.1",
        "MCP_TRANSPORTS": "stdio,http",  // Enable both transports
        "MCP_HTTP_PORT": "3000",
        "DEBUG": "mcp:*"
      }
    }
  }
}
```

**Available transports:**

- `stdio` - Standard input/output (default, best for local MCP clients)
- `http` - HTTP JSON-RPC with streaming support (best for remote access)

**Note:** SSE transport is deprecated in favor of the streamable HTTP transport, which handles both HTTP POST and SSE streaming through a single endpoint.

### HTTP Transport Configuration

The MCP server now supports HTTP transport for remote access. Configure it in your MCP client settings:

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
        "-e", "API_HOST",
        "-e", "API_PORT",
        "-e", "MCP_TRANSPORTS=http",
        "-e", "MCP_HTTP_PORT=3000",
        "-e", "DEBUG",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",              // required
        "API_HOST": "https://172.26.32.1",       // default: localhost
        "API_PORT": "27124",                     // default: 27124
        "MCP_TRANSPORTS": "http",                // enable HTTP transport
        "MCP_HTTP_PORT": "3000",                 // HTTP port (default: 3000)
        "MCP_HTTP_HOST": "0.0.0.0",              // bind address (default: 0.0.0.0)
        "MCP_HTTP_PATH": "/mcp",                 // endpoint path (default: /mcp)
        "DEBUG": "mcp:*"                         // default: disabled logs
      }
    }
  }
}
```

### Authentication (Optional)

To secure the HTTP endpoint with Bearer token authentication:

```jsonc
{
  "mcpServers": {
    "obsidian-http-auth": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian-http",
        "--rm",
        "-p", "3000:3000",
        "-e", "API_KEY",
        "-e", "MCP_TRANSPORTS=http",
        "-e", "MCP_HTTP_TOKEN=your-secret-token-here",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        "MCP_TRANSPORTS": "http",
        "MCP_HTTP_TOKEN": "your-secret-token-here"  // required for auth
      }
    }
  }
}
```

Clients must include the Authorization header:
```
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
        "-e", "API_HOST",
        "-e", "API_PORT",
        "-e", "DEBUG",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",         // required
        "API_HOST": "https://172.26.32.1", // default: localhost
        "API_PORT": "27124",               // default: 27124
        "DEBUG": "mcp:*"                   // default: disabled logs
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

### Multi-URL Configuration (Self-Healing)

The MCP server supports multiple Obsidian REST API URLs with automatic failover. The server will test all URLs in parallel, select the fastest working one, and automatically reconnect to alternative URLs if the connection fails.

```jsonc
{
  "mcpServers": {
    "obsidian-multi-url": {
      "command": "docker",
      "args": [
        "run",
        "--name", "mcp-obsidian-multi-url",
        "--rm",
        "-p", "3000:3000",
        "-e", "API_KEY",
        "-e", "API_URLS",
        "-e", "MCP_TRANSPORTS",
        "ghcr.io/oleksandrkucherenko/obsidian-mcp:latest"
      ],
      "env": {
        "API_KEY": "<secret_key>",
        // JSON array format - tests all URLs in parallel
        "API_URLS": "[\"https://127.0.0.1:27124\",\"https://172.26.32.1:27124\",\"https://host.docker.internal:27124\"]",
        "MCP_TRANSPORTS": "http"
      }
    }
  }
}
```

**URL Selection Behavior:**

1. On startup, all URLs are tested in parallel
2. The fastest responding URL is selected
3. Connection health is monitored every 30 seconds
4. On failure, the server automatically reconnects to the next available URL
5. Exponential backoff prevents connection thrashing

**WSL2 Example:**

```bash
# Automatically determine WSL gateway IP
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

# Configure with multiple fallback URLs
API_URLS='["https://127.0.0.1:27124", "https://'$WSL_GATEWAY_IP':27124", "https://host.docker.internal:27124"]'
```

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
    "http": { "running": true, "enabled": true },
    "sse": { "running": false, "enabled": false }
  },
  "uptime": 3600,
  "timestamp": 1705065600000
}
```

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