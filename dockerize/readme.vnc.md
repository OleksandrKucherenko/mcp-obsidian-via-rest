# Obsidian VNC Docker Image

Dockerized Obsidian note-taking application with VNC remote desktop access and Local REST API plugin pre-installed. Perfect for headless environments, CI/CD pipelines, and automated testing.

## Image Location

- **Docker Hub**: `docker.io/oleksandrkucherenko/obsidian-vnc`
- **GitHub Container Registry**: `ghcr.io/oleksandrkucherenko/obsidian-vnc`

### Image Reference Examples

```bash
# Pull from Docker Hub
docker pull oleksandrkucherenko/obsidian-vnc:latest

# Pull from GitHub Container Registry
docker pull ghcr.io/oleksandrkucherenko/obsidian-vnc:latest

# Pull specific version
docker pull oleksandrkucherenko/obsidian-vnc:1.8.10
```

## Supported Tags

| Tag                   | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `latest`              | Latest stable release (updated on stable version tags)         |
| `vX.Y.Z`              | Specific version (e.g., `1.8.10`)                              |
| `vX.Y`                | Latest patch version for a minor release (e.g., `1.8`)         |
| `vX`                  | Latest minor and patch version for a major release (e.g., `1`) |
| `next`                | Latest pre-release/development version                         |
| `alpha`, `beta`, `rc` | Pre-release tags for testing                                   |
| `sha-<commit>`        | Image built from a specific commit                             |

## What's Inside / Components

### Base Image

- **Base**: `debian:bullseye-slim` (minimal Debian 11)
- **Obsidian Version**: `1.8.10` (AppImage format)

### Included Runtime & Tools

#### Desktop Environment

- **Xvfb**: X Virtual Frame Buffer (display server)
- **Fluxbox**: Lightweight window manager
- **x11vnc**: VNC server for remote access

#### System Dependencies

- **DBUS**: For Electron/Obsidian notifications and IPC
- **FUSE**: For AppImage mounting
- **gosu**: For running as non-root user

#### Electron/Obsidian Dependencies

- GTK+ 3.0, NSS, X11 libraries
- Audio libraries (ALSA, PulseAudio)
- Secret service integration
- Font rendering libraries

#### Utilities

- **scrot**: Screenshot capture
- **xdotool**: Window manipulation and automation
- **feh**: Image display (background)
- **xterm**: Terminal emulator
- **wget, curl**: HTTP clients

### Exposed Ports

- **5900/tcp**: VNC server (x11vnc)
- **27124/tcp**: Obsidian Local REST API

### Default User

- **Username**: `appuser` (non-root)
- **UID/GID**: Automatically created at container startup
- **Home Directory**: `/home/appuser`

### Volumes

- `/config/obsidian`: Vault data directory
- `/home/appuser/.config/obsidian`: Obsidian application configuration

## Quick Start (Minimal Run)

```bash
# Pull and run the container
docker run --rm -d --name obsidian-vnc \
  -e VNC_PASSWORD=yoursecurepassword \
  --cap-add SYS_ADMIN \
  --device /dev/fuse:/dev/fuse \
  --security-opt apparmor:unconfined \
  -p 5900:5900 \
  -p 27124:27124 \
  oleksandrkucherenko/obsidian-vnc:latest
```

**Critical Security Options Required**:

- `--cap-add SYS_ADMIN`: Required for FUSE/AppImage mounting
- `--device /dev/fuse:/dev/fuse`: Required for AppImage execution
- `--security-opt apparmor:unconfined`: Required on AppArmor-enabled hosts

> **Note**: Without these options, the container will exit immediately as the Obsidian AppImage cannot mount.

## Configuration

### Environment Variables

| Variable                  | Default                          | Description                                                            |
| ------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `VNC_PASSWORD`            | (none)                           | Password for VNC connection. If unset, VNC runs without authentication |
| `VAULT_NAME`              | `vault`                          | Name of the Obsidian vault to open                                     |
| `SCREEN_RESOLUTION`       | `1280x1024x24`                   | Virtual display resolution (WIDTHxHEIGHTxCOLOR_DEPTH)                  |
| `DISPLAY`                 | `:99`                            | X11 display number                                                     |
| `TZ`                      | `Etc/UTC`                        | Container timezone                                                     |
| `OBSIDIAN_CONFIG_DIR`     | `/config/obsidian`               | Path to vault data directory                                           |
| `OBSIDIAN_APP_CONFIG_DIR` | `/home/appuser/.config/obsidian` | Path to Obsidian app configuration                                     |

### Docker Volumes

| Host Path            | Container Path                   | Purpose                      |
| -------------------- | -------------------------------- | ---------------------------- |
| `./obsidian/data`    | `/config/obsidian`               | Persistent vault storage     |
| `./obsidian/.config` | `/home/appuser/.config/obsidian` | Persistent Obsidian settings |

### Ports

| Port  | Protocol | Service                 |
| ----- | -------- | ----------------------- |
| 5900  | TCP      | VNC server (x11vnc)     |
| 27124 | TCP      | Obsidian Local REST API |

### Entrypoint / CMD Behavior

- **Entrypoint**: `/tini -- /entrypoint.sh` (uses tini as init system)
- **CMD**: `./Obsidian.AppImage --no-sandbox`
- **Process Flow**:
  1. Setup VNC password (if provided)
  2. Cleanup X server lock files
  3. Start Xvfb (virtual display)
  4. Initialize DBUS session
  5. Start Fluxbox window manager
  6. Start x11vnc server
  7. Launch Obsidian AppImage
  8. Position Obsidian window

## Usage Examples

### Production Example with Persistent Storage

```bash
docker run --rm -d --name obsidian-vnc \
  -e VNC_PASSWORD=prodpassword123 \
  -e SCREEN_RESOLUTION=1920x1080x24 \
  -e TZ=America/New_York \
  --cap-add SYS_ADMIN \
  --device /dev/fuse:/dev/fuse \
  --security-opt apparmor:unconfined \
  -p 5900:5900 \
  -p 27124:27124 \
  -v /path/to/vault:/config/obsidian \
  -v /path/to/config:/home/appuser/.config/obsidian \
  --restart unless-stopped \
  oleksandrkucherenko/obsidian-vnc:latest
```

### Local Development Example

```bash
# Build from source
docker build -t obsidian-vnc:dev ./dockerize

# Run with custom vault
docker run --rm -it --name obsidian-dev \
  -e VNC_PASSWORD=devpass \
  -e VAULT_NAME=my-notes \
  --cap-add SYS_ADMIN \
  --device /dev/fuse:/dev/fuse \
  --security-opt apparmor:unconfined \
  -p 5900:5900 \
  -p 27124:27124 \
  -v $(pwd)/my-vault:/config/obsidian/my-notes \
  obsidian-vnc:dev
```

### Docker Compose Example

```yaml
services:
  obsidian:
    image: oleksandrkucherenko/obsidian-vnc:latest
    container_name: obsidian-vnc
    environment:
      - VNC_PASSWORD=yoursecurepassword
      - SCREEN_RESOLUTION=1280x1024x24
      - TZ=Etc/UTC
    volumes:
      - ./obsidian/data:/config/obsidian
      - ./obsidian/.config:/home/appuser/.config/obsidian
    ports:
      - "5900:5900"
      - "27124:27124"
    cap_add:
      - SYS_ADMIN
    devices:
      - /dev/fuse:/dev/fuse
    security_opt:
      - apparmor:unconfined
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-check-certificate", "-S", "https://127.0.0.1:27124", "-O", "/dev/null", "-q"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

## Healthchecks / Readiness

### Healthcheck Behavior

The container includes a built-in healthcheck that monitors the Obsidian Local REST API:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-check-certificate", "-S", "https://127.0.0.1:27124", "-O", "/dev/null", "-q"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Verify Health Status

```bash
# Check container health
docker ps --filter name=obsidian-vnc

# Inspect healthcheck details
docker inspect obsidian-vnc --format='{{.State.Health.Status}}'

# Manually test Obsidian API
curl --insecure https://localhost:27124
```

**Expected API Response**:

```json
{
  "status": "OK",
  "manifest": {
    "id": "obsidian-local-rest-api",
    "name": "Local REST API",
    "version": "3.2.0"
  },
  "service": "Obsidian Local REST API",
  "authenticated": false
}
```

## Security Notes

### User Privileges

- **Runs as non-root user**: `appuser` (created at container startup)
- **Elevated capabilities required**: `SYS_ADMIN` for FUSE/AppImage mounting
- **Device access**: `/dev/fuse` required for AppImage execution
- **AppArmor**: Must run unconfined on AppArmor-enabled hosts

### Secrets Handling

- **VNC_PASSWORD**: Pass via environment variable (not recommended for production)
- **Better approach**: Use Docker secrets or external secret management
- **API Key**: Configure Obsidian Local REST API with a strong API key

### CVE Scanning & Updates

- **Base image**: `debian:bullseye-slim` receives security updates
- **Obsidian version**: Pinned to `1.8.10` for stability
- **Recommendation**: Regularly pull updated images and scan for vulnerabilities
- **Scanning tools**: Use `docker scan`, Trivy, or Snyk

### Network Security

- **VNC**: By default runs without password if `VNC_PASSWORD` not set
- **REST API**: Uses HTTPS with self-signed certificates
- **Firewall**: Restrict access to ports 5900 and 27124 as needed

## Troubleshooting

### Common Errors & Fixes

#### Container Exits Immediately

**Error**: Container exits without starting Obsidian

**Cause**: Missing required security options for FUSE/AppImage

**Fix**: Ensure all three options are present:

```bash
--cap-add SYS_ADMIN \
--device /dev/fuse:/dev/fuse \
--security-opt apparmor:unconfined
```

#### VNC Connection Refused

**Error**: Cannot connect to VNC server

**Diagnosis**:

```bash
# Check if VNC is running
docker exec obsidian-vnc pgrep x11vnc

# Check VNC logs
docker exec obsidian-vnc cat /tmp/x11vnc.log
```

**Fix**: Ensure port 5900 is exposed and not blocked by firewall

#### Obsidian Not Starting

**Error**: Obsidian window doesn't appear

**Diagnosis**:

```bash
# Check Obsidian logs
docker exec obsidian-vnc cat /tmp/obsidian.log

# Check if Obsidian process is running
docker exec obsidian-vnc pgrep -f Obsidian.AppImage
```

**Fix**: Verify AppImage permissions and FUSE is working

#### REST API Not Accessible

**Error**: Cannot connect to https://localhost:27124

**Diagnosis**:

```bash
# Check if Obsidian is running
curl --insecure https://localhost:27124

# Check container logs
docker logs obsidian-vnc
```

**Fix**: Wait for Obsidian to fully initialize (can take 10-30 seconds)

### Debug Tips

#### View Container Logs

```bash
# Follow logs in real-time
docker logs -f obsidian-vnc

# View last 100 lines
docker logs --tail 100 obsidian-vnc
```

#### Access Container Shell

```bash
# Enter running container
docker exec -it obsidian-vnc /bin/bash

# Check running processes
docker exec obsidian-vnc ps aux

# Check X server status
docker exec obsidian-vnc xdpyinfo -display :99
```

#### Verify VNC Connection

```bash
# Test VNC port accessibility
nc -zv localhost 5900

# Use VNC viewer with different encodings
tvnviewer -host=localhost -port=5900 -password=yourpassword -encoding=zrle
tvnviewer -host=localhost -port=5900 -password=yourpassword -encoding=hextile
tvnviewer -host=localhost -port=5900 -password=yourpassword -encoding=rre
```

#### Screenshot for Debugging

```bash
# Capture screenshot inside container
docker exec obsidian-vnc scrot /tmp/screenshot.png

# Copy screenshot to host
docker cp obsidian-vnc:/tmp/screenshot.png ./screenshot.png
```

## Build + Publish Info (for Maintainers)

### Dockerfile Location

- **Path**: `./dockerize/Dockerfile`
- **Context**: `./dockerize`
- **Entrypoint**: `./dockerize/entrypoint.sh`

### CI Pipeline Reference

- **GitHub Workflow**: `.github/workflows/docker-hub.yml`
- **Triggers**: Version tags (`v*`) and manual workflow dispatch
- **Platforms**: `linux/amd64`, `linux/arm64` (multi-arch builds)
- **Registry**: Docker Hub (`docker.io/oleksandrkucherenko/obsidian-vnc`)

### Build Locally

```bash
# Build for current platform
docker build -t obsidian-vnc:local ./dockerize

# Build for multiple platforms (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t obsidian-vnc:local ./dockerize

# Build with specific Obsidian version
docker build --build-arg OBSIDIAN_VERSION=1.8.10 -t obsidian-vnc:1.8.10 ./dockerize
```

### Publish New Version

1. **Update version in Dockerfile** (if needed):

   ```dockerfile
   ARG OBSIDIAN_VERSION="1.8.11"
   ```

2. **Create and push version tag**:

   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

3. **CI automatically**:
   - Builds multi-arch images
   - Pushes to Docker Hub
   - Creates version tags (`v1.0.0`, `v1.0`, `v1`)
   - Updates `latest` tag (for stable releases)
   - Updates Docker Hub description

### Manual Publishing

```bash
# Login to Docker Hub
docker login docker.io

# Tag image
docker tag obsidian-vnc:local oleksandrkucherenko/obsidian-vnc:1.0.0

# Push to Docker Hub
docker push oleksandrkucherenko/obsidian-vnc:1.0.0
```

## Changelog / Versioning Policy

### Versioning Scheme

- **Semantic Versioning**: Follows SemVer (`MAJOR.MINOR.PATCH`)
- **Obsidian Version**: Pinned to specific release (`1.8.10`)
- **Image Tags**: Correlate with project releases

### Tag Strategy

| Tag Type        | Example               | When Updated                       |
| --------------- | --------------------- | ---------------------------------- |
| `latest`        | `latest`              | Latest stable release only         |
| `vX.Y.Z`        | `1.8.10`              | Every release                      |
| `vX.Y`          | `1.8`                 | Latest patch in minor series       |
| `vX`            | `1`                   | Latest minor/patch in major series |
| `next`          | `next`                | Latest pre-release                 |
| `alpha/beta/rc` | `alpha`, `beta`, `rc` | Pre-release builds                 |

### Release Process

1. **Pre-release** (`0.6.0-rc.0`):
   - Tagged as `next`, `rc`
   - NOT tagged as `latest`

2. **Stable release** (`1.0.0`):
   - Tagged as `latest`, `1.0.0`, `1.0`, `1`
   - All older stable releases lose `latest` tag

3. **Patch release** (`1.0.1`):
   - Tagged as `latest`, `1.0.1`, `1.0`, `1`
   - Updates minor and major tags

### Links

- **GitHub Releases**: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/releases
- **Docker Hub**: https://hub.docker.com/r/oleksandrkucherenko/obsidian-vnc
- **GitHub Container Registry**: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/pkgs/container/obsidian-vnc
- **CHANGELOG**: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/blob/main/CHANGELOG.md

## Additional Resources

- **Project Repository**: https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest
- **Obsidian**: https://obsidian.md/
- **Local REST API Plugin**: https://github.com/coddingtonbear/obsidian-local-rest-api
- **VNC Viewers**:
  - TightVNC: https://www.tightvnc.com/
  - TigerVNC: https://tigervnc.org/
  - RealVNC: https://www.realvnc.com/

## License

MIT License

Copyright (c) 2024-present, Oleksandr Kucherenko

This Docker image is part of the mcp-obsidian-via-rest project. See the project repository for license information.
