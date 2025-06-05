# mcp-obsidian

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
        "API_KEY": "<secret_key>", // required
        "API_HOST": "172.26.32.1", // default: localhost
        "API_PORT": "27124",       // default: 27124
        "DEBUG": "mcp:*"           // default: disabled logs
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
./dockerize/ci_screenshot_obsidian_gui.sh

# Screenshot will be saved in the 'reports/screenshots' directory, relative to project root

# Verify the Obsidian REST API is running
http --verify=no https://localhost:27124
curl --insecure https://localhost:27124
```

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

# If using WSL with Obsidian REST API running on Windows host
curl --insecure https://host.docker.internal:27124

wget --no-check-certificate -S https://172.26.32.1:27124

wget --no-check-certificate -S https://host.docker.internal:27124

http --verify=no https://$WSL_GATEWAY_IP:27124
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

### Verify Obsidian REST API is running (WSL2 Ubuntu)

#### Quick test

```bash
# Get Windows host IP address (typically the first nameserver in resolv.conf)
WINDOWS_HOST_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')

# Get the gateway IP for default route
WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')

# use gateway IP to access Obsidian REST API (windows host ip can be different)
curl --insecure https://${WSL_GATEWAY_IP}:27124
```

#### Disable/enable firewall

Execute in Windows PowerShell as Administrator:

```shell
# Temporarily turn off firewall (for testing ONLY, not recommended for regular use)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Restore Firewall state
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Verify Connectivity

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

```bash
# build docker container
docker build -t mcp/obs:latest -f Dockerfile .

# run docker container
docker run --name mcp-test -i --rm -e API_KEY -e API_HOST -e DEBUG=mcp:\* mcp/obs:latest

bunx @modelcontextprotocol/inspector -e DEBUG=mcp:\* -e API_KEY=$API_KEY -e API_HOST=$API_HOST  -- docker run --name mcp-test -i --rm -e API_KEY -e API_HOST -e DEBUG=mcp:\* mcp/obs:latest

# manual MCP server STDIN initialization
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' | DEBUG=mcp:push,mcp:pull bun run src/index.ts
```

```json
{
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
      "mcp/obs:latest"
    ],
    "env": {
      "API_KEY": "190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9",
      "API_HOST": "172.26.32.1",
      "API_PORT": "27124",
      "DEBUG": "mcp:*"
    },
    "disabled": false
  }
}
```

## Publish

```bash
# build release version of the JS file and prepare the package
bun run publish:prepare

# try to publish the package (dry run mode)
bun publish --dry-run

# prepare changelog
bunx changelogithub --dry
```

ref1: https://bun.sh/docs/cli/publish
ref2: https://bun.sh/guides/runtime/cicd
ref3: https://docs.github.com/en/packages/quickstart
ref4: https://github.com/docker/setup-buildx-action
ref5: https://github.com/marketplace/actions/docker-compose-action
ref6: https://bun.sh/guides/install/registry-scope
ref7: https://www.npmjs.com/package/changelogithub
ref8: https://github.com/oven-sh/bun/issues/15245