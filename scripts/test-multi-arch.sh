#!/bin/bash

# Multi-Architecture Docker Build Test Script
# This script tests that Docker images can be built for multiple architectures

set -e

echo "🚀 Testing Multi-Architecture Docker Builds"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    print_error "Docker Buildx is not available. Please install Docker Buildx."
    exit 1
fi

# Setup buildx builder if not exists
BUILDER_NAME="multiarch-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    print_status "Creating multi-architecture builder..."
    docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap
fi

print_status "Using builder: $BUILDER_NAME"
docker buildx use "$BUILDER_NAME"

# Test MCP Server Docker build
print_status "Testing MCP Server Docker build (multi-arch)..."
docker buildx build \
    --platform linux/amd64,linux/arm64/v8 \
    --file Dockerfile \
    --tag test/mcp-obsidian:multi-arch \
    --progress=plain \
    .

if [ $? -eq 0 ]; then
    print_status "✅ MCP Server multi-arch build: SUCCESS"
else
    print_error "❌ MCP Server multi-arch build: FAILED"
    exit 1
fi

# Test VNC Obsidian Docker build
print_status "Testing VNC Obsidian Docker build (multi-arch)..."
docker buildx build \
    --platform linux/amd64,linux/arm64/v8 \
    --file dockerize/Dockerfile \
    --tag test/obsidian-vnc:multi-arch \
    --progress=plain \
    ./dockerize

if [ $? -eq 0 ]; then
    print_status "✅ VNC Obsidian multi-arch build: SUCCESS"
else
    print_error "❌ VNC Obsidian multi-arch build: FAILED"
    exit 1
fi

# Test single architecture builds for verification
print_status "Testing single architecture builds for verification..."

# AMD64 only
print_status "Building for linux/amd64..."
docker buildx build \
    --platform linux/amd64 \
    --file Dockerfile \
    --tag test/mcp-obsidian:amd64 \
    --load \
    .

# Test the AMD64 image
print_status "Testing AMD64 image..."
docker run --rm test/mcp-obsidian:amd64 bun --version

# ARM64 only (if running on ARM64 or with emulation)
if [[ "$(uname -m)" == "arm64" ]] || docker buildx ls | grep -q "linux/arm64"; then
    print_status "Building for linux/arm64..."
    docker buildx build \
        --platform linux/arm64/v8 \
        --file Dockerfile \
        --tag test/mcp-obsidian:arm64 \
        --load \
        .
    
    print_status "Testing ARM64 image..."
    docker run --rm test/mcp-obsidian:arm64 bun --version
else
    print_warning "ARM64 emulation not available, skipping ARM64 single-arch test"
fi

print_status "🎉 All multi-architecture Docker builds completed successfully!"
print_status ""
print_status "Summary:"
print_status "- MCP Server: ✅ Multi-arch build successful"
print_status "- VNC Obsidian: ✅ Multi-arch build successful"
print_status "- AMD64 verification: ✅ Successful"
if [[ "$(uname -m)" == "arm64" ]] || docker buildx ls | grep -q "linux/arm64"; then
    print_status "- ARM64 verification: ✅ Successful"
else
    print_status "- ARM64 verification: ⚠️  Skipped (emulation not available)"
fi

print_status ""
print_status "🔧 Cleanup: Removing test images..."
docker rmi test/mcp-obsidian:amd64 2>/dev/null || true
docker rmi test/mcp-obsidian:arm64 2>/dev/null || true

print_status "✨ Multi-architecture testing complete!"