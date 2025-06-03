# Use a minimal Debian-based image
FROM debian:bullseye-slim

ARG OBSIDIAN_APPIMAGE_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v1.8.10/Obsidian-1.8.10.AppImage"
ARG OBSIDIAN_VERSION="1.8.10"

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV USERNAME=appuser
ENV APP_DIR=/app
ENV OBSIDIAN_CONFIG_DIR=/config/obsidian
ENV OBSIDIAN_APP_CONFIG_DIR=/home/${USERNAME}/.config/obsidian

# Install dependencies
RUN apt-get update  \
    && apt-get install -y --no-install-recommends \
    # generic tools
    wget curl ca-certificates git unzip bsdextrautils \
    # x11 virtual display, fluxbox window manager, x11vnc (VNC server)
    xvfb fluxbox x11vnc \
    # Dependencies for Electron/Obsidian AppImage
    libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libxtst6 libx11-xcb1 libsecret-1-0 libgbm1 libuuid1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 \
    libexpat1 libfontconfig1 libgbm1 libgdk-pixbuf2.0-0 libglib2.0-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxtst6 fonts-liberation libappindicator3-1 xdg-utils \
    # For screenshots and UI automation
    scrot xdotool \
    # For desktop background and basic tools
    feh xterm x11-xserver-utils \
    # For running commands as a different user
    gosu \
    # For AppImage
    fuse \
    # Clean up
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd --create-home --shell /bin/bash ${USERNAME}

# Create app and config directories
RUN mkdir -p ${APP_DIR} ${OBSIDIAN_CONFIG_DIR} && \
    mkdir -p ${OBSIDIAN_APP_CONFIG_DIR} && \
    chown -R ${USERNAME}:${USERNAME} ${APP_DIR} ${OBSIDIAN_CONFIG_DIR} && \
    chown -R ${USERNAME}:${USERNAME} ${OBSIDIAN_APP_CONFIG_DIR}

WORKDIR ${APP_DIR}

# Download and set up Obsidian AppImage
RUN wget -O Obsidian.AppImage "${OBSIDIAN_APPIMAGE_URL}" && \
    chmod +x Obsidian.AppImage

# Copy entrypoint script
COPY --chown=${USERNAME}:${USERNAME} entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose VNC port and a port for Obsidian Sync (if needed, adjust as necessary)
EXPOSE 5900

# Local REST API port
EXPOSE 27124

# Set up a volume for Obsidian configuration/vaults
VOLUME ${OBSIDIAN_CONFIG_DIR}
# Obsidian app configuration, global settings
VOLUME ${OBSIDIAN_APP_CONFIG_DIR} 

ENTRYPOINT ["/entrypoint.sh"]

CMD ["./Obsidian.AppImage", "--no-sandbox"]
