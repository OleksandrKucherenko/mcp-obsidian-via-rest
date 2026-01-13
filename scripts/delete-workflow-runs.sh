#!/usr/bin/env bash

# Delete GitHub workflow runs in bulk
# Usage: ./scripts/delete-workflow-runs.sh <workflow_run_id> [<workflow_run_id> ...]
# Or pipe IDs: echo "id1 id2 id3" | ./scripts/delete-workflow-runs.sh

set -euo pipefail

if [ $# -eq 0 ]; then
	echo "Reading workflow run IDs from stdin..."
	run_ids=$(cat)
else
	run_ids=("$@")
fi

echo "🗑️ Deleting ${#run_ids[@]} workflow run(s)..."

# Delete each workflow run
count=0
for run_id in "${run_ids[@]}"; do
	count=$((count + 1))
	echo "Deleting run $count: $run_id"

	# Use GitHub CLI to delete run
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

echo "✨ Cleanup complete - deleted $count workflow run(s)"
