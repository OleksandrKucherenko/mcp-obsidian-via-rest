# MCP Registry Publishing

This repository publishes MCP metadata to the official MCP Registry via CI/CD.
Manual `mcp-publisher` runs are discouraged; registry publishing happens after the
npm package is published.

## Requirements

- `server.json` is committed at the repo root.
- `package.json` includes `mcpName` that matches `server.json.name`.
- The server name uses GitHub namespace format: `io.github.<username>/<server>`.
  For this repo: `io.github.OleksandrKucherenko/mcp-obsidian-via-rest`.
- `server.json` is bundled into the npm package (see the `files` list in
  `package.json`).
- GitHub Actions has `id-token: write` permission for OIDC auth.
- `NPM_PUBLISH_TOKEN` secret is configured for npmjs publishing.

## CI/CD Flow

Workflow: `NPM (npmjs.com)` in `.github/workflows/npm-npmjs.yml`.

1) **prepare-and-dry-run**
   - Reads the version from the tag.
   - Updates `package.json` and `server.json` to the tag version.
   - Builds the package and runs `npm publish --dry-run`.
2) **publish-to-npmjs**
   - Publishes the package to npmjs.
   - Extracts the published tarball so `server.json` is present.
   - Runs `mcp-publisher login github-oidc` and `mcp-publisher publish`.

## Verification

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.OleksandrKucherenko/mcp-obsidian-via-rest"
```

## Troubleshooting

- **403 Forbidden**: The registry namespace must match the GitHub identity.
  If publishing under an org, ensure your membership is public.
- **Validation failed**: Ensure the npm package is published and the
  `mcpName`/`server.json.name` match.
