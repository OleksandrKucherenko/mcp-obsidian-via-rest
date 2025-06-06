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

start_obsidian() {
  log "Running Obsidian with vault path: ${VAULT_PATH}"
  gosu "${USERNAME}" "$@" "${VAULT_PATH}" &>/tmp/obsidian.log &
  MAIN_APP_PID=$!

  log "Obsidian log file: /tmp/obsidian.log"

  # Wait for Obsidian to start before manipulating its window
  sleep 5
}

position_window() {
  log "Positioning Obsidian window..."
  xdotool search --class "obsidian" windowactivate windowmove 0 0 windowsize 1200 900 ||
    log "Failed to position Obsidian window with xdotool"
}

cleanup() {
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

  # Wait for application to exit
  set +e
  wait $MAIN_APP_PID
  MAIN_APP_STATUS=$?
  set -e

  # Exit with the same status as the main application
  exit $MAIN_APP_STATUS
}

# Set up signal handlers for graceful shutdown
trap 'cleanup' SIGTERM SIGINT SIGQUIT EXIT

# Entry point
main "$@"
