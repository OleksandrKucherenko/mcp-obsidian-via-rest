# mcp-obsidian

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OleksandrKucherenko/mcp-obsidian-via-rest) [![Docker Images](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-docker-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-docker-publish.yml) [![NPM (npmjs.org)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npmjs-npm-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/npmjs-npm-publish.yml) 

[![NPM (GitHub)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-npm-publish.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/github-npm-publish.yml) [![Screenshots](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/screenshots.yml) [![Cleanup](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml/badge.svg)](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/workflows/cleanup.yaml)

## Configure MCP 

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "type": "stdio",
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
      },
      "disabled": false
    },
    "obsidian-npm": {
      "command": "bunx",
      "type": "stdio",
      "args": [
        "@oleksandrkucherenko/mcp-obsidian"
      ],
      "env": {
        "API_KEY": "<secret_key>",         // required
        "API_HOST": "https://172.26.32.1", // default: localhost
        "API_PORT": "27124",               // default: 27124
        "DEBUG": "mcp:*",                  // default: disabled logs
        "NPM_CONFIG_REGISTRY": "https://npm.pkg.github.com",
        "NPM_AUTH_TOKEN": "<token>"        // https://github.com/settings/tokens
      },
      "disabled": false
    } 
  }
}
```

- `--rm`  - Automatically remove the container and its associated anonymous volumes when it exits
- `-i, --interactive` - Keep STDIN open even if not attached
- `-e, --env` - Set environment variables
- `--name string` - Assign a name to the container

- [NPM Package Releases](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/npm/mcp-obsidian)
- [Docker Image Releases](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/container/obsidian-mcp)

### Troubleshooting

```bash
# verify REST API availability
curl --insecure https://localhost:27124 # macOs, Linux, Pure Windows

# for WSL2 (when Obsidian is running on Windows host, but IDE is running on WSL2)
export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
echo $WSL_GATEWAY_IP # expected something like: 172.26.32.1

http --verify=no https://$WSL_GATEWAY_IP:27124
```

```bash
# for WSL2 expected WSL_DISTRO_NAME variable to be set by OS
if [ -n "$WSL_DISTRO_NAME" ]; then
  export WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
else
  unset WSL_GATEWAY_IP
fi

export API_KEY=$(cat .secrets/obsidian_local_rest_api_key)
export API_HOST="${WSL_GATEWAY_IP:-"localhost"}"
export API_PORT="27124"
export DEBUG="mcp:*"

# manual docker run (for testing)
docker run --name mcp-obsidian-windsurf -i --rm -e API_KEY -e API_HOST -e API_PORT -e DEBUG ghcr.io/oleksandrkucherenko/obsidian-mcp:latest
```

### References

- https://www.aihero.dev/mcp-server-from-a-single-typescript-file


## Quick Development Start

```bash
# install dependencies
bun install

# run MCP server locally
bun run src/index.ts
```

## Dockerized Obsidian for Automated Testing

| Startup | Verification |
| --- | --- |
| ![Obsidian Main Screenshot](./dockerize/obsidian-screenshot.jpg) | ![Docker](./assets/obsidian-docker-setup.jpg) |

```bash
# run dockerized Obsidian
./docker-compose up -d

# ALTERNATIVE: run with re-build
./docker-compose up --build -d

# run script for getting a visual feedback on Obsidian inside the docker container
./dockerize/ci.screenshot_obsidian.sh

# Screenshot will be saved in the 'reports/screenshots' directory, relative to project root

# Verify the Obsidian REST API is running
http --verify=no https://localhost:27124
curl --insecure https://localhost:27124

# Run as a pre-compiled docker image
docker run --rm -d --name obsidian-vnc \
  -e VNC_PASSWORD=yoursecurepassword \
  --cap-add SYS_ADMIN \
  --device /dev/fuse:/dev/fuse \
  --security-opt apparmor:unconfined \
  -p 5900:5900 -p 27124:27124 \
  ghcr.io/oleksandrkucherenko/obsidian-vnc:latest
```

> Critical! Keep options: `--cap-add SYS_ADMIN --device /dev/fuse:/dev/fuse --security-opt apparmor:unconfined`, otherwise the docker container will exit.

| Option | Needed For | What happens if omitted? | 
|-----------------------|-------------------------|---------------------------------------------|
| --cap-add SYS_ADMIN | FUSE/AppImage mounting | AppImage fails to mount, container exits |
| --device /dev/fuse | FUSE/AppImage mounting | AppImage fails to mount, container exits |
| --security-opt apparmor:unconfined | FUSE/AppImage on AppArmor-enabled hosts | AppImage may be blocked, container exits |

To connect to the container I can recommend [TightVNC Viewer](https://www.tightvnc.com/).

```bash
# install TightVNC Viewer
scoop install tightvnc

# for MacOs can be used a fork of TightVnc: https://github.com/TigerVNC/tigervnc, https://tigervnc.org/
brew install --cask tigervnc-viewer

# connect to the container
tvnviewer -host=localhost -port=5900 -password=yoursecurepassword -encoding=zrle
# tvnviewer -host=localhost -port=5900 -password=yoursecurepassword -encoding=rre
# tvnviewer -host=localhost -port=5900 -password=yoursecurepassword -encoding=hextile
```

Here's a concise comparison of the VNC encoding methods:

1. RRE (Rising Rectangle Encoding)
  - Pros: Simple, low CPU usage
  - Cons: High bandwidth usage
  - Best for: Simple, low-color desktops
2. ZRLE (Zlib Run-Length Encoding)
  - Pros: Good compression, handles complex images well
  - Cons: Higher CPU usage
  - Best for: Fast networks, modern clients
3. Hextile
  - Pros: Balanced performance, handles updates efficiently
  - Cons: Moderate CPU usage
  - Best for: General use, especially over LAN

Recommendation:
- ZRLE for modern clients and good networks
- Hextile for a balance of performance and compatibility
- RRE for minimal CPU usage (rarely needed)

## Troubleshooting

```bash
# Run MCP server locally in DEBUG mode
DEBUG=mcp:* bun run src/index.ts --config ./configs/config.wsl2.jsonc
```

### Verify that Obsidian REST API is running (Windows Host)

Run in Windows CMD terminal:

```shell
# windows CMD, verify that port is listening (that rest api is running)
netstat -an | findstr 27124

# curl with --insecure to accept self-signed certificate
curl --insecure https://localhost:27124
```

Run on WSL2 side:

```bash
export WSL_GATEWAY_IP=$(ip route | grep default | awk '{print $3}')
echo "Windows host IP from WSL2: $WSL_GATEWAY_IP"
# Output:
#   Windows host IP from WSL2: 172.26.32.1

# Should work on WSL2 and inside the docker container.
# Inside the container use host.docker.internal but it can be not always available, so use IP address.
curl --insecure https://$WSL_GATEWAY_IP:27124
wget --no-check-certificate -S https://$WSL_GATEWAY_IP:27124
http --verify=no https://$WSL_GATEWAY_IP:27124

# If using WSL with Obsidian REST API running on Windows host
curl --insecure https://host.docker.internal:27124
wget --no-check-certificate -S https://host.docker.internal:27124
http --verify=no https://host.docker.internal:27124
```

### Verify Windows Firewall

Run GUI:

```shell
# Windows Defender Firewall / Inbound Rules. Press Win+R and type WF.msc or firewall.cpl
WF.msc
firewall.cpl # and then press 'Advanced settings'
```

Run in Windows PowerShell as Administrator:

```shell
# Add firewall rule to allow port 27124 (Run in Admin PowerShell)
New-NetFirewallRule -DisplayName "WSL2 Obsidian REST API" -Direction Inbound -LocalPort 27123,27124 -Protocol TCP -Action Allow

# Add firewall rule to allow port 6274 (Run in Admin PowerShell)
New-NetFirewallRule -DisplayName "WSL2 MCP Inspector" -Direction Inbound -LocalPort 6274 -Protocol TCP -Action Allow

# To open MCP Inspector in browser, do not use 127.0.0.1!
open https://localhost:6274 # macOs
start https://localhost:6274 # for windows CMD
```

Run in Windows CMD terminal:

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

Execute inside the WSL2 Ubuntu terminal:

```bash
export WSL_GATEWAY_IP=$(ip route | grep default | awk '{print $3}')
echo "Windows host IP from WSL2: $WSL_GATEWAY_IP"
# Output:
# Windows host IP from WSL2: 172.26.32.1

# run docker container to verify the connectivity from Docker inside
docker run --rm -it --network=host busybox sh

# inside the container run:
which wget
# /bin/wget

export WINDOWS_HOST_IP="172.26.32.1"
echo $WINDOWS_HOST_IP
# 172.26.32.1

wget -qO- --no-check-certificate "https://$WINDOWS_HOST_IP:27124"
wget -qO- --no-check-certificate https://172.26.32.1:27124
# Output:
# {
#   "status": "OK",
#   "manifest": {
#     "id": "obsidian-local-rest-api",
#     "name": "Local REST API",
#     "version": "3.2.0",
#     "minAppVersion": "0.12.0",
#     "description": "Get, change or otherwise interact with your notes in Obsidian via a REST API.",
#     "author": "Adam Coddington",
#     "authorUrl": "https://coddingtonbear.net/",
#     "isDesktopOnly": true,
#     "dir": ".obsidian/plugins/obsidian-local-rest-api"
#   },
#   "versions": {
#     "obsidian": "1.8.10",
#     "self": "3.2.0"
#   },
#   "service": "Obsidian Local REST API",
#   "authenticated": false
# }
```

### Verify From Our MCP Docker Container

```bash
# build docker container with a custom name 'mcp/obs' and tag 'latest'
docker build -t mcp/obs:latest -f Dockerfile .

# run just build docker container (API_KEY and API_HOST are required on shell)
docker run --name mcp-test -i --rm -e API_KEY -e API_HOST -e DEBUG=mcp:\* mcp/obs:latest

bunx @modelcontextprotocol/inspector -e DEBUG=mcp:\* -e API_KEY=$API_KEY -e API_HOST=$API_HOST  -- docker run --name mcp-test -i --rm -e API_KEY -e API_HOST -e DEBUG=mcp:\* mcp/obs:latest
```

### Verify MCP Server STDIN initialization

```bash
# manual MCP server STDIN initialization
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' | DEBUG=mcp:push,mcp:pull bun run src/index.ts
#
# Output:
#
#  mcp:push {
#  mcp:push   jsonrpc: '2.0',
#  mcp:push   id: 1,
#  mcp:push   method: 'initialize',
#  mcp:push   params: {
#  mcp:push     protocolVersion: '2024-11-05',
#  mcp:push     capabilities: {},
#  mcp:push     clientInfo: { name: 'test-client', version: '1.0.0' }
#  mcp:push   }
#  mcp:push } +0ms
#  mcp:pull {
#  mcp:pull   result: {
#  mcp:pull     protocolVersion: '2024-11-05',
#  mcp:pull     capabilities: { tools: { listChanged: true }, resources: { listChanged: true } },
#  mcp:pull     serverInfo: {
#  mcp:pull       name: 'mcp-obsidian',
#  mcp:pull       version: '0.0.1',
#  mcp:pull       capabilities: { resources: {}, tools: {} }
#  mcp:pull     }
#  mcp:pull   },
#  mcp:pull   jsonrpc: '2.0',
#  mcp:pull   id: 1
#  mcp:pull } +0ms
# {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true},"resources":{"listChanged":true}},"serverInfo":{"name":"mcp-obsidian","version":"0.0.1","capabilities":{"resources":{},"tools":{}}}},"jsonrpc":"2.0","id":1}
```

## Publish

```bash
# build release version of the JS file and prepare the package
bun run publish:prepare

# try to publish the package (dry run mode)
bun publish --dry-run

# prepare changelog
bunx changelogithub --dry

# verify that the package is available
curl -H "Authorization: Bearer ${NPMRC_GITHUB_AUTH_TOKEN}" https://npm.pkg.github.com/@oleksandrkucherenko/mcp-obsidian | jq
```

- https://bun.sh/docs/cli/publish
- https://bun.sh/guides/runtime/cicd
- https://docs.github.com/en/packages/quickstart
- https://github.com/docker/setup-buildx-action
- https://github.com/marketplace/actions/docker-compose-action
- https://bun.sh/guides/install/registry-scope
- https://www.npmjs.com/package/changelogithub
- https://github.com/oven-sh/bun/issues/15245
- https://bun.sh/docs/runtime/bunfig
- [Configuring .npmrc](https://docs.npmjs.com/cli/v9/configuring-npm/npmrc)
- [release-it](https://github.com/release-it/release-it)
  - [GitHub Releases](https://github.com/release-it/release-it/blob/main/docs/github-releases.md)
