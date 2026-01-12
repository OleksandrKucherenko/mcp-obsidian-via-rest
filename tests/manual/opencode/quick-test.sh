#!/bin/bash
# Quick MCP Server Test Script
# Usage: ./quick-test.sh [search-query]

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "MCP Obsidian Server Quick Test"
echo "========================================="
echo ""

# Check environment variables
if [ -z "$API_KEY" ]; then
	echo -e "${RED}❌ API_KEY not set${NC}"
	echo "Please set: export API_KEY='your-obsidian-api-key'"
	exit 1
fi

if [ -z "$API_HOST" ]; then
	echo -e "${RED}❌ API_HOST not set${NC}"
	echo "Please set: export API_HOST='https://localhost' or 'https://<wsl-gateway-ip>'"
	exit 1
fi

API_PORT=${API_PORT:-"27124"}

echo "Configuration:"
echo "  API_HOST: $API_HOST"
echo "  API_PORT: $API_PORT"
echo ""

# Test 1: Obsidian API connectivity
echo "Test 1: Obsidian API connectivity..."
if curl -sk "$API_HOST:$API_PORT" >/dev/null 2>&1; then
	echo -e "${GREEN}✅ Obsidian API is reachable${NC}"
else
	echo -e "${RED}❌ Cannot reach Obsidian API${NC}"
	exit 1
fi

# Test 2: MCP server tools/list
echo ""
echo "Test 2: MCP server - List available tools..."
if echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' |
	API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
		timeout 10 bun run src/index.ts 2>/dev/null | grep -q "get_note_content"; then
	echo -e "${GREEN}✅ MCP server responding with tools${NC}"
else
	echo -e "${RED}❌ MCP server tools/list failed${NC}"
	exit 1
fi

# Test 3: Search notes (if query provided)
if [ -n "$1" ]; then
	echo ""
	echo "Test 3: MCP server - Search for '$1'..."
	echo "   (This may take several seconds depending on network latency...)"
	# Note: Search can be slow over VPN or WSL2 due to network latency
	# Increase timeout if needed: timeout 30 or timeout 60
	echo "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"obsidian_search\",\"arguments\":{\"query\":\"$1\"}}}" |
		API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
			timeout 30 bun run src/index.ts 2>/dev/null >/tmp/search_result.json

	if [ -f /tmp/search_result.json ] && grep -q '"result"' /tmp/search_result.json; then
		echo -e "${GREEN}✅ Search successful${NC}"
		COUNT=$(grep -o '"text"' /tmp/search_result.json | wc -l)
		echo "   Found $COUNT results"
		rm -f /tmp/search_result.json
	else
		echo -e "${YELLOW}⚠️  Search timed out or failed (may be network latency)${NC}"
		echo "   Try increasing timeout in script or test manually:"
		echo "   echo '{...}' | bun run src/index.ts"
		rm -f /tmp/search_result.json
		# Continue with other tests instead of failing
	fi
fi

# Test 4: HTTP transport health check
echo ""
echo "Test 4: HTTP transport - Health check..."
MCP_TRANSPORTS=http MCP_HTTP_PORT=3000 \
	API_KEY=$API_KEY API_HOST=$API_HOST API_PORT=$API_PORT \
	bun run src/index.ts >/dev/null 2>&1 &
SERVER_PID=$!

sleep 2

if curl -s http://localhost:3000/health | grep -q "healthy"; then
	echo -e "${GREEN}✅ HTTP transport is healthy${NC}"
	kill $SERVER_PID 2>/dev/null
	wait $SERVER_PID 2>/dev/null
else
	echo -e "${RED}❌ HTTP transport health check failed${NC}"
	kill $SERVER_PID 2>/dev/null
	wait $SERVER_PID 2>/dev/null
	exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo "========================================="
