#!/bin/bash

set -e

# ---- Global Variables ----
SCREEN_RESOLUTION=${SCREEN_RESOLUTION:-1280x1024x24}
VAULT_NAME=${VAULT_NAME:-vault}
VNC_PASSWORD_ARG=""

XVFB_PID=""
FLUXBOX_PID=""
X11VNC_PID=""
MAIN_APP_PID=""

# WALLPAPER="/usr/share/images/fluxbox/debian-dark.png" # black background
WALLPAPER="/usr/share/images/fluxbox/fluxbox.png" # green background

# ---- Utility Functions ----
log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

# ---- Setup Functions ----
setup_vnc_password() {
  [ -z "${VNC_PASSWORD}" ] && return

  VNC_DIR="${HOME}/.vnc"
  VNC_PASSWD_FILE="${VNC_DIR}/passwd"

  log "Creating VNC password file at: ${VNC_PASSWD_FILE}"
  mkdir -p "${VNC_DIR}"
  x11vnc -storepasswd "${VNC_PASSWORD}" "${VNC_PASSWD_FILE}"

  if [ ! -f "${VNC_PASSWD_FILE}" ]; then
    log "ERROR: Failed to create VNC password file at ${VNC_PASSWD_FILE}"
    return
  fi

  log "VNC password file created successfully at ${VNC_PASSWD_FILE}"
  log "Password file ${VNC_PASSWD_FILE} contents:"
  hexdump -C "${VNC_PASSWD_FILE}" | head -n 1

  export VNC_PASSWORD_ARG="-rfbauth ${VNC_PASSWD_FILE}"
}

cleanup_x_locks() {
  [ -z "${DISPLAY}" ] && return

  DISPLAY_NUM=$(echo "${DISPLAY}" | sed 's/://g' | cut -d'.' -f1)
  LOCK_FILE="/tmp/.X${DISPLAY_NUM}-lock"

  [ ! -f "${LOCK_FILE}" ] && return

  log "Removing old X server lock file: ${LOCK_FILE}"
  rm -f "${LOCK_FILE}" || log "Failed to remove ${LOCK_FILE}, continuing..."
}

setup_vault_paths() {
  VAULT_PATH="${OBSIDIAN_CONFIG_DIR}/${VAULT_NAME}"
  log "Vault path: ${VAULT_PATH}"
}

start_xvfb() {
  log "Starting Xvfb on display ${DISPLAY} with resolution ${SCREEN_RESOLUTION}"
  Xvfb "${DISPLAY}" -screen 0 "${SCREEN_RESOLUTION}" -nolisten tcp -nolisten unix &
  XVFB_PID=$!

  log "Xvfb started with PID ${XVFB_PID}"

  # Wait for Xvfb to be ready
  for i in {1..20}; do
    log "Waiting for Xvfb to be ready... ${i}/20"
    xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1 && break
    sleep 0.2
  done
}

setup_dbus() {
  log "Starting DBUS"

  eval $(dbus-launch --sh-syntax)
  export DBUS_SESSION_BUS_ADDRESS
  export DBUS_SESSION_BUS_PID

  log "DBUS initialized: '${DBUS_SESSION_BUS_ADDRESS}'"
}

setup_fluxbox() {
  mkdir -p "${HOME}/.fluxbox"

  {
    echo "session.screen0.toolbar.visible: false"
    echo "session.screen0.toolbar.autoHide: true"
    echo "session.screen0.rootCommand: xsetroot -solid steelblue"
    echo "session.screen0.defaultDeco: NONE"
    echo "session.screen0.clickRaises: true"
    echo "session.screen0.workspaceNames: Main"
  } >"${HOME}/.fluxbox/init"

  log "Starting Fluxbox"
  fluxbox >/dev/null 2>&1 &
  FLUXBOX_PID=$!

  log "Fluxbox started with PID ${FLUXBOX_PID}"

  # Wait for Fluxbox to initialize
  sleep 2
}

setup_background() {
  xsetroot -solid steelblue

  [ ! -f "${WALLPAPER}" ] && {
    log "Skipping feh: $WALLPAPER does not exist"
    xsetroot -solid grey
    return
  }

  feh --bg-scale "${WALLPAPER}" || xsetroot -solid grey
}

start_vnc_server() {
  log "Starting x11vnc (VNC server) on port 5900 (IPv4 only)"

  pgrep -x x11vnc >/dev/null && {
    log "x11vnc is already running, skipping duplicate start."
    return
  }

  log "x11vnc -display ${DISPLAY} -ncache 10 -forever -shared -rfbport 5900 ${VNC_PASSWORD_ARG}"

  # shellcheck disable=SC2086
  x11vnc ${VNC_PASSWORD_ARG} -display "${DISPLAY}" -ncache 10 -forever -shared -rfbport 5900 &>/tmp/x11vnc.log &
  X11VNC_PID=$!

  log "x11vnc log file: /tmp/x11vnc.log" # also it hide all x11vnc info output
  log "x11vnc started with PID ${X11VNC_PID}"
}

ensure_directories() {
  log "Ensuring Obsidian user config directory exists at /home/${USERNAME}/.config/obsidian"
  mkdir -p "/home/${USERNAME}/.config/obsidian"
  chown -R "${USERNAME}":"${USERNAME}" "/home/${USERNAME}/.config/obsidian"

  log "Ensuring Obsidian user config directory exists at ${OBSIDIAN_APP_CONFIG_DIR}"
  mkdir -p "${OBSIDIAN_APP_CONFIG_DIR}"

  log "Ensuring vault directory exists at ${VAULT_PATH}"
  mkdir -p "${VAULT_PATH}"
  chown -R "${USERNAME}":"${USERNAME}" "${VAULT_PATH}"
}

# Inspect binary architecture to verify compatibility
inspect_binary() {
  local binary="$1"
  log "===== BINARY INSPECTION START ===== "
  log "Inspecting binary: $binary"
  
  log "System architecture: $(uname -m)"
  
  if [ -f "$binary" ]; then
    log "File exists and is accessible"
    
    # Basic file information
    log "File command output:"
    file "$binary" | tee -a /tmp/obsidian.log
    
    # Check ELF headers
    log "ELF headers (if applicable):"
    if readelf -h "$binary" 2>/dev/null; then
      readelf -h "$binary" | grep -E 'Class|Machine|Data|Type' | tee -a /tmp/obsidian.log
    else
      log "Not a valid ELF binary or readelf failed"
    fi
    
    # Try objdump
    log "Objdump machine info (if applicable):"
    if objdump -f "$binary" 2>/dev/null; then
      objdump -f "$binary" | grep -E 'architecture|format' | tee -a /tmp/obsidian.log
    else
      log "objdump could not process the binary"
    fi
  else
    log "ERROR: Binary file does not exist: $binary"
  fi
  log "===== BINARY INSPECTION END ===== "
}

start_obsidian() {
  log "Running Obsidian with vault path: ${VAULT_PATH}"
  
  # Inspect the AppImage before executing
  inspect_binary "$1"
  
  log "exec: gosu ${USERNAME} $@ ${VAULT_PATH}"
  # Redirect stdout and stderr from Obsidian to our log file
  gosu "${USERNAME}" "$@" "${VAULT_PATH}" &>/tmp/obsidian.log &
  MAIN_APP_PID=$!

  # Save PID to ensure we can properly track the process
  echo "$MAIN_APP_PID" >/tmp/obsidian.pid

  log "Obsidian log file: /tmp/obsidian.log"
  log "Obsidian started with PID ${MAIN_APP_PID}"

  # Wait for Obsidian to start before manipulating its window
  sleep 5
}

position_window() {
  log "Attempting to position Obsidian window..."

  # Try to position the window, but don't exit if it fails
  if ! xdotool search --class "obsidian" windowactivate windowmove 0 0 windowsize 1200 900; then
    log "Failed to position Obsidian window with xdotool - this is non-fatal, continuing..."
  else
    log "Successfully positioned Obsidian window"
  fi
}

# Modified cleanup function that doesn't kill everything
cleanup_handle_signals() {
  log "Caught signal, cleaning up background processes..."

  # Stop processes in reverse order of starting
  for pid_var in X11VNC_PID FLUXBOX_PID XVFB_PID; do
    pid=${!pid_var}
    [ -z "$pid" ] && continue

    kill -0 "$pid" 2>/dev/null || continue

    log "Stopping ${pid_var%_PID} (PID $pid)..."
    kill -s TERM "$pid"
    wait "$pid" 2>/dev/null && log "${pid_var%_PID} (PID $pid) stopped"
  done

  log "Cleanup finished."
}

# Check if process is running
check_process_running() {
  local pid=$1
  [ -z "$pid" ] && return 1
  kill -0 "$pid" 2>/dev/null
  return $?
}

# macOS specific check for Obsidian health
check_obsidian_health() {
  # If Obsidian is running, all is well
  if check_process_running "$MAIN_APP_PID"; then
    return 0
  fi

  # If we got here, Obsidian isn't running
  log "WARNING: Obsidian process (PID ${MAIN_APP_PID}) is not running!"

  # Check the log for known issues
  if grep -q "AppImages require FUSE" /tmp/obsidian.log; then
    log "ERROR: AppImage requires FUSE but FUSE isn't available."
    log "Try running the container with --privileged flag."
    return 1
  fi

  # Check for other common errors
  if grep -q "Error:" /tmp/obsidian.log; then
    log "ERROR found in Obsidian logs:"
    grep "Error:" /tmp/obsidian.log | head -5
  fi

  # If Obsidian died but REST API is needed, we'll warn but continue
  log "Obsidian process exited, but keeping services running for REST API."
  return 0
}

# ---- Main Function ----
main() {
  log "Home directory (\$HOME): ${HOME}"

  # Setup phase
  setup_vnc_password
  cleanup_x_locks
  setup_vault_paths

  # Start X environment
  start_xvfb
  setup_dbus
  setup_fluxbox
  setup_background
  start_vnc_server

  log "Xvfb, Fluxbox, and x11vnc started."

  # Prepare and start application
  ensure_directories
  start_obsidian "$@"
  position_window

  # Create a healthcheck file for Docker
  touch /tmp/healthcheck

  # Instead of waiting for app to exit, keep container running
  log "Services started. Container will now run indefinitely. Use Ctrl+C to stop."

  # Keep updating the healthcheck file periodically
  while true; do
    # Check if Obsidian is healthy
    check_obsidian_health

    # Update the healthcheck timestamp
    touch /tmp/healthcheck

    # Sleep for a while before checking again
    sleep 30
  done
}

# Set up signal handlers for graceful shutdown
# trap 'cleanup_handle_signals' SIGTERM SIGINT SIGQUIT EXIT

# Inspect gosu binary for reference
inspect_system() {
  log "===== SYSTEM INSPECTION START ===== "
  log "System architecture: $(uname -m)"
  log "Container details:"
  cat /etc/os-release | grep -E "NAME|VERSION" | tee -a /tmp/obsidian.log
  
  log "Inspecting gosu binary for reference:"
  which gosu && file $(which gosu) | tee -a /tmp/obsidian.log
  
  log "Checking Docker platform settings:"
  env | grep -E "PLATFORM|ARCH|DOCKER" | tee -a /tmp/obsidian.log
  log "===== SYSTEM INSPECTION END ===== "
}

# Entry point
inspect_system
main "$@"
