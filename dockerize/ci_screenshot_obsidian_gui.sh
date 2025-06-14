#!/bin/bash
# shellcheck disable=SC2155

set -e
# set -x # Print commands and their arguments as they are executed.

# --- Color Definitions ---
# Ensure proper display of ANSI colors
export TERM=xterm-256color

# Only including colors that we'll actually use
export cl_reset=$(tput sgr0)
export cl_green=$(tput setaf 2)
export cl_yellow=$(tput setaf 3)
export cl_purple=$(tput setaf 5)
export cl_gray=$(tput setaf 8)

# --- Configuration Defaults ---
SCR_DEFAULT_SCREENSHOT_COUNT=5
SCR_DEFAULT_MAX_RUNTIME_SECONDS=$((60 * 60)) # 1 hour
SCR_DEFAULT_KEEP_COUNT=5
SCR_DEFAULT_INTERVAL_SECONDS=10
SCR_DEFAULT_INITIAL_DELAY_SECONDS=15

SCR_CONTAINER_NAME=${SCR_CONTAINER_NAME:-"obsidian-vnc"}
DISPLAY_NUM=":99"
SCREENSHOT_FILE_CONTAINER="/tmp/obsidian_screenshot.png"
SCREENSHOT_DIR_HOST="reports/screenshots"

# --- Script Parameters (global, will be modified by arg parsing) ---
SCR_SCREENSHOT_COUNT=${SCR_SCREENSHOT_COUNT:-"${SCR_DEFAULT_SCREENSHOT_COUNT}"}
SCR_MAX_RUNTIME_SECONDS=${SCR_MAX_RUNTIME_SECONDS:-"${SCR_DEFAULT_MAX_RUNTIME_SECONDS}"}
SCR_KEEP_COUNT=${SCR_KEEP_COUNT:-"${SCR_DEFAULT_KEEP_COUNT}"}
SCR_INTERVAL_SECONDS=${SCR_INTERVAL_SECONDS:-"${SCR_DEFAULT_INTERVAL_SECONDS}"}
SCR_INITIAL_DELAY_SECONDS=${SCR_INITIAL_DELAY_SECONDS:-"${SCR_DEFAULT_INITIAL_DELAY_SECONDS}"}
SCR_INFINITE_MODE=${SCR_INFINITE_MODE:-false}

# --- Helper Functions ---
# Setup the pipes to preserve command exit status when using sed for coloring
setup_pipe_status() {
  set -o pipefail # Ensures exit status of a pipeline is the status of the last command to exit with non-zero status
}

# Call at the beginning of the script
setup_pipe_status

show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -n, --count ${cl_purple}<num>${cl_reset}       Number of screenshots to take (default: ${cl_purple}${SCR_DEFAULT_SCREENSHOT_COUNT}${cl_reset})."
  echo "                          Overrides infinite mode if set."
  echo "  -i, --infinite          Run in infinite mode (takes screenshots indefinitely until timeout or manual stop)."
  echo "  -t, --timeout ${cl_purple}<sec>${cl_reset}     Maximum script runtime in seconds (default: ${cl_purple}${SCR_DEFAULT_MAX_RUNTIME_SECONDS}${cl_reset}s)."
  echo "  -k, --keep ${cl_purple}<num>${cl_reset}        Number of latest screenshots to keep (cleanup on startup, default: ${cl_purple}${SCR_DEFAULT_KEEP_COUNT}${cl_reset})."
  echo "  -s, --interval ${cl_purple}<sec>${cl_reset}    Interval between screenshots in seconds (default: ${cl_purple}${SCR_DEFAULT_INTERVAL_SECONDS}${cl_reset}s)."
  echo "  -d, --delay ${cl_purple}<sec>${cl_reset}       Initial delay before starting screenshots (default: ${cl_purple}${SCR_DEFAULT_INITIAL_DELAY_SECONDS}${cl_reset}s)."
  echo "  -h, --help              Show this help message."
  exit 0
}

cleanup_screenshots() {
  local keep_count=$1
  local screenshot_dir=$2

  if [[ ! -d "${screenshot_dir}" ]]; then
    echo "${cl_gray}Screenshot directory '${cl_yellow}${screenshot_dir}${cl_gray}' does not exist. No cleanup needed.${cl_reset}"
    return
  fi

  echo "${cl_gray}Cleaning up screenshots in '${cl_yellow}${screenshot_dir}${cl_gray}', keeping the last ${cl_purple}${keep_count}${cl_gray}...${cl_reset}"
  local current_file_count
  current_file_count=$(find "${screenshot_dir}" -maxdepth 1 -type f -name 'obsidian_screen_*.png' -printf '.' | wc -c)

  if [[ "${current_file_count}" -le "${keep_count}" ]]; then
    echo "${cl_gray}Found ${cl_purple}${current_file_count}${cl_gray} screenshots, which is less than or equal to keep_count (${cl_purple}${keep_count}${cl_gray}). No files deleted.${cl_reset}"
    return
  fi

  # Use process substitution to capture and colorize rm output
  find "${screenshot_dir}" -maxdepth 1 -type f -name 'obsidian_screen_*.png' -print0 |
    sort -z -r |
    tail -z -n +$((keep_count + 1)) |
    xargs -0 --no-run-if-empty -I{} bash -c "rm -v {} | sed 's/^/${cl_gray}/; s/$/${cl_reset}/'"
  echo "${cl_gray}Cleanup finished.${cl_reset}"
}

# --- Main Function ---
main() {
  # --- Main Script Logic ---
  START_TIME=$(date +%s)

  # Create screenshot directory if it doesn't exist (relative to script location)
  mkdir -p "${SCREENSHOT_DIR_HOST}"

  # Perform cleanup before starting
  cleanup_screenshots "${SCR_KEEP_COUNT}" "${SCREENSHOT_DIR_HOST}"

  # Check if container is running
  if ! docker ps --filter "name=${SCR_CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}" | grep -q "^${SCR_CONTAINER_NAME}$"; then
    echo "Error: Container '${cl_yellow}${SCR_CONTAINER_NAME}${cl_reset}' is not running."
    echo "Please start it with: docker compose up -d obsidian"
    exit 1
  fi

  echo "Waiting for Obsidian to initialize (${cl_purple}${SCR_INITIAL_DELAY_SECONDS}${cl_reset} seconds)..."
  sleep "${SCR_INITIAL_DELAY_SECONDS}"

  if [ "${SCR_INFINITE_MODE}" = true ]; then
    echo "Starting infinite screenshot mode (every ${cl_purple}${SCR_INTERVAL_SECONDS}${cl_reset} seconds, timeout ${cl_purple}${SCR_MAX_RUNTIME_SECONDS}${cl_reset}s)..."
  else
    echo "Starting screenshot mode: ${cl_purple}${SCR_SCREENSHOT_COUNT}${cl_reset} screenshots every ${cl_purple}${SCR_INTERVAL_SECONDS}${cl_reset} seconds (timeout ${cl_purple}${SCR_MAX_RUNTIME_SECONDS}${cl_reset} seconds)..."
  fi
  echo ""

  TAKEN_SCREENSHOTS=0

  while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))

    if [ "${ELAPSED_TIME}" -ge "${SCR_MAX_RUNTIME_SECONDS}" ]; then
      echo "Maximum runtime of ${cl_purple}${SCR_MAX_RUNTIME_SECONDS}${cl_reset} seconds reached. Exiting."
      break
    fi

    if [ "${SCR_INFINITE_MODE}" = false ] && [ "${TAKEN_SCREENSHOTS}" -ge "${SCR_SCREENSHOT_COUNT}" ]; then
      echo "Target screenshot count of ${cl_purple}${SCR_SCREENSHOT_COUNT}${cl_reset} reached. Exiting."
      break
    fi

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    CURRENT_SCREENSHOT_FILE_HOST="${SCREENSHOT_DIR_HOST}/obsidian_screen_${TIMESTAMP}.png"

    echo "Taking screenshot ${cl_purple}#${TAKEN_SCREENSHOTS}${cl_reset} (${cl_green}${TIMESTAMP}${cl_reset})..."
    # Run scrot inside the container
    docker exec -u appuser -e DISPLAY=${DISPLAY_NUM} "${SCR_CONTAINER_NAME}" scrot -o "${SCREENSHOT_FILE_CONTAINER}"

    echo "Copying screenshot to ${cl_yellow}${CURRENT_SCREENSHOT_FILE_HOST}${cl_reset}"
    # Capture the docker cp output and colorize the path
    docker cp "${SCR_CONTAINER_NAME}:${SCREENSHOT_FILE_CONTAINER}" "${CURRENT_SCREENSHOT_FILE_HOST}" | sed "s|\(Successfully copied [0-9]*[kKmMgG]\?B to \)\(.*\)|\1${cl_yellow}\2${cl_reset}|"

    echo "Screenshot saved to ${cl_yellow}${CURRENT_SCREENSHOT_FILE_HOST}${cl_reset}"
    cleanup_screenshots "${SCR_KEEP_COUNT}" "${SCREENSHOT_DIR_HOST}"
    TAKEN_SCREENSHOTS=$((TAKEN_SCREENSHOTS + 1))

    if [ "${SCR_INFINITE_MODE}" = true ] || [ "${TAKEN_SCREENSHOTS}" -lt "${SCR_SCREENSHOT_COUNT}" ]; then
      if [ "${ELAPSED_TIME}" -lt "${SCR_MAX_RUNTIME_SECONDS}" ]; then # Avoid sleep if timeout is very near
        echo "Waiting ${cl_purple}${SCR_INTERVAL_SECONDS}${cl_reset} seconds..." && echo ""
        sleep "${SCR_INTERVAL_SECONDS}"
      fi
    fi
  done

  echo "Test script finished. Total screenshots taken: ${cl_purple}${TAKEN_SCREENSHOTS}${cl_reset}."
}

# --- Argument Parsing ---
# This uses getopt, which is part of util-linux. Ensure it's available.
# The parsed arguments will set the global variables defined under "Script Parameters".
TEMP=$(getopt -o n:it:k:s:d:h --long count:,infinite,timeout:,keep:,interval:,delay:,help -n "$0" -- "$@")
# shellcheck disable=SC2181 # More specific error message is provided by getopt itself
if [ $? != 0 ]; then
  echo "Terminating... See getopt error above." >&2
  exit 1
fi
# Note the quotes around "$TEMP": they are essential!
eval set -- "$TEMP"

while true; do
  case "$1" in
  -n | --count)
    SCR_SCREENSHOT_COUNT="$2"
    SCR_INFINITE_MODE=false # Explicit count overrides infinite
    shift 2
    ;;
  -i | --infinite)
    SCR_INFINITE_MODE=true
    shift
    ;;
  -t | --timeout)
    SCR_MAX_RUNTIME_SECONDS="$2"
    shift 2
    ;;
  -k | --keep)
    SCR_KEEP_COUNT="$2"
    shift 2
    ;;
  -s | --interval)
    SCR_INTERVAL_SECONDS="$2"
    shift 2
    ;;
  -d | --delay)
    SCR_INITIAL_DELAY_SECONDS="$2"
    shift 2
    ;;
  -h | --help)
    show_help
    ;;
  --)
    shift
    break
    ;;
  *)
    echo "Internal error! Unexpected option: $1" >&2
    exit 1
    ;;
  esac
done

# --- Script Execution ---
main
