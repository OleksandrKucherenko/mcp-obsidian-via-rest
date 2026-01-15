#!/usr/bin/env bash
set -euo pipefail

# Build static website with version injection
# Usage: ./scripts/build-website.sh [version]

VERSION="${1:-}"
BUILD_DIR="docs"
BUILD_FAILED=false

# Get version from package.json if not provided
if [ -z "$VERSION" ]; then
	if command -v node &>/dev/null; then
		VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
	else
		VERSION="unknown"
	fi
fi

# Get commit hash for reference
COMMIT_HASH="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

echo "Building static website..."
echo "Version: $VERSION"
echo "Commit: $COMMIT_HASH"
echo "Build date: $BUILD_DATE"

# Check build directory exists
if [ ! -d "$BUILD_DIR" ]; then
	echo "Error: $BUILD_DIR directory does not exist"
	exit 1
fi

# Create backup for safe modification (restore only on error)
BACKUP_DIR="$BUILD_DIR.backup-$(date +%s)"
cleanup() {
	if [ "$BUILD_FAILED" = true ]; then
		echo "Build failed, restoring backup from $BACKUP_DIR..."
		rm -rf "$BUILD_DIR"
		mv "$BACKUP_DIR" "$BUILD_DIR"
	else
		echo "Build successful, removing backup..."
		rm -rf "$BACKUP_DIR"
	fi
}
trap cleanup EXIT
cp -r "$BUILD_DIR" "$BACKUP_DIR"

# Set BUILD_FAILED on any command error
error_handler() {
	BUILD_FAILED=true
}
trap 'error_handler' ERR

# Create version.json
cat >"$BUILD_DIR/version.json" <<EOF
{
  "version": "$VERSION",
  "commit": "$COMMIT_HASH",
  "builtAt": "$BUILD_DATE"
}
EOF

# Create screenshots.json with list of screenshot folders
cat >"$BUILD_DIR/screenshots.json" <<'EOF'
{
  "screenshots": [],
  "lastUpdated": ""
}
EOF

# Find all screenshot folders (numeric directory names)
find "$BUILD_DIR" -maxdepth 1 -type d -regex ".*/[0-9]+" | sort -r | head -20 | while read -r folder; do
	folder_name=$(basename "$folder")
	if [ -f "$folder/index.html" ]; then
		# Get modification time
		modified=$(stat -c "%Y" "$folder/index.html" 2>/dev/null || stat -f "%m" "$folder/index.html" 2>/dev/null || echo "0")
		modified_iso=$(date -u -d "@$modified" -Iseconds 2>/dev/null || date -u -r "$folder/index.html" -Iseconds 2>/dev/null || date -u -Iseconds)

		# Update screenshots.json using jq if available, otherwise append manually
		if command -v jq &>/dev/null; then
			jq --arg id "$folder_name" --arg modified "$modified_iso" \
				'.screenshots += [{"id": $id, "modified": $modified}] | .lastUpdated = now | tostring' \
				"$BUILD_DIR/screenshots.json" | jq -r '.' >"$BUILD_DIR/screenshots.json.tmp"
			mv "$BUILD_DIR/screenshots.json.tmp" "$BUILD_DIR/screenshots.json"
		fi
	fi
done

# If jq is not available, create a simple JSON with recent builds
if ! command -v jq &>/dev/null; then
	recent_builds=$(find "$BUILD_DIR" -maxdepth 1 -type d -regex ".*/[0-9]+" -exec stat -c "%Y %n" {} + 2>/dev/null | sort -rn | head -20 | awk '{print $2}' | xargs -I {} basename {} | paste -sd,)
	cat >"$BUILD_DIR/screenshots.json" <<JSONEOF
{
  "screenshots": [$recent_builds]
}
JSONEOF
fi

# Inject version into index.html footer if it exists
if [ -f "$BUILD_DIR/index.html" ]; then
	# Add version info before closing </footer> tag
	sed -i.bak "/<\/footer>/i\\        <p class=\"version-info\">Version: $VERSION | Commit: $COMMIT_HASH</p>" "$BUILD_DIR/index.html" || true
	rm -f "$BUILD_DIR/index.html.bak"
fi

# Inject version into screenshot gallery pages if they exist
if find "$BUILD_DIR" -type d -regex ".*\/[0-9]+" | head -1 | grep -q .; then
	find "$BUILD_DIR" -name "index.html" -path "*/[0-9]*/index.html" -type f 2>/dev/null | while read -r file; do
		# Add version info to screenshot gallery pages
		sed -i.bak "/<\/footer>/i\\        <p class=\"version-info\">Version: $VERSION | Commit: $COMMIT_HASH</p>" "$file" || true
		rm -f "${file}.bak" 2>/dev/null || true
	done
fi

echo "Website built successfully in $BUILD_DIR"
