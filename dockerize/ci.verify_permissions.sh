#!/bin/bash

#
# It should be in Sync with Dockerfile, docker-compose.yaml
#
PUID=1000
PGID=1000
#
# Dockerized Obsidian Vault and Configuration directories
#
DATA_DIR="./dockerize/obsidian/data"
CONFIG_DIR="./dockerize/obsidian/.config/obsidian"

warn_permission_fix() {
  echo
  echo "⚠️  Docker volume directory '$1' is not writable by your user (UID: $(id -u))."
  echo "   To fix, run:"
  echo "     sudo chown -R $PUID:$PGID '$1'"
  echo "     sudo chmod -R 777 '$1'"
  echo
}

warn_macos_permission_fix() {
  echo
  echo "⚠️  Docker volume directory '$1' is not writable by your user."
  echo "   To fix, run:"
  echo "     chmod -R 777 '$1'"
  echo
}

# Check write access and ownership for each directory
for dir in "$DATA_DIR" "$CONFIG_DIR"; do
  if [ ! -w "$dir" ]; then
    # On Linux, check if the directory is owned by UID 1000 (Docker default)
    if [ "$(uname -s)" = "Linux" ]; then
      owner_uid=$(stat -c "%u" "$dir")
      if [ "$owner_uid" != "$PUID" ]; then
        warn_permission_fix "$dir"
      fi
    else
      # On MacOS/Windows, just warn about write access
      warn_macos_permission_fix "$dir"
    fi
  else
    echo "[OK] Directory '$dir' is writable by your user."
  fi
done
