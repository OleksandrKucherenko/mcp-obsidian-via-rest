#!/usr/bin/env bash

# Delete GitHub workflow runs in bulk
# Usage: ./scripts/delete-workflow-runs.sh <workflow_run_id> [<workflow_run_id> ...]

set -euo pipefail

if [ $# -eq 0 ]; then
	echo "Usage: $0 <workflow_run_id> [<workflow_run_id> ...]"
	echo "  Example: $0 20935437495 20935437458 20935437444"
	exit 1
fi

echo "🗑️ Deleting $# workflow run(s)..."

# Delete each workflow run
for run_id in "$@"; do
	echo "Deleting run: $run_id"

	# Use GitHub CLI to delete the run
	if command -v gh &>/dev/null; then
		gh api repos/$(gh repo view --json owner,name | jq -r '"\(.owner.login)/\(.name)"')/actions/runs/$run_id -X DELETE
	else
		echo "Error: gh CLI not found. Please install it first."
		echo "  https://cli.github.com/"
		exit 1
	fi

	if [ $? -eq 0 ]; then
		echo "✓ Deleted run: $run_id"
	else
		echo "✗ Failed to delete run: $run_id"
	fi
done

echo "✨ Cleanup complete"
