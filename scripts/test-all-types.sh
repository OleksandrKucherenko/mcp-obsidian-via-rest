#!/bin/bash

# Comprehensive Test Script for All Test Types
# This script demonstrates the different test types and their execution patterns

set -e

echo "🧪 Comprehensive Test Suite for MCP Obsidian"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_section() {
    echo -e "${BLUE}[SECTION]${NC} $1"
}

# Check if we're on a platform that supports Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running"
        return 1
    fi
    
    return 0
}

# Check if Bun is available
check_bun() {
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed or not in PATH"
        return 1
    fi
    return 0
}

# Install dependencies
install_deps() {
    print_status "Installing dependencies..."
    bun install
}

# Run unit tests (cross-platform)
run_unit_tests() {
    print_section "1. Unit Tests (Cross-Platform)"
    print_status "Running unit tests that work on all platforms..."
    
    bun test ./src
    
    if [ $? -eq 0 ]; then
        print_status "✅ Unit tests: PASSED"
    else
        print_error "❌ Unit tests: FAILED"
        return 1
    fi
}

# Run platform compatibility tests
run_platform_tests() {
    print_section "2. Platform Compatibility Tests"
    print_status "Running platform-specific compatibility tests..."
    
    bun test ./src/platform.test.ts
    
    if [ $? -eq 0 ]; then
        print_status "✅ Platform tests: PASSED"
    else
        print_error "❌ Platform tests: FAILED"
        return 1
    fi
}

# Run E2E tests with manual Docker management
run_e2e_manual() {
    print_section "3. E2E Tests (Manual Docker Management)"
    print_status "These tests require manual Docker container lifecycle management..."
    
    if ! check_docker; then
        print_warning "⚠️  Skipping E2E tests - Docker not available"
        return 0
    fi
    
    print_status "Starting Docker Compose for E2E tests..."
    docker compose -f docker-compose.yaml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 30
    
    # Check if services are running
    print_status "Checking service status..."
    docker compose -f docker-compose.yaml ps
    
    # Run the E2E tests
    print_status "Running E2E tests..."
    export API_KEY="190ba65d28ac1ba4797cb195bb06f20965395abbd9c39a0fa9b6cab2345c58b9"
    
    if bun run test:e2e; then
        print_status "✅ E2E tests (manual): PASSED"
        E2E_RESULT=0
    else
        print_error "❌ E2E tests (manual): FAILED"
        E2E_RESULT=1
    fi
    
    # Always stop the containers
    print_status "Stopping Docker Compose..."
    docker compose -f docker-compose.yaml down
    
    return $E2E_RESULT
}

# Run container tests with testcontainers
run_container_tests() {
    print_section "4. Container Tests (Testcontainers - Automated)"
    print_status "These tests use testcontainers for automated container lifecycle..."
    
    if ! check_docker; then
        print_warning "⚠️  Skipping container tests - Docker not available"
        return 0
    fi
    
    print_status "Running container tests with testcontainers..."
    print_status "Note: Testcontainers will automatically manage container lifecycle"
    
    if bun run test:containers; then
        print_status "✅ Container tests (testcontainers): PASSED"
    else
        print_error "❌ Container tests (testcontainers): FAILED"
        return 1
    fi
}

# Run build tests
run_build_tests() {
    print_section "5. Build Tests"
    print_status "Testing package build process..."
    
    if bun run build; then
        print_status "✅ Build: PASSED"
    else
        print_error "❌ Build: FAILED"
        return 1
    fi
    
    # Test package preparation
    print_status "Testing package preparation..."
    if bun run publish:prepare; then
        print_status "✅ Package preparation: PASSED"
        ls -la *.tgz 2>/dev/null || print_warning "No .tgz files found"
    else
        print_error "❌ Package preparation: FAILED"
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting comprehensive test suite..."
    print_status "Platform: $(uname -s) $(uname -m)"
    
    # Check prerequisites
    if ! check_bun; then
        exit 1
    fi
    
    # Install dependencies
    install_deps
    
    # Track test results
    FAILED_TESTS=()
    
    # Run all test types
    if ! run_unit_tests; then
        FAILED_TESTS+=("Unit Tests")
    fi
    
    if ! run_platform_tests; then
        FAILED_TESTS+=("Platform Tests")
    fi
    
    if ! run_e2e_manual; then
        FAILED_TESTS+=("E2E Tests (Manual)")
    fi
    
    if ! run_container_tests; then
        FAILED_TESTS+=("Container Tests (Testcontainers)")
    fi
    
    if ! run_build_tests; then
        FAILED_TESTS+=("Build Tests")
    fi
    
    # Summary
    print_section "Test Summary"
    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        print_status "🎉 All tests passed!"
        echo ""
        print_status "Test Types Executed:"
        print_status "✅ Unit Tests (Cross-Platform)"
        print_status "✅ Platform Compatibility Tests"
        if check_docker; then
            print_status "✅ E2E Tests (Manual Docker Management)"
            print_status "✅ Container Tests (Testcontainers Automated)"
        else
            print_warning "⚠️  Docker tests skipped (Docker not available)"
        fi
        print_status "✅ Build Tests"
        exit 0
    else
        print_error "❌ Some tests failed:"
        for test in "${FAILED_TESTS[@]}"; do
            print_error "  - $test"
        done
        exit 1
    fi
}

# Show help if requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Comprehensive Test Script for MCP Obsidian"
    echo ""
    echo "This script runs all types of tests:"
    echo "1. Unit Tests - Cross-platform unit tests"
    echo "2. Platform Tests - Platform compatibility tests"
    echo "3. E2E Tests - Manual Docker container management"
    echo "4. Container Tests - Testcontainers automated lifecycle"
    echo "5. Build Tests - Package build and preparation"
    echo ""
    echo "Usage: $0 [--help]"
    echo ""
    echo "Requirements:"
    echo "- Bun runtime"
    echo "- Docker (for E2E and container tests)"
    echo ""
    echo "The script will automatically skip Docker-based tests if Docker is not available."
    exit 0
fi

# Run main function
main