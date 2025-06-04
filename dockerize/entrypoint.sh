#!/bin/bash
set -e

# Function to log messages with timestamps
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Screen resolution for Xvfb
SCREEN_RESOLUTION=${SCREEN_RESOLUTION:-1280x1024x24}

# Print home directory for debugging
echo "Home directory (\$HOME): ${HOME}"

# VNC Password (optional, set it via environment variable VNC_PASSWORD)
VNC_PASSWORD_ARG=""
if [ -n "${VNC_PASSWORD}" ]; then
  # Create a password file for x11vnc
  VNC_DIR="${HOME}/.vnc"
  VNC_PASSWD_FILE="${VNC_DIR}/passwd"

  echo "Creating VNC password file at: ${VNC_PASSWD_FILE}"
  mkdir -p "${VNC_DIR}"
  x11vnc -storepasswd "${VNC_PASSWORD}" "${VNC_PASSWD_FILE}"

  # Verify password was stored
  if [ -f "${VNC_PASSWD_FILE}" ]; then
    echo "VNC password file created successfully at ${VNC_PASSWD_FILE}"
    echo "Password file contents:"
    hexdump -C "${VNC_PASSWD_FILE}"
  else
    echo "ERROR: Failed to create VNC password file at ${VNC_PASSWD_FILE}"
  fi

  VNC_PASSWORD_ARG="-rfbauth ${VNC_PASSWD_FILE}"
fi

# Clean up any old X server lock files
# DISPLAY is typically :99 as set in Dockerfile
if [ -n "${DISPLAY}" ]; then
  # Extract display number, e.g., :99.0 -> 99
  DISPLAY_NUM=$(echo "${DISPLAY}" | sed 's/://g' | cut -d'.' -f1)
  LOCK_FILE="/tmp/.X${DISPLAY_NUM}-lock"
  if [ -f "${LOCK_FILE}" ]; then
    echo "Removing old X server lock file: ${LOCK_FILE}"
    rm -f "${LOCK_FILE}" || echo "Failed to remove ${LOCK_FILE}, continuing..."
  fi
fi

# Define vault locations
VAULT_NAME=${VAULT_NAME:-vault}
VAULT_PATH="${OBSIDIAN_CONFIG_DIR}/${VAULT_NAME}"

# Start Xvfb
echo "Starting Xvfb on display ${DISPLAY} with resolution ${SCREEN_RESOLUTION}"
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION} -nolisten tcp -nolisten unix &
XVFB_PID=$!

# Wait for Xvfb to be ready
for i in {1..20}; do
  if xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# Start dbus-daemon for the user (needed for Electron/Obsidian)
eval $(dbus-launch --sh-syntax)
export DBUS_SESSION_BUS_ADDRESS
export DBUS_SESSION_BUS_PID

# Create Fluxbox configuration for better window management
mkdir -p "${HOME}/.fluxbox"
cat >"${HOME}/.fluxbox/init" <<EOF
session.screen0.toolbar.visible: false
session.screen0.toolbar.autoHide: true
session.screen0.rootCommand: xsetroot -solid steelblue
session.screen0.defaultDeco: NONE
session.screen0.clickRaises: true
session.screen0.workspaceNames: Main
EOF

# Start Fluxbox window manager
echo "Starting Fluxbox"
fluxbox &
FLUXBOX_PID=$!

# Set a solid color background (fallback if feh is not used)
xsetroot -solid steelblue

# Wait for Fluxbox to initialize
sleep 2

# Set desktop background (wallpaper) using feh or fallback to xsetroot
WALLPAPER="/usr/share/backgrounds/debian-default"
if [ -f "$WALLPAPER" ]; then
  feh --bg-scale "$WALLPAPER" || xsetroot -solid grey
else
  echo "Skipping feh: $WALLPAPER does not exist"
  xsetroot -solid grey
fi

# Start x11vnc (VNC server)
echo "Starting x11vnc (VNC server) on port 5900 (IPv4 only)"
if ! pgrep -x x11vnc >/dev/null; then
  x11vnc -display ${DISPLAY} -forever -shared -rfbport 5900 ${VNC_PASSWORD_ARG} &
else
  echo "x11vnc is already running, skipping duplicate start."
fi

# Clean up function
cleanup() {
  log "Caught signal, cleaning up background processes..."

  # Stop processes in reverse order of starting
  for pid_var in X11VNC_PID FLUXBOX_PID XVFB_PID; do
    pid=${!pid_var}
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping ${pid_var%_PID} (PID $pid)..."
      kill -s TERM "$pid"
      if ! wait "$pid" 2>/dev/null; then
        log "${pid_var%_PID} (PID $pid) stopped"
      fi
    fi
  done

  log "Cleanup finished."
  exit 0
}

# Set up signal handlers for graceful shutdown
# Tini will forward signals to our entrypoint script
trap 'cleanup' SIGTERM SIGINT SIGQUIT

echo "Xvfb, Fluxbox, and x11vnc started."

# Ensure user config directory exists
echo "Ensuring Obsidian user config directory exists at /home/${USERNAME}/.config/obsidian"
mkdir -p "/home/${USERNAME}/.config/obsidian"
chown -R ${USERNAME}:${USERNAME} "/home/${USERNAME}/.config/obsidian"

# Ensure vault directory exists
echo "Ensuring vault directory exists at ${VAULT_PATH}"
mkdir -p "${VAULT_PATH}"
chown -R ${USERNAME}:${USERNAME} "${VAULT_PATH}"

# Run Obsidian as the appuser with gosu
log "Ensuring Obsidian user config directory exists at ${OBSIDIAN_APP_CONFIG_DIR}"
mkdir -p "${OBSIDIAN_APP_CONFIG_DIR}"

log "Ensuring vault directory exists at ${VAULT_PATH}"
mkdir -p "${VAULT_PATH}"

log "Running command: gosu appuser ./Obsidian.AppImage --no-sandbox --enable-unsafe-swiftshader ${VAULT_PATH}"
gosu appuser ./Obsidian.AppImage --no-sandbox --enable-unsafe-swiftshader "${VAULT_PATH}"
# Using "$@" to correctly pass all CMD arguments, and vault path as direct arg
gosu "${USERNAME}" "$@" "${VAULT_PATH}" &
MAIN_APP_PID=$!

# Wait for Obsidian to start before manipulating its window
sleep 5

# Use xdotool to find, activate, and position the Obsidian window
echo "Positioning Obsidian window..."
xdotool search --class "obsidian" windowactivate windowmove 0 0 windowsize 1200 900 || echo "Failed to position Obsidian window with xdotool"

# --- Wait for Obsidian to exit ---
set +e
wait $MAIN_APP_PID
MAIN_APP_STATUS=$?
set -e

# --- Final cleanup ---
log "Main application exited with status $MAIN_APP_STATUS. Performing final cleanup..."
cleanup

# Exit with the same status as the main application
exit $MAIN_APP_STATUS
