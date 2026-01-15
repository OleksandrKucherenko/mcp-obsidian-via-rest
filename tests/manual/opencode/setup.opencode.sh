#!/bin/bash
# Quick setup for OpenCode CLI with MCP Obsidian server

echo "Setting up environment for OpenCode CLI..."

# Check if API_KEY is provided
if [ -z "$API_KEY" ]; then
	echo "❌ Error: API_KEY not set"
	echo ""
	echo "Please set your Obsidian API key:"
	echo "  export API_KEY='your-obsidian-api-key-here'"
	exit 1
fi

# Set defaults
export API_HOST="${API_HOST:-https://172.26.32.1}"
export API_PORT="${API_PORT:-27124}"

# For WSL2, set multi-URL if not already set
if [ -z "$API_URLS" ] && command -v ip &>/dev/null; then
	WSL_GATEWAY_IP=$(ip route show | grep -i default | awk '{ print $3}')
	export API_URLS="[\"https://127.0.0.1:27124\",\"https://$WSL_GATEWAY_IP:27124\"]"
fi

echo "✅ Environment configured:"
echo "  API_HOST: $API_HOST"
echo "  API_PORT: $API_PORT"
if [ -n "$API_URLS" ]; then
	echo "  API_URLS: $API_URLS (multi-URL mode)"
fi
echo ""
echo "Run: opencode mcp list"
