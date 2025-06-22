# Multi-Platform CI/CD Documentation

This document describes the multi-platform continuous integration and deployment setup for the MCP Obsidian project.

## Overview

The project now supports comprehensive testing and building across multiple platforms:

- **Linux x86_64** (ubuntu-latest)
- **macOS Apple Silicon** (macos-latest)
- **Docker Multi-Architecture** (linux/amd64, linux/arm64/v8)

## GitHub Actions Workflows

### 1. Continuous Integration (`ci.yml`)

**Triggers:** Push to main/develop, Pull Requests, Manual dispatch

**Jobs:**
- **Unit Tests**: Runs on both Ubuntu and macOS
- **E2E Tests**: Linux-only (Docker requirements)
- **Docker Multi-Arch Build Test**: Tests both architectures
- **macOS Integration Tests**: macOS-specific integration testing
- **CI Summary**: Aggregates results

### 2. GitHub NPM Publish (`github-npm-publish.yml`)

**Triggers:** Release creation, Push to main with tags, Manual dispatch

**Jobs:**
- **Multi-Platform Unit Testing**: Ubuntu + macOS
- **E2E Testing**: Linux with Docker
- **Container Testing**: Linux with Docker
- **Build and Publish**: After all tests pass

### 3. NPM.js Publish (`npmjs-npm-publish.yml`)

**Triggers:** Version tags, Manual dispatch

**Jobs:**
- **Multi-Platform Testing**: Ubuntu + macOS
- **Prepare and Dry Run**: Package preparation
- **Publish to NPM.js**: Manual approval required

### 4. Docker Publish (`github-docker-publish.yml`)

**Triggers:** Push to main, Tags, Manual dispatch

**Jobs:**
- **Test Builds**: Multi-architecture build testing
- **Build VNC**: Obsidian VNC container
- **Build MCP**: MCP server container

### 5. Screenshots (`screenshots.yml`)

**Triggers:** Release creation, Push to main with tags, Manual dispatch

**Jobs:**
- **Multi-Platform Testing**: Ubuntu + macOS
- **Screenshots**: VNC GUI screenshots (Linux only)

### 6. Cleanup (`cleanup.yaml`)

**Triggers:** Weekly schedule, Manual dispatch

**Jobs:**
- **Multi-Platform Testing**: Ubuntu + macOS
- **Cleanup Old Versions**: NPM package maintenance

## Platform-Specific Considerations

### macOS (Apple Silicon)

- **Bun Runtime**: Native Apple Silicon support
- **Unit Tests**: Full test suite execution
- **Integration Tests**: MCP server startup and package creation
- **No Docker**: Docker-based E2E tests run only on Linux

### Linux x86_64

- **Full Test Suite**: Unit, E2E, and container tests
- **Docker Support**: Multi-architecture builds and testing
- **VNC Screenshots**: GUI testing capabilities

### Docker Multi-Architecture

- **Platforms**: `linux/amd64`, `linux/arm64/v8`
- **Base Images**: 
  - MCP Server: `oven/bun:1.2-alpine`
  - VNC Obsidian: `debian:bullseye-slim`
- **Architecture Detection**: Automatic AppImage selection for ARM64/x86_64

## Test Strategy

### Unit Tests
- Run on all platforms (Ubuntu, macOS)
- TypeScript compilation checks
- Linting and formatting validation
- Core functionality testing
- Platform compatibility validation

### E2E Tests (Manual Docker Management)
- Linux-only due to Docker requirements
- **Manual container lifecycle**: User/CI manages Docker Compose startup/shutdown
- Uses `docker-compose.yaml` for service orchestration
- API endpoint testing against manually started containers
- Requires explicit container management in CI workflows

**CI Best Practice**: Use `hoverkraft-tech/compose-action@v2.2.0` instead of direct `docker compose` commands:

```yaml
- name: Start Docker Compose for E2E Tests
  id: compose-e2e
  uses: hoverkraft-tech/compose-action@v2.2.0
  with:
    compose-file: ./docker-compose.yaml
    up-flags: "-d"
```

Benefits:
- Automatic cleanup on failure
- Proper error handling
- Consistent container lifecycle management
- Better CI reliability

### Container Tests (Testcontainers)
- Linux-only due to Docker requirements
- **Automated container lifecycle**: Testcontainers library manages everything
- Uses `docker-compose.test.yaml` or programmatic container creation
- Container communication validation
- Automatic cleanup and resource management
- No manual Docker commands needed in tests

### Integration Tests
- Platform-specific server startup tests
- Package creation and validation
- Cross-platform compatibility checks

## Build Artifacts

### NPM Packages
- Tested on both Linux and macOS
- Universal compatibility
- Scoped package support

### Docker Images
- Multi-architecture support
- Automatic platform detection
- Optimized layer caching

## Monitoring and Debugging

### CI Summary
- Aggregated test results
- Platform-specific status
- Failure analysis

### Artifacts
- Test reports
- Screenshots (Linux VNC)
- Build logs
- Package files

## Best Practices

1. **Platform Matrix**: Use matrix strategy for multi-platform testing
2. **Conditional Jobs**: Skip Docker tests on macOS
3. **Dependency Management**: Ensure consistent dependencies across platforms
4. **Caching**: Utilize GitHub Actions cache for faster builds
5. **Error Handling**: Continue-on-error for non-critical steps

## Troubleshooting

### Common Issues

1. **macOS Bun Installation**: Ensure latest Bun version
2. **Docker Multi-Arch**: Verify QEMU and Buildx setup
3. **ARM64 AppImage**: Check Obsidian release availability
4. **Test Timeouts**: Adjust timeout values for slower platforms

### Test Commands

```bash
# Unit tests (cross-platform)
bun test ./src

# E2E tests (manual Docker management)
# 1. Start containers manually
docker compose -f docker-compose.yaml up -d
# 2. Run tests
bun run test:e2e
# 3. Stop containers manually
docker compose -f docker-compose.yaml down

# Container tests (automated with testcontainers)
bun run test:containers

# Platform compatibility tests
bun test ./src/platform.test.ts
```

### Debug Commands

```bash
# Test local multi-arch build
docker buildx build --platform linux/amd64,linux/arm64/v8 .

# Test macOS compatibility
bun install && bun test

# Verify Docker Compose (manual)
docker compose -f docker-compose.yaml up --build

# Verify Docker Compose (testcontainers)
docker compose -f docker-compose.test.yaml up --build
```

## Future Enhancements

1. **Windows Support**: Add Windows runners for broader compatibility
2. **Performance Testing**: Platform-specific performance benchmarks
3. **Security Scanning**: Multi-platform vulnerability assessment
4. **Release Automation**: Automated releases based on test results