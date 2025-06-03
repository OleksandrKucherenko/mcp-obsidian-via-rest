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

echo "Xvfb, Fluxbox, and x11vnc started. Running command:" "$@"
# Make sure the vault directory exists and has proper structure for Obsidian
VAULT_PATH="/config/obsidian/vault-tests"
OBSIDIAN_CONFIG_DIR="${VAULT_PATH}/.obsidian"

# Create .obsidian directory if it doesn't exist
if [ ! -d "${OBSIDIAN_CONFIG_DIR}" ]; then
    echo "Creating Obsidian config directory at ${OBSIDIAN_CONFIG_DIR}"
    mkdir -p "${OBSIDIAN_CONFIG_DIR}"
fi

# Always ensure the appuser has ownership of the vault path
# This is crucial because the volume might be mounted with root ownership from the host,
# or a different user's ownership if files were created on the host directly.
echo "Ensuring ${USERNAME} owns ${VAULT_PATH}"
chown -R "${USERNAME}:${USERNAME}" "${VAULT_PATH}" || echo "Warning: Failed to chown ${VAULT_PATH}. This might be okay if already owned by ${USERNAME}."

# Execute the command passed to the entrypoint (e.g., Obsidian AppImage)
# The CMD from Dockerfile will be passed as arguments here
# Run the main application in the background and wait for it.
# This allows the script's trap to handle signals.
# Launch Obsidian as appuser, with no sandbox, and use the '--vault' flag to properly open the vault
# OBSIDIAN_APPIMAGE_PATH is set in the Dockerfile.

echo "--- Debugging file system state before Obsidian launch (as ${USERNAME}) ---"
echo "[DEBUG] Listing /config/obsidian (global config root set by ENV OBSIDIAN_CONFIG_DIR):"
gosu "${USERNAME}" ls -la "/config/obsidian"
echo "[DEBUG] Listing ${VAULT_PATH} (target vault path):"
gosu "${USERNAME}" ls -la "${VAULT_PATH}"
echo "[DEBUG] Listing ${VAULT_PATH}/.obsidian (target vault's .obsidian dir):"
gosu "${USERNAME}" ls -la "${VAULT_PATH}/.obsidian"

echo "[DEBUG] Checking for common global Obsidian config files/dirs in /config/obsidian:"
COMMON_GLOBAL_PATHS=("/config/obsidian/.config" "/config/obsidian/obsidian" "/config/obsidian/Obsidian" "/config/obsidian/appdata")
for p in "${COMMON_GLOBAL_PATHS[@]}"; do
  if gosu "${USERNAME}" [ -d "$p" ]; then
    echo "[DEBUG] Found directory: $p. Listing contents:"
    gosu "${USERNAME}" ls -la "$p"
  else
    echo "[DEBUG] Directory not found: $p"
  fi
done
echo "[DEBUG] Searching for .json files in /config/obsidian (up to depth 2):"
gosu "${USERNAME}" find "/config/obsidian" -maxdepth 2 -name "*.json" -ls 2>/dev/null || echo "[DEBUG] No .json files found or error searching in /config/obsidian (up to depth 2)"

echo "[DEBUG] Full listing of ${VAULT_PATH}/.obsidian:"
# The following command substitution might be problematic if find fails and set -e is on.
# Making it safer:
FIND_OUTPUT=$(gosu "${USERNAME}" find "${VAULT_PATH}/.obsidian" -ls 2>/dev/null || true) # Added || true to ensure command substitution itself doesn't cause exit
if [ -n "$FIND_OUTPUT" ]; then
  echo "$FIND_OUTPUT"
elif gosu "${USERNAME}" [ -d "${VAULT_PATH}/.obsidian" ]; then # Check if dir exists if find returned nothing
    echo "[DEBUG] Directory ${VAULT_PATH}/.obsidian exists but 'find' returned no content or failed silently."
else
    echo "[DEBUG] Directory ${VAULT_PATH}/.obsidian not found or 'find' failed."
fi

echo "[DEBUG] Checking /home/${USERNAME}/.config existence and accessibility:"
gosu "${USERNAME}" ls -ld "/home/${USERNAME}/.config" >/dev/null 2>&1 || echo "[DEBUG] /home/${USERNAME}/.config not found, not listable, or ls failed."

echo "[DEBUG] Checking /home/${USERNAME}/.config/obsidian existence and listing contents:"
# Test for directory existence first, then attempt to list if it exists.
if gosu "${USERNAME}" test -d "/home/${USERNAME}/.config/obsidian" 2>/dev/null; then
  echo "[DEBUG] Found /home/${USERNAME}/.config/obsidian. Listing contents:"
  gosu "${USERNAME}" find "/home/${USERNAME}/.config/obsidian" -ls 2>/dev/null || echo "[DEBUG] Error listing or nothing found in /home/${USERNAME}/.config/obsidian (find command failed)"
else
  echo "[DEBUG] /home/${USERNAME}/.config/obsidian not found or 'test -d' failed."
fi
echo "--- End debugging file system state ---"

# Using "$@" to pass all arguments from CMD, which is more robust and addresses shellcheck warnings.
echo "Running command: gosu ${USERNAME} $* ${VAULT_PATH}" # Using $* for simpler echo string representation, vault path as direct arg
gosu "${USERNAME}" "$@" "${VAULT_PATH}" & # Using "$@" to correctly pass all CMD arguments, and vault path as direct arg
MAIN_APP_PID=$!

wait $MAIN_APP_PID

# After the main application exits (normally or due to signal it handled),
# perform a final cleanup.
echo "Main application exited. Performing final cleanup..."
cleanup
echo "Entrypoint script finished."
