#!/bin/bash

# Script to diagnose Docker/Colima issues on macOS Apple Silicon
# Usage: ./macos_diagnostic.sh

set -e
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==== Obsidian Docker Diagnostics for macOS Apple Silicon ====${NC}"
echo "This script will perform several tests to diagnose issues with Docker and Colima"

# Function to run a test with color-coded output
run_test() {
  echo -e "${YELLOW}[TEST] $1${NC}"
  shift
  if $@; then
    echo -e "${GREEN}[PASS] Test completed successfully${NC}"
    return 0
  else
    echo -e "${RED}[FAIL] Test failed${NC}"
    return 1
  fi
  echo ""
}

# Check Colima status
check_colima_status() {
  echo "Checking Colima status..."
  colima status
  echo ""
  return 0
}

# Check Docker environment
check_docker_info() {
  echo "Checking Docker environment..."
  echo "Docker version:"
  docker version
  echo ""
  
  echo "Docker info:"
  docker info | grep -E "Architecture|Operating System|CPUs|Memory|Kernel"
  echo ""
  return 0
}

# Test architecture compatibility
check_architecture() {
  echo "Testing architecture compatibility..."
  echo "Native ARM test:"
  docker run --rm arm64v8/alpine uname -m
  echo ""
  
  echo "Emulated x86_64 test:"
  docker run --rm --platform linux/amd64 alpine uname -m
  echo ""
  return 0
}

# Test FUSE capability
test_fuse() {
  echo "Testing FUSE capabilities in Docker/Colima..."
  docker run --rm --cap-add SYS_ADMIN --device /dev/fuse:/dev/fuse alpine sh -c "apk add fuse && fusermount -V"
  return $?
}

# Test FUSE with privileged mode
test_fuse_privileged() {
  echo "Testing FUSE with privileged mode..."
  docker run --rm --privileged alpine sh -c "apk add fuse && fusermount -V"
  return $?
}

# Test Obsidian container (minimal)
test_obsidian_container() {
  echo "Building and testing minimal Obsidian container..."
  echo "This will build the container only, not run it."
  
  cd "$(dirname "$0")"
  if [ -f "dockerize/Dockerfile.macos" ]; then
    docker build -t obsidian-test:macos -f dockerize/Dockerfile.macos ./dockerize
    return $?
  else
    echo "Dockerfile.macos not found. Please run the script from the project root."
    return 1
  fi
}

# Check Docker Compose
check_docker_compose() {
  echo "Checking Docker Compose version..."
  docker compose version
  return $?
}

# Run test sequence
echo -e "${BLUE}Starting diagnostic tests...${NC}"
echo ""

run_test "Colima Status" check_colima_status
run_test "Docker Environment" check_docker_info
run_test "Architecture Compatibility" check_architecture
run_test "FUSE Support" test_fuse
run_test "FUSE with Privileged Mode" test_fuse_privileged
run_test "Obsidian Container Build" test_obsidian_container
run_test "Docker Compose Version" check_docker_compose

echo -e "${BLUE}=== Diagnostic tests completed ===${NC}"
echo ""
echo "Instructions for macOS Apple Silicon configuration:"
echo "1. Use the created docker-compose.macos.yaml file:"
echo "   docker compose -f docker-compose.macos.yaml up"
echo ""
echo "2. If issues persist, try running with privileged mode by modifying the compose file"
echo ""
echo "3. Check container logs for specific errors:"
echo "   docker logs obsidian"
echo ""
echo "4. If AppImage fails to mount inside the container, try running with --privileged instead of just the SYS_ADMIN capability"
echo ""
echo "5. You may need to adjust Colima settings with:"
echo "   colima stop"
echo "   colima start --cpu 4 --memory 8 --disk 20 --vm-type=qemu --mount-type=virtiofs"
