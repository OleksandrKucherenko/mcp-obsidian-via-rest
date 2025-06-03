#!/bin/bash
set -e

# --- Configuration Defaults ---
SCR_DEFAULT_SCREENSHOT_COUNT=5
SCR_DEFAULT_MAX_RUNTIME_SECONDS=$((60 * 60)) # 1 hour
SCR_DEFAULT_KEEP_COUNT=5
SCR_DEFAULT_INTERVAL_SECONDS=10
SCR_DEFAULT_INITIAL_DELAY_SECONDS=15

CONTAINER_NAME="obsidian-vnc"
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
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -n, --count <num>       Number of screenshots to take (default: ${SCR_DEFAULT_SCREENSHOT_COUNT})."
  echo "                          Overrides infinite mode if set."
  echo "  -i, --infinite          Run in infinite mode (takes screenshots indefinitely until timeout or manual stop)."
  echo "  -t, --timeout <sec>     Maximum script runtime in seconds (default: ${SCR_DEFAULT_MAX_RUNTIME_SECONDS}s)."
  echo "  -k, --keep <num>        Number of latest screenshots to keep (cleanup on startup, default: ${SCR_DEFAULT_KEEP_COUNT})."
  echo "  -s, --interval <sec>    Interval between screenshots in seconds (default: ${SCR_DEFAULT_INTERVAL_SECONDS}s)."
  echo "  -d, --delay <sec>       Initial delay before starting screenshots (default: ${SCR_DEFAULT_INITIAL_DELAY_SECONDS}s)."
  echo "  -h, --help              Show this help message."
  exit 0
}

cleanup_screenshots() {
  local keep_count=$1
  local screenshot_dir=$2

  if [[ ! -d "${screenshot_dir}" ]]; then
    echo "Screenshot directory '${screenshot_dir}' does not exist. No cleanup needed."
    return
  fi

  echo "Cleaning up screenshots in '${screenshot_dir}', keeping the last ${keep_count}..."
  local current_file_count
  current_file_count=$(find "${screenshot_dir}" -maxdepth 1 -type f -name 'obsidian_screen_*.png' -printf '.' | wc -c)

  if [[ "${current_file_count}" -le "${keep_count}" ]]; then
    echo "Found ${current_file_count} screenshots, which is less than or equal to keep_count (${keep_count}). No files deleted."
    return
  fi

  find "${screenshot_dir}" -maxdepth 1 -type f -name 'obsidian_screen_*.png' -print0 |
    sort -z -r |
    tail -z -n +$((keep_count + 1)) |
    xargs -0 --no-run-if-empty rm -v
  echo "Cleanup finished."
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
  if ! docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container '${CONTAINER_NAME}' is not running."
    echo "Please start it with: docker compose up -d obsidian"
    exit 1
  fi

  echo "Waiting for Obsidian to initialize (${SCR_INITIAL_DELAY_SECONDS} seconds)..."
  sleep "${SCR_INITIAL_DELAY_SECONDS}"

  if [ "${SCR_INFINITE_MODE}" = true ]; then
    echo "Starting infinite screenshot mode (every ${SCR_INTERVAL_SECONDS} seconds, timeout ${SCR_MAX_RUNTIME_SECONDS}s)..."
  else
    echo "Starting screenshot mode: ${SCR_SCREENSHOT_COUNT} screenshots every ${SCR_INTERVAL_SECONDS} seconds (timeout ${SCR_MAX_RUNTIME_SECONDS}s)..."
  fi

  TAKEN_SCREENSHOTS=0

  while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))

    if [ "${ELAPSED_TIME}" -ge "${SCR_MAX_RUNTIME_SECONDS}" ]; then
      echo "Maximum runtime of ${SCR_MAX_RUNTIME_SECONDS} seconds reached. Exiting."
      break
    fi

    if [ "${SCR_INFINITE_MODE}" = false ] && [ "${TAKEN_SCREENSHOTS}" -ge "${SCR_SCREENSHOT_COUNT}" ]; then
      echo "Target screenshot count of ${SCR_SCREENSHOT_COUNT} reached. Exiting."
      break
    fi

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    CURRENT_SCREENSHOT_FILE_HOST="${SCREENSHOT_DIR_HOST}/obsidian_screen_${TIMESTAMP}.png"

    echo "Taking screenshot #${TAKEN_SCREENSHOTS} (${TIMESTAMP})..."
    # Run scrot inside the container
    docker exec -u appuser -e DISPLAY=${DISPLAY_NUM} "${CONTAINER_NAME}" scrot -o "${SCREENSHOT_FILE_CONTAINER}"

    echo "Copying screenshot to ${CURRENT_SCREENSHOT_FILE_HOST}"
    docker cp "${CONTAINER_NAME}:${SCREENSHOT_FILE_CONTAINER}" "${CURRENT_SCREENSHOT_FILE_HOST}"

    echo "Screenshot saved to ${CURRENT_SCREENSHOT_FILE_HOST}"
    cleanup_screenshots "${SCR_KEEP_COUNT}" "${SCREENSHOT_DIR_HOST}"
    TAKEN_SCREENSHOTS=$((TAKEN_SCREENSHOTS + 1))

    if [ "${SCR_INFINITE_MODE}" = true ] || [ "${TAKEN_SCREENSHOTS}" -lt "${SCR_SCREENSHOT_COUNT}" ]; then
      if [ "${ELAPSED_TIME}" -lt "${SCR_MAX_RUNTIME_SECONDS}" ]; then # Avoid sleep if timeout is very near
        echo "Waiting ${SCR_INTERVAL_SECONDS} seconds..."
        sleep "${SCR_INTERVAL_SECONDS}"
      fi
    fi
  done

  echo "Test script finished. Total screenshots taken: ${TAKEN_SCREENSHOTS}."
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
