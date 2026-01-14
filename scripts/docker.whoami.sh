#!/usr/bin/env bash

# Enhanced version with credential helper support
docker-whoami() {
    local config_file="$HOME/.docker/config.json"
    local registry="${1:-https://index.docker.io/v1/}"
    
    if [ ! -f "$config_file" ]; then
        echo "❌ Not authenticated - no config file found"
        return 1
    fi
    
    # Check if using credential helper
    local creds_store=$(jq -r '.credsStore // empty' "$config_file")
    if [ -n "$creds_store" ]; then
        echo "ℹ️  Using credential helper: $creds_store"
        echo "Run: echo '$registry' | docker-credential-$creds_store get | jq -r .Username"
        return 0
    fi
    
    # Parse direct auth
    local username=$(jq -r ".auths[\"$registry\"].auth // empty" "$config_file" | base64 -d 2>/dev/null | cut -d: -f1)
    
    if [ -n "$username" ]; then
        echo "✅ Authenticated as: $username"
    else
        echo "❌ Not authenticated to $registry"
        return 1
    fi
}

docker-whoami "$@"