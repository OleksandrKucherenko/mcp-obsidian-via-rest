# use the official Bun image: https://bun.sh/guides/ecosystem/docker
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2-alpine AS base
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
#RUN bun install --frozen-lockfile --production --registry "https://registry.npmjs.org/"
RUN bun install --frozen-lockfile --production

# environment variables for injecting via docker run command
# ENV API_KEY=secret
# ENV API_HOST=https://localhost
# ENV API_PORT=27124

USER bun
ENTRYPOINT ["bun", "run", "dist/index.js"]
