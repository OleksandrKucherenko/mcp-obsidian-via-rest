# Docker Cleanup Configuration for E2E Tests

The MCP Server E2E tests use Testcontainers to spin up Docker resources. This document explains how to configure the cleanup behavior for these resources.

## Overview

The test suite creates several Docker resources:
- **Containers**: `obsidian` and `mcp` services
- **Networks**: `mcp-test-net` (bridge network)
- **Images**: Locally built images for both services
- **Volumes**: Any volumes created during test execution

## Cleanup Configuration

Cleanup behavior is controlled via environment variables:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLEANUP_ON_FAILURE` | `true` | Whether to cleanup Docker resources when tests fail |
| `REMOVE_VOLUMES` | `true` | Whether to remove Docker volumes during cleanup |
| `REMOVE_IMAGES` | `true` | Whether to remove locally built Docker images during cleanup |
| `REMOVE_NETWORKS` | `true` | Whether to remove Docker networks during cleanup |

### Usage Examples

```bash
# Run tests with full cleanup (default behavior)
bun test src/mcp-server.testcontainers.test.ts

# Run tests but keep resources when tests fail (useful for debugging)
CLEANUP_ON_FAILURE=false bun test src/mcp-server.testcontainers.test.ts

# Run tests but preserve images for faster subsequent runs
REMOVE_IMAGES=false bun test src/mcp-server.testcontainers.test.ts

# Run tests with minimal cleanup (keep everything for debugging)
CLEANUP_ON_FAILURE=false REMOVE_VOLUMES=false REMOVE_IMAGES=false REMOVE_NETWORKS=false bun test src/mcp-server.testcontainers.test.ts
```

## Cleanup Behavior

### On Test Success
- **Always performs full cleanup** regardless of configuration
- Removes containers, networks, volumes, and images based on configuration
- Uses both Testcontainers API and Docker CLI for comprehensive cleanup

### On Test Failure
- **Respects `CLEANUP_ON_FAILURE` setting**
- If `CLEANUP_ON_FAILURE=false`, preserves all resources for debugging
- If `CLEANUP_ON_FAILURE=true` (default), performs full cleanup

### Cleanup Methods

1. **Primary**: Uses Testcontainers `environment.down()` API
2. **Fallback**: Uses Docker CLI commands for any remaining resources
3. **Comprehensive**: Includes container, network, volume, and image cleanup

## Debugging Failed Tests

When tests fail and you want to inspect the Docker environment:

1. Set `CLEANUP_ON_FAILURE=false`
2. Run the failing test
3. Inspect the running containers:
   ```bash
   docker ps -a
   docker network ls
   docker volume ls
   docker images
   ```
4. Connect to containers for debugging:
   ```bash
   docker exec -it obsidian /bin/bash
   docker logs mcp
   ```
5. Manual cleanup when done:
   ```bash
   docker-compose -f docker-compose.test.yaml down --volumes --remove-orphans
   docker image prune -f
   docker network prune -f
   ```

## Cross-Platform Compatibility

The cleanup functionality works on:
- **Linux**: Native Docker
- **macOS**: Docker Desktop, Colima
- **Windows**: Docker Desktop, WSL2

All cleanup commands use the `|| true` pattern to ensure they don't fail if resources don't exist.

## Performance Considerations

- **Image Cleanup**: Disabling `REMOVE_IMAGES=false` can speed up subsequent test runs by reusing built images
- **Network Cleanup**: Disabling `REMOVE_NETWORKS=false` can slightly improve startup time
- **Volume Cleanup**: Disabling `REMOVE_VOLUMES=false` preserves any persistent data between runs

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure Docker daemon is running and accessible
2. **Resource Conflicts**: Check for existing containers/networks with same names
3. **Cleanup Failures**: Review console output for specific Docker CLI error messages

### Manual Cleanup Commands

If automatic cleanup fails, use these manual commands:

```bash
# Stop and remove containers
docker stop obsidian mcp obsidian-vnc-test mcp-obsidian-test || true
docker rm -f obsidian mcp obsidian-vnc-test mcp-obsidian-test || true

# Remove networks
docker network rm mcp-test-net || true
docker network prune -f

# Remove volumes
docker volume prune -f

# Remove images
docker image rm mcp-obsidiant-obsidian mcp-obsidiant-mcp || true
docker image prune -f
```
