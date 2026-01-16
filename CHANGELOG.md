# Changelog

# [0.6.0-beta.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.5.1...v0.6.0-beta.0) (2026-01-16)


### Bug Fixes

* **ci:** push release branch before running release-it ([301f4ca](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/301f4ca7ce630e64bf8485367c53dc3f30b83ba1))
* correct jq command for health check parsing ([82fb980](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/82fb980d4f2c350280a4c1bd651ca05bac2e16ca))
* fail fast when docker compose build fails ([6c960a1](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/6c960a1c821d37e92bd629673fd3983fad3fdbba))
* **github-npm:** add version pre-check and fix deprecated inputs ([965ca0c](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/965ca0c2457b817646467ee735a7faa5e8f77122))
* **knip:** update entry points and ignore rules ([9b82c6d](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/9b82c6d50fdf8a2dd7713af4b60138ec719018ff))
* **release:** disable npm plugin in release-it readonly config ([#23](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/23)) ([d16b946](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d16b9461c626be1c543748ddf215b4d977cdc2ed))
* **release:** version compute logic fixed ([8cd33e9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/8cd33e984854cf2c2ac27eb4813b801a3a7024f8))
* remove duplicate user creation in Dockerfile ([3641ba3](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/3641ba34eaa9604dec58b12df36060782a526895))
* remove incompatible docker compose cache flags ([f798cea](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/f798cea9820c1195dab6eb76f8dd9ffc817ff740))
* remove invalid bun cache flag and adjust preview links for PRs ([4b14bb4](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/4b14bb43d0df65c3e0d414e7cd960f31cd696343))
* run docker compose in detached mode and add health wait ([4ebad4c](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/4ebad4cf2102d02424e09d0354c9e9389ef120f7))
* **test:** print message about containers setup ([2a1143b](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/2a1143b330a4909dddf3d05a54ce2a09dd191b89))
* workflow improvements and gh-pages cleanup ([e9aa003](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/e9aa003d6a90b8a6794bc06c4495852aaa3cfd8e)), closes [#pages](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/pages) [#pages](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/pages)


### Features

* add minimal Docker Hub publishing workflow (disabled) ([aef30f2](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/aef30f2c597a4480ce411529e2f1dcbe6fce9ee1))
* add screenshots section to main page ([c72de32](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/c72de3226647a927a1ce8e6df467932ccc6e72ef))
* add static website builder with version tracking and screenshots navigation ([7a231db](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/7a231db3fc20f618bf3d8ddf4f141ce2d41d7351))
* **ci:** implement staging/production workflow separation ([#24](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/24)) ([769761e](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/769761eac11698b1bdde6e579b417c084fa06c38))
* **workflows:** add version.json creation to screenshots workflow ([01e56cf](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/01e56cfe0f9859d62545d2c9e674c3ca4220023e)), closes [#pages](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/pages) [#pages](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/pages)



# [0.5.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.5.1...v0.6.0-beta.0) (2026-01-12)


### Bug Fixes

* improve type safety and handle edge cases in API and configuration ([70abf36](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/70abf361d7f5f2f58178c62ea68f6d09b5b3fcda))
* resolved lint, formatting and tests issues ([4abacee](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/4abaceef0aa539b38f1f52993c2d96b009a50b23))


### Features

* **api:** implement parallel URL testing for self-healing (Phase 1.2) ([cce5816](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/cce5816cc8f50a4f44809517f27511962642ace1)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **api:** implement self-healing Obsidian API wrapper (Phase 1.3) ([77594ad](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/77594ad2ccf2b9b9f071b1f02745c6ceb71ce4e0)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **config:** implement multi-URL and transport configuration (Phase 1.1) ([6579f4e](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/6579f4e0dd52066e46f705c35b3d09463b75c27c)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **docker:** add HTTP transport support to Docker configuration ([033655b](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/033655be63f288a0b9144529ad3993f4e01b5c41))
* **health:** implement comprehensive health monitoring module ([b8842b5](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/b8842b5d91b7f65a1e46b9e0a17c213c6ce3807d))
* **http:** integrate WebStandardStreamableHTTPServerTransport for MCP protocol ([d031e37](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d031e378721c161adebf2c6fa01bfa026a449583))
* **integration:** integrate transport manager and refactor main index ([a3b087b](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/a3b087bd81d13b9be0198b5d8c52ad4821d83d47))
* **transports:** add configurable authentication for HTTP and SSE ([b124291](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/b1242916f076734d8716c1bf78c8a09c41a7ac9e))
* **transports:** create transport interfaces and MCP server factory (Phase 2.1-2.2) ([cbdb453](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/cbdb4534d26532e8e8fca91649f6f34b27c55586)), closes [#9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/9)
* **transports:** implement multi-transport support with separate MCP server instances ([d0abe25](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d0abe25f58e548c8731b5eeefe028247fea10b22)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7) [#9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/9)
* **transports:** implement Phase 2.3 stdio transport wrapper ([5dfa2b9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/5dfa2b990d2cf1b67221825913de7473a52711bf))
* **transports:** implement Phase 2.4 transport manager ([7f69a8a](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/7f69a8a25a09d7d3cd9c1e8d04eb8a551f50d875))
* **transports:** implement Phase 3.1 HTTP transport server ([df23034](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/df230347b60bf48810a7b0565e5fa47da04c4871))
* **transports:** implement Phase 3.2 MCP JSON-RPC over HTTP ([52df298](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/52df298cf29acc54e70d306cd7b7e97df9beea87))
* **transports:** implement Phase 4.1 SSE transport structure ([eb7dce8](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/eb7dce81c2e452842b035184134d792824e2a8fa))

## [0.5.1](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.5.0...v0.5.1) (2026-01-13)


### Bug Fixes

* **ci:** optimize Docker workflows with cache and rename workflows for clarity ([9a41288](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/9a41288))
* **ci:** fix lint and formatting issues across codebase ([bf5f9c0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/bf5f9c0))


### Documentation

* add CLAUDE.md with project guidance for AI assistants ([c04c5b5](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/c04c5b5))
* add manual testing and E2E verification guides ([8cf7b8a](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/8cf7b8a))
* add direnv setup documentation for WSL2 development ([ec31ea3](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/ec31ea3))
* add pre-release checklist runbook ([1943f3e](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/1943f3e))


### Build

* **deps:** update dependencies to latest compatible versions ([5aef4e5](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/5aef4e5))


## [0.5.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.4.2...v0.5.0) (2026-01-12)


### Bug Fixes

* improve type safety and handle edge cases in API and configuration ([70abf36](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/70abf361d7f5f2f58178c62ea68f6d09b5b3fcda))
* resolved lint, formatting and tests issues ([4abacee](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/4abaceef0aa539b38f1f52993c2d96b009a50b23))


### Features

* **api:** implement parallel URL testing for self-healing (Phase 1.2) ([cce5816](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/cce5816cc8f50a4f44809517f27511962642ace1)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **api:** implement self-healing Obsidian API wrapper (Phase 1.3) ([77594ad](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/77594ad2ccf2b9b9f071b1f02745c6ceb71ce4e0)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **config:** implement multi-URL and transport configuration (Phase 1.1) ([6579f4e](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/6579f4e0dd52066e46f705c35b3d09463b75c27c)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7)
* **docker:** add HTTP transport support to Docker configuration ([033655b](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/033655be63f288a0b9144529ad3993f4e01b5c41))
* **health:** implement comprehensive health monitoring module ([b8842b5](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/b8842b5d91b7f65a1e46b9e0a17c213c6ce3807d))
* **http:** integrate WebStandardStreamableHTTPServerTransport for MCP protocol ([d031e37](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d031e378721c161adebf2c6fa01bfa026a449583))
* **integration:** integrate transport manager and refactor main index ([a3b087b](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/a3b087bd81d13b9be0198b5d8c52ad4821d83d47))
* **transports:** add configurable authentication for HTTP and SSE ([b124291](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/b1242916f076734d8716c1bf78c8a09c41a7ac9e))
* **transports:** create transport interfaces and MCP server factory (Phase 2.1-2.2) ([cbdb453](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/cbdb4534d26532e8e8fca91649f6f34b27c55586)), closes [#9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/9)
* **transports:** implement multi-transport support with separate MCP server instances ([d0abe25](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d0abe25f58e548c8731b5eeefe028247fea10b22)), closes [#7](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/7) [#9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/issues/9)
* **transports:** implement Phase 2.3 stdio transport wrapper ([5dfa2b9](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/5dfa2b990d2cf1b67221825913de7473a52711bf))
* **transports:** implement Phase 2.4 transport manager ([7f69a8a](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/7f69a8a25a09d7d3cd9c1e8d04eb8a551f50d875))
* **transports:** implement Phase 3.1 HTTP transport server ([df23034](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/df230347b60bf48810a7b0565e5fa47da04c4871))
* **transports:** implement Phase 3.2 MCP JSON-RPC over HTTP ([52df298](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/52df298cf29acc54e70d306cd7b7e97df9beea87))
* **transports:** implement Phase 4.1 SSE transport structure ([eb7dce8](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/eb7dce81c2e452842b035184134d792824e2a8fa))

## [0.4.2](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.4.1...v0.4.2) (2025-06-29)


### Bug Fixes

* **cleanup:** correction to docker images cleanup script ([b0422dc](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/b0422dc3389d47c7b3092663016c2f11f3e5daab))
* **cleanup:** verified npm and docker cleanup scripts ([d9060f4](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d9060f47d1825ff81cb200e81a8ce04114ce77d4))
* **docker:** prevent unknown/unknown creation for docker images ([56b43b6](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/56b43b6472f81272e8a8a946cc0f748aafd673d2))
* **docker:** scoped cache for each job ([734916c](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/734916cda77b5830c69c31e8a2b5721a83f482db))

## [0.4.1](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.4.0...v0.4.1) (2025-06-28)


### Bug Fixes

* **docker:** mistake in docker image name ([d898047](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/d8980473fad7ae491b88c15430f895cf9439e2cb))

# [0.4.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.3.1...v0.4.0) (2025-06-28)


### Bug Fixes

* docker workflow metadata action tags format ([31830e3](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/31830e36c775279e2e3bf07e8c2613787f28c318))
* **npm:** forgoten readme file ([8827105](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/88271050a559be305e1b48c7af71b85956e571d4))
* **npm:** make npm module executable ([2faf06e](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/2faf06e99c079158cd0f740ec356bee88b3caef6))
* **npm:** tgz extracting now works ([00e9b2f](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/00e9b2f9784f864c7be5d4b9100368e77fcf7aa6))
* **release:** next version calculations during release ([9ec2203](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/9ec22035cc72f50cac38a9e8ba71947de1a01314))
* update npmjs publishing workflow to properly handle .npmrc and registry configuration ([47efafc](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/47efafc8ba438b5d85aa0fd3a590e2a168f19802))

## [0.3.1](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.3.0...v0.3.1) (2025-06-26)


### Bug Fixes

* **npm:** make npm module executable ([3d3ce84](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/3d3ce844cf79154490bac4fce95b76c90f15b08a))

# [0.3.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.2.2...v0.3.0) (2025-06-26)


### Bug Fixes

* **npm:** forgoten readme file ([65ccc7a](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/65ccc7a0820883f48edf08a5e62afd86d0b4e538))

## [0.2.3](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.2.2...v0.2.3) (2025-06-26)


### Bug Fixes

* **npm:** forgoten readme file ([65ccc7a](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/65ccc7a0820883f48edf08a5e62afd86d0b4e538))

## [0.2.2](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.2.2-beta.1...v0.2.2) (2025-06-26)


### Bug Fixes

* **release:** next version calculations during release ([acd7b29](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/commit/acd7b29fc6a11c733fb2be4c263b5f83fe79ae04))
