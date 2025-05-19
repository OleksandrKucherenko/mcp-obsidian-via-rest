# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# -------
# Builder
# -------

FROM base AS builder

# Copy package.json
COPY ./package.json ./tsconfig.json ./tsconfig.build.json ./config.secured.jsonc ./
COPY ./src ./src

# Install dependencies (compose bun.lock)
# force NPM registry for enterprise environments, where may set artifactory in a middle
RUN bun install --registry "https://registry.npmjs.org/"

# Build the application
RUN bun run build

# -------
# Release
# -------

FROM base AS release

# Copy files from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/config.secured.jsonc /app/tsconfig.json /app/tsconfig.build.json /app/package.json /app/bun.lock ./

ENV NODE_ENV=production

# install with --production (exclude devDependencies)
# force NPM registry for enterprise environments, where may set artifactory in a middle
RUN bun install --frozen-lockfile --production --registry "https://registry.npmjs.org/"

# environment variables for injecting via docker run command
# ENV API_KEY=secret
# ENV MCP_HOST=https://localhost
# ENV MCP_PORT=27124

USER bun
ENTRYPOINT ["bun", "run", "src/cli.ts"]
