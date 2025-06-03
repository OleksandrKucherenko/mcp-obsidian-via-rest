#!/bin/bash
set -e

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

# Set background color using feh as an alternative method
feh --bg-scale /usr/share/backgrounds/debian-default || echo "Background setting with feh failed, using xsetroot as fallback"

# Start x11vnc
echo "Starting x11vnc (VNC server) on port 5900"
# Use -nopw if VNC_PASSWORD_ARG is not set (i.e., VNC_PASSWORD was empty)
# Removed -create flag as it can cause issues with blank screens
x11vnc -display ${DISPLAY} -forever -shared ${VNC_PASSWORD_ARG:--nopw} -rfbport 5900 -noxdamage &
X11VNC_PID=$!

# Clean up function
cleanup() {
  echo "Caught signal, cleaning up background processes..."
  if kill -0 $X11VNC_PID 2>/dev/null; then
    echo "Stopping x11vnc (PID $X11VNC_PID)..."
    kill $X11VNC_PID
    wait $X11VNC_PID 2>/dev/null
  fi
  if kill -0 $FLUXBOX_PID 2>/dev/null; then
    echo "Stopping Fluxbox (PID $FLUXBOX_PID)..."
    kill $FLUXBOX_PID
    wait $FLUXBOX_PID 2>/dev/null
  fi
  if kill -0 $XVFB_PID 2>/dev/null; then
    echo "Stopping Xvfb (PID $XVFB_PID)..."
    kill $XVFB_PID
    wait $XVFB_PID 2>/dev/null
  fi
  echo "Cleanup finished."
}

# Trap SIGTERM and SIGINT to call cleanup
trap 'cleanup' SIGTERM SIGINT

echo "Xvfb, Fluxbox, and x11vnc started."

# Ensure user config directory exists
echo "Ensuring Obsidian user config directory exists at /home/${USERNAME}/.config/obsidian"
mkdir -p "/home/${USERNAME}/.config/obsidian"
chown -R ${USERNAME}:${USERNAME} "/home/${USERNAME}/.config/obsidian"

# Ensure vault directory exists
echo "Ensuring vault directory exists at ${VAULT_PATH}"
mkdir -p "${VAULT_PATH}"
chown -R ${USERNAME}:${USERNAME} "${VAULT_PATH}"

# --- Launch Obsidian with the vault ---
#echo "Launching Obsidian with URI: obsidian://open?vault=${VAULT_NAME}"
#gosu ${USERNAME} "$@" "obsidian://open?vault=${VAULT_NAME}" &

# Using "$@" to pass all arguments from CMD, which is more robust and addresses shellcheck warnings.
# Using $* for simpler echo string representation, vault path as direct arg
echo "Running command: gosu ${USERNAME} $* ${VAULT_PATH}"
# Using "$@" to correctly pass all CMD arguments, and vault path as direct arg
gosu "${USERNAME}" "$@" "${VAULT_PATH}" &
MAIN_APP_PID=$!

# Wait for Obsidian to start before manipulating its window
sleep 5

# Use xdotool to find, activate, and position the Obsidian window
echo "Positioning Obsidian window..."
xdotool search --class "obsidian" windowactivate windowmove 0 0 windowsize 1200 900 || echo "Failed to position Obsidian window with xdotool"

# --- Wait for Obsidian to exit ---
wait $MAIN_APP_PID

# --- Final cleanup ---
echo "Main application exited. Performing final cleanup..."

cleanup
echo "Entrypoint script finished."
