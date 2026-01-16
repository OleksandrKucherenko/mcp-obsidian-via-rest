# Changelog

# [0.10.0-rc.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.9.0-beta.0...v0.10.0-rc.0) (2026-01-16)

# [0.5.0](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/compare/v0.4.2...v0.5.0) (2026-01-12)


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
