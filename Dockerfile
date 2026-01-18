# use the official Bun image: https://bun.sh/guides/ecosystem/docker
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2-alpine AS base

# Add tini for proper signal handling (crucial for STDIO communication)
# Add wget for health check
RUN apk add --no-cache tini wget

WORKDIR /app

# -------
# Builder
# -------

FROM base AS builder

# Copy package.json
COPY ./package.json ./tsconfig.json ./
COPY ./configs ./configs
COPY ./src ./src

# Install dependencies (compose bun.lock)
# force NPM registry for enterprise environments, where may set artifactory in a middle
#RUN bun install --registry "https://registry.npmjs.org/"
RUN bun install

# Build the application
RUN bun run build

# -------
# Release
# -------

FROM base AS release

# MCP Registry required label
LABEL io.modelcontextprotocol.server.name="io.github.OleksandrKucherenko/mcp-obsidian-via-rest"

# Copy files from builder stage
#COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json /app/package.json /app/bun.lock ./
COPY --from=builder /app/configs ./configs

ENV NODE_ENV=production

# Exclude husky from production, by removing scripts prepare
RUN sed -i 's/"husky || true"/"exit 0"/g' package.json && grep exit package.json

# install with --production (exclude devDependencies)
# force NPM registry for enterprise environments, where may set artifactory in a middle
# skip lifecycle scripts since dist already built in builder stage
#RUN bun install --frozen-lockfile --production --registry "https://registry.npmjs.org/"
RUN bun install --frozen-lockfile --production --ignore-scripts --verbose --registry "https://registry.npmjs.org/"

# environment variables for injecting via docker run command
# ENV API_KEY=secret
# ENV API_HOST=https://localhost
# ENV API_PORT=27124
ENV TINI_SUBREAPER=true

# Expose HTTP transport port (default: 3000)
EXPOSE 3000

# Health check using HTTP endpoint
# Note: HTTP transport must be enabled for health checks to work
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Create a non-root user to run the application
USER bun

# Use tini for proper process management and signal handling
# This is critical for MCP protocol over STDIO to work correctly
# The ENTRYPOINT ensures tini runs as PID 1
ENTRYPOINT ["/sbin/tini", "-s", "--"]

# Explicitly use exec form so signals are properly passed to the Node.js process
CMD ["bun", "run", "dist/index.js"]
