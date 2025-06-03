#!/bin/bash
set -e

# Screen resolution for Xvfb
SCREEN_RESOLUTION=${SCREEN_RESOLUTION:-1280x1024x24}
# VNC Password (optional, set it via environment variable VNC_PASSWORD)
VNC_PASSWORD_ARG=""
if [ -n "${VNC_PASSWORD}" ]; then
  # Create a password file for x11vnc
  mkdir -p ~/.vnc
  x11vnc -storepasswd "${VNC_PASSWORD}" ~/.vnc/passwd
  VNC_PASSWORD_ARG="-rfbauth ~/.vnc/passwd"
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

# Start Xvfb
echo "Starting Xvfb on display ${DISPLAY} with resolution ${SCREEN_RESOLUTION}"
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION} -nolisten tcp -nolisten unix &
XVFB_PID=$!

# Start Fluxbox window manager
echo "Starting Fluxbox"
fluxbox &
FLUXBOX_PID=$!

# Start x11vnc
echo "Starting x11vnc (VNC server) on port 5900"
# Use -nopw if VNC_PASSWORD_ARG is not set (i.e., VNC_PASSWORD was empty)
x11vnc -display ${DISPLAY} -forever -shared ${VNC_PASSWORD_ARG:--nopw} -rfbport 5900 -create &
X11VNC_PID=$!



# Clean up function
cleanup() {
    echo "Caught signal, cleaning up background processes..."
    if kill -0 $X11VNC_PID 2>/dev/null; then echo "Stopping x11vnc (PID $X11VNC_PID)..."; kill $X11VNC_PID; wait $X11VNC_PID 2>/dev/null; fi
    if kill -0 $FLUXBOX_PID 2>/dev/null; then echo "Stopping Fluxbox (PID $FLUXBOX_PID)..."; kill $FLUXBOX_PID; wait $FLUXBOX_PID 2>/dev/null; fi
    if kill -0 $XVFB_PID 2>/dev/null; then echo "Stopping Xvfb (PID $XVFB_PID)..."; kill $XVFB_PID; wait $XVFB_PID 2>/dev/null; fi
    echo "Cleanup finished."
}

# Trap SIGTERM and SIGINT to call cleanup
trap 'cleanup' SIGTERM SIGINT

echo "Xvfb, Fluxbox, and x11vnc started. Running command: $@"
# Execute the command passed to the entrypoint (e.g., Obsidian AppImage)
# The CMD from Dockerfile will be passed as arguments here
# Run the main application in the background and wait for it.
# This allows the script's trap to handle signals.
# Launch Obsidian as appuser, with no sandbox, and specify the test vault.
# OBSIDIAN_APPIMAGE_PATH is set in the Dockerfile.
echo "Running command: gosu ${USERNAME} $1 $2 /config/obsidian/vault-tests"
gosu "${USERNAME}" "$1" "$2" "/config/obsidian/vault-tests" &
MAIN_APP_PID=$!

wait $MAIN_APP_PID

# After the main application exits (normally or due to signal it handled),
# perform a final cleanup.
echo "Main application exited. Performing final cleanup..."
cleanup
echo "Entrypoint script finished."
