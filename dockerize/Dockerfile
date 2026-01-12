# Use a minimal Debian-based image
FROM --platform=$BUILDPLATFORM debian:bullseye-slim

# Detect architecture and use the appropriate AppImage URL
ARG TARGETARCH

# Obsidian version
ARG OBSIDIAN_VERSION="1.8.10"

ENV OBSIDIAN_APPIMAGE_ARM64_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}-arm64.AppImage"
ENV OBSIDIAN_APPIMAGE_STD_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage"
ENV USERNAME=appuser
ENV OBSIDIAN_CONFIG_DIR=/config/obsidian
ENV OBSIDIAN_APP_CONFIG_DIR=/home/${USERNAME}/.config/obsidian
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV APP_DIR=/app
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null
ENV TZ=Etc/UTC
ENV SCREEN_RESOLUTION=1280x1024x24

# Install system dependencies (cached layer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # generic tools
    tini wget curl ca-certificates git unzip bsdextrautils procps \
    # x11 virtual display, fluxbox window manager, x11vnc (VNC server)
    xvfb fluxbox x11vnc \
    # dbus for Electron/Obsidian notifications and IPC
    dbus dbus-x11 \
    # Dependencies for Electron/Obsidian AppImage
    libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libxtst6 libx11-xcb1 libsecret-1-0 libgbm1 libuuid1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 \
    libexpat1 libfontconfig1 libgbm1 libgdk-pixbuf2.0-0 libglib2.0-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxtst6 fonts-liberation libappindicator3-1 xdg-utils zlib1g zlib1g-dev \
    # For screenshots and UI automation
    scrot xdotool \
    # For desktop background and basic tools
    feh xterm x11-xserver-utils x11-utils \
    # For running commands as a different user
    gosu \
    # For AppImage
    fuse \
    # Clean up
    && apt-get clean \
    && find /var/lib/apt/lists -delete \
    && ln -sf /usr/bin/tini /tini

# Create a non-root user (cached layer)
RUN useradd --create-home --shell /bin/bash ${USERNAME} && \
    mkdir -p ${APP_DIR} ${OBSIDIAN_CONFIG_DIR} && \
    mkdir -p ${OBSIDIAN_APP_CONFIG_DIR} && \
    chown -R ${USERNAME}:${USERNAME} ${APP_DIR} ${OBSIDIAN_CONFIG_DIR} && \
    chown -R ${USERNAME}:${USERNAME} ${OBSIDIAN_APP_CONFIG_DIR}

WORKDIR ${APP_DIR}

# Copy entrypoint script (before AppImage download for better caching)
COPY --chown=${USERNAME}:${USERNAME} entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Download and set up Obsidian AppImage (separate layer for version changes)
RUN if [ "${TARGETARCH}" = "arm64" ]; then URL=${OBSIDIAN_APPIMAGE_ARM64_URL}; else URL=${OBSIDIAN_APPIMAGE_STD_URL}; fi && \
    wget -O Obsidian.AppImage "${URL}" && \
    chmod +x Obsidian.AppImage

# Expose VNC port and a port for Obsidian Sync (if needed, adjust as necessary)
EXPOSE 5900

# Local REST API port
EXPOSE 27124

# Embed default vault data and app config into the image
COPY --chown=${USERNAME}:${USERNAME} obsidian/data/ ${OBSIDIAN_CONFIG_DIR}/
COPY --chown=${USERNAME}:${USERNAME} obsidian/.config/obsidian/ ${OBSIDIAN_APP_CONFIG_DIR}/

# Allow override/persistence via volumes
VOLUME ${OBSIDIAN_CONFIG_DIR}
VOLUME ${OBSIDIAN_APP_CONFIG_DIR}

# Use Tini as the entrypoint
ENTRYPOINT ["/tini", "--", "/entrypoint.sh"]

# Default command (can be overridden)
CMD ["./Obsidian.AppImage", "--no-sandbox"]
