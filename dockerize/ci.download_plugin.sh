#!/bin/bash
# shellcheck disable=SC2155

# This script dynamically downloads the latest release ZIP of the
# obsidian-local-rest-api plugin from GitHub API, unpacks it, and installs it
# into the target Obsidian vault's plugin folder.
#
# Requires: curl, jq, unzip

set -e # Exit immediately if a command exits with a non-zero status.
# set -x # Print commands and their arguments as they are executed.

# colors
export cl_reset=$(tput sgr0)
export cl_purple=$(tput setaf 5)
export cl_yellow=$(tput setaf 3)
export cl_green=$(tput setaf 2)
export cl_gray=$(tput setaf 8) # User requested gray, tput setaf 8 is often gray/dark grey

# Determine the script's directory and project root to make paths more robust
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &>/dev/null && pwd)"

# --- Configuration ---
REPO_OWNER="coddingtonbear"
REPO_NAME="obsidian-local-rest-api"
PLUGIN_ID="obsidian-local-rest-api" # This is also the directory name for the plugin files.
PLUGINS_BASE_DIR="${PROJECT_ROOT}/dockerize/obsidian/data/vault-tests/.obsidian/plugins"
PLUGIN_INSTALL_DIR="${PLUGINS_BASE_DIR}/${PLUGIN_ID}" # Target directory for the plugin files.

# --- Script Logic ---

# 1. Check for dependencies
if ! command -v jq &>/dev/null; then
    echo "Error: jq is not installed. Please install jq to run this script."
    exit 1
fi
if ! command -v curl &>/dev/null; then
    echo "Error: curl is not installed. Please install curl to run this script."
    exit 1
fi
if ! command -v unzip &>/dev/null; then
    echo "Error: unzip is not installed. Please install unzip to run this script."
    exit 1
fi

echo "Starting dynamic download and installation of latest Obsidian Local REST API plugin..."

# 2. Get latest release information from GitHub API
LATEST_RELEASE_API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
echo "Fetching latest release data from ${cl_yellow}${LATEST_RELEASE_API_URL}${cl_reset}..."
RELEASE_DATA=$(curl --silent --location "${LATEST_RELEASE_API_URL}")

if [ -z "${RELEASE_DATA}" ] || echo "${RELEASE_DATA}" | jq -e '.message == "Not Found"' >/dev/null; then
    echo "Error: Could not fetch latest release data from GitHub API. Response:"
    echo "${RELEASE_DATA}"
    exit 1
fi

LATEST_TAG=$(echo "${RELEASE_DATA}" | jq -r '.tag_name')
ASSETS_URL=$(echo "${RELEASE_DATA}" | jq -r '.assets_url')

if [ "${LATEST_TAG}" == "null" ] || [ -z "${LATEST_TAG}" ] || [ "${ASSETS_URL}" == "null" ] || [ -z "${ASSETS_URL}" ]; then
    echo "Error: Could not parse latest tag or assets URL from GitHub API response:"
    echo "${RELEASE_DATA}"
    exit 1
fi
echo "Latest release tag identified: ${cl_purple}${LATEST_TAG}${cl_reset}"
echo "Assets URL: ${cl_yellow}${ASSETS_URL}${cl_reset}"

# 3. Get assets for the latest release
echo "Fetching assets data from ${cl_yellow}${ASSETS_URL}${cl_reset}..."
ASSETS_DATA=$(curl --silent --location "${ASSETS_URL}")
if [ -z "${ASSETS_DATA}" ]; then
    echo "Error: Could not fetch assets data from GitHub API for tag ${cl_purple}${LATEST_TAG}${cl_reset}. Response:"
    echo "${ASSETS_DATA}"
    exit 1
fi

# 4. Find the ZIP asset download URL
# Try to find a ZIP matching plugin_id-version.zip, then plugin_id-*.zip, then plugin.zip
LATEST_TAG_NUMERIC=$(echo "${LATEST_TAG}" | sed 's/^v//') # Remove leading 'v' if present

ZIP_DOWNLOAD_URL=''
# Attempt 1: Exact match (e.g., obsidian-local-rest-api-3.2.0.zip)
ZIP_PATTERN_EXACT="${PLUGIN_ID}-${LATEST_TAG_NUMERIC}.zip"
ZIP_DOWNLOAD_URL=$(echo "${ASSETS_DATA}" | jq -r --arg name "${ZIP_PATTERN_EXACT}" '.[] | select(.name == $name) | .browser_download_url')

# Attempt 2: Generic version match (e.g., obsidian-local-rest-api-*.zip)
if [ -z "${ZIP_DOWNLOAD_URL}" ]; then
    ZIP_PATTERN_GENERIC="${PLUGIN_ID}-.*\\.zip"
    # Select the one that most closely matches the version, or the first one if multiple generic matches
    ZIP_DOWNLOAD_URL=$(echo "${ASSETS_DATA}" | jq -r --arg pattern "${ZIP_PATTERN_GENERIC}" '.[] | select(.name | test($pattern)) | .browser_download_url' | head -n 1)
fi

# Attempt 3: Simple plugin.zip (common fallback)
if [ -z "${ZIP_DOWNLOAD_URL}" ]; then
    ZIP_DOWNLOAD_URL=$(echo "${ASSETS_DATA}" | jq -r '.[] | select(.name == "plugin.zip") | .browser_download_url')
fi

# Attempt 4: obsidian-local-rest-api.zip (another common fallback)
if [ -z "${ZIP_DOWNLOAD_URL}" ]; then
    ZIP_DOWNLOAD_URL=$(echo "${ASSETS_DATA}" | jq -r --arg name "${PLUGIN_ID}.zip" '.[] | select(.name == $name) | .browser_download_url')
fi

if [ -z "${ZIP_DOWNLOAD_URL}" ]; then
    echo "Error: Could not find a suitable ZIP asset for release ${cl_purple}${LATEST_TAG}${cl_reset}."
    echo "Looked for patterns like '${cl_green}${ZIP_PATTERN_EXACT}${cl_reset}', '${cl_green}${PLUGIN_ID}-*.zip${cl_reset}', '${cl_green}plugin.zip${cl_reset}', '${cl_green}${PLUGIN_ID}.zip${cl_reset}'."
    echo "Available assets:"
    echo "${ASSETS_DATA}" | jq -r '.[] | .name'
    exit 1
fi

ZIP_FILENAME=$(basename "${ZIP_DOWNLOAD_URL}")
echo "Found ZIP asset: ${cl_green}${ZIP_FILENAME}${cl_reset}"
echo "Download URL: ${cl_yellow}${ZIP_DOWNLOAD_URL}${cl_reset}"

# 5. Prepare plugin installation directory
echo "Preparing plugin installation directory: ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}"
if [ -d "${PLUGIN_INSTALL_DIR}" ]; then
    echo "Cleaning existing plugin files in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}..."
    rm -rf "${PLUGIN_INSTALL_DIR:?}"/*
fi
mkdir -p "${PLUGIN_INSTALL_DIR}"

# 6. Download and unpack the ZIP
TEMP_DIR=$(mktemp -d -t obsidian_plugin_download_XXXXXX)
echo "Downloading ${cl_green}${ZIP_FILENAME}${cl_reset} to ${cl_gray}${TEMP_DIR}${cl_reset}..."
curl -L --fail --silent --show-error -o "${TEMP_DIR}/${ZIP_FILENAME}" "${ZIP_DOWNLOAD_URL}" || {
    echo "Error: Failed to download ${cl_green}${ZIP_FILENAME}${cl_reset} from ${cl_yellow}${ZIP_DOWNLOAD_URL}${cl_reset}."
    rm -rf "${TEMP_DIR}"
    exit 1
}
echo "${cl_green}${ZIP_FILENAME}${cl_reset} downloaded."

echo "Unpacking ${cl_green}${ZIP_FILENAME}${cl_reset} to ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}..."
unzip -q -o "${TEMP_DIR}/${ZIP_FILENAME}" -d "${PLUGIN_INSTALL_DIR}" || {
    echo "Error: Failed to unpack ${cl_green}${ZIP_FILENAME}${cl_reset}."
    # Attempt to list contents of zip for debugging before deleting
    echo "Attempting to list contents of downloaded ZIP:"
    unzip -l "${TEMP_DIR}/${ZIP_FILENAME}" || echo "Could not list ZIP contents."
    rm -rf "${TEMP_DIR}"
    exit 1
}
echo "Plugin unpacked."
rm -rf "${TEMP_DIR}" # Clean up temp directory

# 6a. Handle potential nested directory in ZIP
if [ ! -f "${PLUGIN_INSTALL_DIR}/manifest.json" ]; then
    echo "manifest.json not found directly in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}. Checking for a nested directory..."
    # Count items (files and directories) in PLUGIN_INSTALL_DIR
    ITEM_COUNT=$(find "${PLUGIN_INSTALL_DIR}" -mindepth 1 -maxdepth 1 -printf x | wc -c)
    if [ "${ITEM_COUNT}" -eq 1 ]; then
        # Get the name of the single item
        NESTED_ITEM_PATH=$(find "${PLUGIN_INSTALL_DIR}" -mindepth 1 -maxdepth 1)
        if [ -d "${NESTED_ITEM_PATH}" ]; then
            echo "Found single nested directory: ${cl_yellow}${NESTED_ITEM_PATH}${cl_reset}. Moving contents up."
            # Use shopt to handle dotfiles correctly with mv *
            shopt -s dotglob
            mv "${NESTED_ITEM_PATH}"/* "${PLUGIN_INSTALL_DIR}/"
            shopt -u dotglob
            # Remove the now-empty nested directory
            rmdir "${NESTED_ITEM_PATH}" || echo "Warning: Could not remove nested directory ${cl_yellow}${NESTED_ITEM_PATH}${cl_reset} after moving contents. It might not have been empty or an error occurred."
            echo "Contents moved from nested directory."
        else
            echo "The single item found (${NESTED_ITEM_PATH}) is not a directory. Cannot auto-correct nested structure."
        fi
    elif [ "${ITEM_COUNT}" -gt 1 ]; then
        echo "Multiple items found in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} and manifest.json is missing from root. Cannot determine correct plugin structure."
    else # ITEM_COUNT is 0
        echo "No items found in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} after unpack, and manifest.json is missing."
    fi
fi

# 7. Verify essential plugin files (manifest.json, main.js)
echo "Verifying essential plugin files (manifest.json, main.js) in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}..."
if [ ! -f "${PLUGIN_INSTALL_DIR}/manifest.json" ]; then
    echo "Error: manifest.json not found in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} after unpacking."
    exit 1
fi
if [ ! -s "${PLUGIN_INSTALL_DIR}/manifest.json" ]; then # Check if file is not empty
    echo "Error: manifest.json is empty in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} after unpacking."
    exit 1
fi

if [ ! -f "${PLUGIN_INSTALL_DIR}/main.js" ]; then
    echo "Error: main.js not found in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} after unpacking."
    exit 1
fi
if [ ! -s "${PLUGIN_INSTALL_DIR}/main.js" ]; then # Check if file is not empty
    echo "Error: main.js is empty in ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset} after unpacking."
    exit 1
fi

# Check for styles.css, create if not present (as it's often optional)
if [ ! -f "${PLUGIN_INSTALL_DIR}/styles.css" ]; then
    echo "Warning: styles.css not found after unpacking. Creating an empty styles.css file."
    touch "${PLUGIN_INSTALL_DIR}/styles.css"
fi
echo "Essential files verified."

# 8. Set permissions (good practice for consistency)
echo "Setting permissions on plugin directory: ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}"
chmod -R 755 "${PLUGIN_INSTALL_DIR}"
echo "Permissions set."

echo "---------------------------------------------------------------------"
echo "Obsidian Local REST API plugin (latest version: ${cl_purple}${LATEST_TAG}${cl_reset}) installation completed successfully!"
echo "Plugin installed to: ${cl_yellow}${PLUGIN_INSTALL_DIR}${cl_reset}"
echo "---------------------------------------------------------------------"
echo "Done!"
