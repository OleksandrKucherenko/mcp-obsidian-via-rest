# Environment Variables (DIRENV)

This project uses [DIRENV](https://direnv.net/) to automatically load environment variables when entering the project directory.

## Automatic Variables

The following environment variables are automatically loaded from `.envrc` by DIRENV:

| Variable         | Source                                 | Default             | Description                                    |
| ---------------- | -------------------------------------- | ------------------- | ---------------------------------------------- |
| `API_KEY`        | `.secrets/obsidian_local_rest_api_key` | -                   | Obsidian Local REST API key                    |
| `API_HOST`       | Calculated from `WSL_GATEWAY_IP`       | `https://localhost` | Obsidian REST API host                         |
| `API_PORT`       | `.envrc`                               | `27124`             | Obsidian REST API port                         |
| `WSL_GATEWAY_IP` | `ip route show`                        | -                   | WSL2 gateway IP (for Windows host)             |
| `API_URLS`       | Constructed from above                 | -                   | Multi-URL configuration for automatic failover |

## How It Works

When you enter the project directory, DIRENV automatically:

1. Loads API key from `.secrets/obsidian_local_rest_api_key`
2. Calculates WSL gateway IP if running in WSL2
3. Sets `API_HOST` to point to Windows host (if in WSL2)
4. Sets `API_PORT` to `27124`
5. Constructs `API_URLS` with both localhost and WSL gateway IPs

## Setup

### 1. Install DIRENV (if not already installed)

```bash
# On Linux/macOS
curl -sfL https://direnv.net/install.sh | bash

# Or using Homebrew
brew install direnv
```

### 2. Enable DIRENV in your shell

**For ZSH:**
```bash
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

**For Bash:**
```bash
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### 3. Allow DIRENV for the project directory

```bash
direnv allow
```

## Usage

### Automatically Load Variables

Just enter the project directory:

```bash
cd /path/to/mcp-obsidian-via-rest
```

DIRENV will automatically load all environment variables from `.envrc`.

### Verify Variables are Loaded

```bash
echo "API_KEY: $API_KEY"
echo "API_HOST: $API_HOST"
echo "API_PORT: $API_PORT"
echo "WSL_GATEWAY_IP: $WSL_GATEWAY_IP"
echo "API_URLS: $API_URLS"
```

### Using with OpenCode CLI

Now you can run OpenCode CLI without manually setting variables:

```bash
# Just enter the directory (DIRENV loads variables)
cd /path/to/mcp-obsidian-via-rest

# List MCP servers (variables are already loaded)
opencode mcp list

# Test MCP tools
opencode run -m "opencode/big-pickle" "Search for notes about Docker"
```

## OpenCode Configurations

The `opencode.json` file uses `{env:VAR_NAME}` placeholders that get replaced with actual environment variables:

### 1. `mcp-obsidian` (default, enabled)

Uses `API_KEY`, `API_HOST`, `API_PORT` from `.envrc`.

### 2. `mcp-obsidian-multi` (disabled)

Uses `API_KEY`, `API_URLS` from `.envrc` for automatic failover.

To enable multi-URL mode, update `opencode.json`:
```json
{
  "mcp": {
    "mcp-obsidian": { "enabled": false },
    "mcp-obsidian-multi": { "enabled": true }
  }
}
```

### 3. `mcp-obsidian-built` (disabled)

Uses `API_KEY`, `API_HOST`, `API_PORT` from `.envrc`.

### 4. `mcp-obsidian-docker` (disabled)

Uses `API_KEY`, `API_HOST`, `API_PORT` from `.envrc`.

### 5. `mcp-obsidian-docker-multi` (disabled)

Uses `API_KEY`, `API_URLS` from `.envrc`.

## Quick Test

After DIRENV is set up and allowed:

```bash
# Enter project directory
cd /path/to/mcp-obsidian-via-rest

# Variables are automatically loaded
# No need to manually export them!

# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run src/index.ts

# Test with OpenCode CLI
opencode mcp list
opencode run -m "opencode/big-pickle" "List MCP tools"
```

## Troubleshooting

### Variables not loaded?

```bash
# Check if DIRENV is loaded
echo $DIRENV_DIR

# Allow DIRENV for this directory
direnv allow

# Reload DIRENV
direnv reload
```

### API_HOST is localhost instead of WSL gateway IP?

Check if you're in WSL2:
```bash
echo $WSL_DISTRO_NAME
```

If empty, you're not in WSL2 and `API_HOST` will be `https://localhost`.

### OpenCode CLI can't find variables?

Open new terminal session:
```bash
cd /path/to/mcp-obsidian-via-rest
echo $API_KEY  # Should show your API key
```

## Additional Resources

- [DIRENV Documentation](https://direnv.net/)
- [Manual Testing Guide](./04_manual_testing.md)
- [E2E Verification Guide](./05_e2e_verification.md)
- [OpenCode MCP Configurations](../opencode.README.md)

