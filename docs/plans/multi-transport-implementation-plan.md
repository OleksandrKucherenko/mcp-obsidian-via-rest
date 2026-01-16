# Implementation Plan: Multi-Transport MCP Server with Self-Healing

## Overview

Implement HTTP and SSE (Server-Sent Events) transports for the MCP server while maintaining stdio support. Add smart configuration with self-healing Obsidian API connections, especially for WSL2 environments. Update all dependencies to latest versions.

**Development Methodology: Test-Driven Development (TDD)**
- All implementation follows strict TDD: Write tests FIRST, then implement
- Red-Green-Refactor cycle for every feature
- No production code written without a failing test first
- Tests serve as living documentation and design specification

**Addresses GitHub Issues:**
- **#9**: Implement SSE for MCP server
- **#7**: Implement smarter startup logic with multiple API URLs

**Key Requirements:**
- All three transports (stdio, HTTP, SSE) active simultaneously
- Single HTTP server port for both HTTP and SSE endpoints
- Multi-URL configuration with automatic failover
- Connection monitoring and self-healing
- Full unit test coverage (>80%) via TDD
- Docker optimization (minimal size, Bun runtime)
- Update all dependencies to latest versions

## Architecture Summary

### Transport Architecture
```
┌─────────────────────────────────────────┐
│         MCP Server Instance             │
│  (Shared across all transports)         │
└──────────┬──────────┬──────────────────┘
           │          │          │
    ┌──────▼───┐ ┌───▼─────┐ ┌─▼─────────┐
    │  stdio   │ │  HTTP   │ │    SSE    │
    │Transport │ │Transport│ │ Transport │
    └──────────┘ └─────────┘ └───────────┘
         │            │            │
    process.      HTTP Server      │
    stdin/out    (Hono/Bun)       │
                      └────────────┘
                    Port 3000 (shared)

┌─────────────────────────────────────────┐
│    Self-Healing Obsidian API Client     │
│  - Tests multiple URLs in parallel      │
│  - Selects fastest working URL          │
│  - Monitors connection health           │
│  - Auto-reconnects on failure           │
└─────────────────────────────────────────┘
```

### Configuration Structure
```typescript
{
  obsidian: {
    urls: ["https://127.0.0.1:27124", "https://${WSL_GATEWAY_IP}:27124"],
    apiKey: string,
    testTimeout: 2000,
    retryInterval: 30000
  },
  transports: {
    stdio: { enabled: true },
    http: { enabled: true, port: 3000, host: "0.0.0.0", path: "/mcp" }
  }
}
```

## Critical Files

### New Files to Create

**Transport Layer:**
- `src/transports/types.ts` - Transport interfaces and types
- `src/transports/stdio.transport.ts` - Stdio transport wrapper
- `src/transports/http.transport.ts` - Streamable HTTP transport (MCP JSON-RPC with built-in SSE streaming)
- `src/transports/manager.ts` - Transport lifecycle management

**Server Layer:**
- `src/server/mcp-server.ts` - MCP server factory
- `src/server/health.ts` - Health monitoring and status

**API Layer:**
- `src/api/self-healing.ts` - Self-healing API wrapper with failover
- `src/api/url-tester.ts` - Parallel URL testing with Promise.all

**Configuration:**
- `src/config.types.ts` - Extended configuration types
- `configs/config.transport.jsonc` - Example transport configuration

**Tests:**
- `tests/transports/http.transport.test.ts` - HTTP unit tests
- `tests/transports/sse.transport.test.ts` - SSE unit tests
- `tests/transports/manager.test.ts` - Manager tests
- `tests/api/self-healing.test.ts` - Self-healing tests
- `tests/api/url-tester.test.ts` - URL tester tests
- `tests/http.e2e.test.ts` - HTTP E2E tests
- `tests/sse.e2e.test.ts` - SSE E2E tests
- `tests/mcp.http.containers.test.ts` - Container tests

### Files to Modify

**Core:**
- `src/index.ts` - Major refactor to support multiple transports
- `src/config.ts` - Add transport and multi-URL configuration (+150 lines)
- `src/client/obsidian-api.ts` - Extract base class for self-healing wrapper

**Docker:**
- `Dockerfile` - Add EXPOSE 3000, update HEALTHCHECK to use HTTP endpoint
- `docker-compose.yaml` - Add port mappings, update environment variables
- `docker-compose.test.yaml` - Add HTTP testing setup, update health checks

**Package:**
- `package.json` - Update all dependencies to latest, add Hono framework

## Implementation Phases

### Phase 0: Dependency Updates (Day 1)

**Goal:** Update all dependencies to latest stable versions

**Tasks:**
1. Update MCP SDK to latest version (check for breaking changes)
2. Update Biome, TypeScript types, and dev tools
3. Update Axios and related dependencies
4. Add new dependencies: Hono for HTTP server
5. Run tests to ensure no breakage
6. Update lock file and verify build

**New Dependencies to Add:**
```json
{
  "dependencies": {
    "hono": "^4.0.0"
  }
}
```

**Key Packages to Update:**
- `@modelcontextprotocol/sdk` - Check latest version, review changelog
- `axios` - Update to latest 1.x version
- `@biomejs/biome` - Update to latest
- `testcontainers` - Update to latest
- All other dependencies

**Commands:**
```bash
# Check for updates
bun update --latest

# Test after updates
bun run checks:types
bun run checks:lint
bun test ./src
```

**Milestone:** All dependencies updated, tests pass

---

### Phase 1: Configuration & Self-Healing (Days 2-4)

**Goal:** Set up multi-URL configuration and self-healing API using TDD

#### Task 1.1: Extend Configuration System (Day 2) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/config.test.ts`:
  ```typescript
  describe('Configuration Loading', () => {
    it('should parse multi-URL JSON array from env variable')
    it('should parse semicolon-separated URLs as fallback')
    it('should load transport configuration from env')
    it('should default to stdio-only for backward compatibility')
    it('should support legacy API_HOST + API_PORT format')
    it('should validate transport config schema with Zod')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Create Interfaces (Green)**
- Create `src/config.types.ts` with new interfaces:
  ```typescript
  interface TransportConfig { stdio, http, sse }
  interface ObsidianAPIConfig { urls: string[], apiKey, testTimeout, retryInterval }
  interface AppConfig { obsidian, transports, health }
  ```

**Step 3: Implement Config Parsing (Green)**
- Extend `src/config.ts` to parse multi-URL arrays (JSON or semicolon-separated)
- Add transport configuration parsing
- Support environment variables: `API_URLS`, `MCP_TRANSPORTS`, `MCP_HTTP_PORT`
- Run tests → All pass (GREEN)

**Step 4: Refactor**
- Extract URL parsing logic into separate function
- Add Zod validation schemas
- Create `configs/config.transport.jsonc` example file
- Run tests → All still pass

**Milestone:** Multi-URL config loading works, tests prove it

#### Task 1.2: Implement URL Testing (Day 2-3) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/api/url-tester.test.ts`:
  ```typescript
  describe('URL Testing', () => {
    it('should test multiple URLs in parallel with Promise.all')
    it('should return success for working URLs')
    it('should return failure for unreachable URLs')
    it('should measure latency for each URL')
    it('should select fastest working URL from results')
    it('should return null if all URLs fail')
    it('should respect timeout parameter')
  })
  ```
- Mock Axios with successful/failing responses
- Run tests → All fail (RED)

**Step 2: Implement URL Testing (Green)**
- Create `src/api/url-tester.ts`:
  ```typescript
  async function testUrlsInParallel(urls: string[], apiKey: string, timeout: number)
  async function selectBestUrl(results: URLTestResult[]): string | null
  ```
- Implement parallel testing with `Promise.all`
- Sort by latency, select fastest working URL
- Run tests → All pass (GREEN)

**Step 3: Refactor**
- Extract latency measurement into helper
- Add retry logic for flaky connections
- Run tests → All still pass

**Milestone:** URL testing selects fastest working URL (Issue #7)

#### Task 1.3: Create Self-Healing API (Day 3-4) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/api/self-healing.test.ts`:
  ```typescript
  describe('SelfHealingObsidianAPI', () => {
    it('should select best URL on initialization')
    it('should call startMonitoring after initialization')
    it('should detect connection failures')
    it('should attempt reconnection on failure')
    it('should try alternative URLs in order')
    it('should update health status')
    it('should cleanup timer on destroy')
    it('should not thrash with rapid reconnect attempts')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Self-Healing (Green)**
- Create `src/api/self-healing.ts`:
  ```typescript
  class SelfHealingObsidianAPI extends ObsidianAPI {
    async initialize(): Promise<void>
    private async attemptReconnect(): Promise<void>
    private startMonitoring(): void
    public getHealth(): { healthy: boolean; url: string }
  }
  ```
- Implement automatic URL selection on startup
- Add connection monitoring (health check every 30s)
- Implement reconnection logic with fallback
- Run tests → All pass (GREEN)

**Step 3: Refactor**
- Add exponential backoff for reconnection
- Extract monitoring interval to config
- Improve error logging
- Run tests → All still pass

**Milestone:** API automatically reconnects on failure, fully tested (Issue #7 ✓)

---

### Phase 2: Transport Infrastructure (Days 5-7)

**Goal:** Refactor existing code and create transport abstractions using TDD

#### Task 2.1: Create Transport Interfaces (Day 5) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/transports/types.test.ts`:
  ```typescript
  describe('Transport Interfaces', () => {
    it('should define TransportContext with close method')
    it('should validate HttpTransportConfig schema')
    it('should validate SseTransportConfig schema')
    it('should type-check lifecycle management interfaces')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Interfaces (Green)**
- Create `src/transports/types.ts`:
  ```typescript
  interface TransportContext { close(): Promise<void> }
  interface HttpTransportConfig { enabled, port, host, path, cors }
  ```
- Add Zod schemas for validation
- Run tests → All pass (GREEN)

**Milestone:** Transport contracts defined with tests

#### Task 2.2: Refactor MCP Server Creation (Day 5-6) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/server/mcp-server.test.ts`:
  ```typescript
  describe('MCP Server Factory', () => {
    it('should create server with correct name and version')
    it('should register get_note_content tool')
    it('should register obsidian_search tool')
    it('should register obsidian_semantic_search tool')
    it('should register obsidian:// resource template')
    it('should use provided ObsidianAPI instance')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Extract and Implement Factory (Green)**
- Create `src/server/mcp-server.ts` factory:
  ```typescript
  function createMcpServer(api: ObsidianAPI): McpServer
  ```
- Extract tool/resource registration from `src/index.ts`
- Run tests → All pass (GREEN)

**Step 3: Verify Backward Compatibility**
- Update `src/index.ts` to use factory
- Run existing E2E tests → All pass
- **Milestone:** Server factory works, stdio unchanged, fully tested

#### Task 2.3: Wrap Stdio Transport (Day 6-7) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/transports/stdio.transport.test.ts`:
  ```typescript
  describe('Stdio Transport', () => {
    it('should create transport with intercepted streams')
    it('should connect server to transport')
    it('should provide close method')
    it('should cleanup on close')
    it('should maintain existing stdio behavior')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Stdio Wrapper (Green)**
- Create `src/transports/stdio.transport.ts`:
  ```typescript
  async function createStdioTransport(server: McpServer): Promise<StdioTransportContext>
  ```
- Wrap existing stdio interception logic
- Run tests → All pass (GREEN)

**Step 3: Integration Test**
- Update `src/index.ts` to use wrapper
- Run existing E2E tests → All pass
- **Milestone:** Stdio transport wrapped, backward compatible

#### Task 2.4: Create Transport Manager (Day 7) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/transports/manager.test.ts`:
  ```typescript
  describe('TransportManager', () => {
    it('should start enabled transports based on config')
    it('should skip disabled transports')
    it('should stop all running transports')
    it('should return transport status')
    it('should handle transport initialization errors gracefully')
    it('should cleanup all resources on stop')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Manager (Green)**
- Create `src/transports/manager.ts`:
  ```typescript
  class TransportManager {
    async startTransports(config: TransportConfig, server: McpServer)
    async stopTransports()
    getStatus(): TransportStatus
  }
  ```
- Implement conditional initialization
- Run tests → All pass (GREEN)

**Milestone:** Manager manages transports, fully tested

---

### Phase 3: HTTP Transport (Days 8-10)

**Goal:** Implement Streamable HTTP transport with MCP JSON-RPC using TDD

#### Task 3.1: Setup HTTP Server (Day 8) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/transports/http.transport.test.ts`:
  ```typescript
  describe('HTTP Transport', () => {
    it('should create Hono app')
    it('should start HTTP server on configured port')
    it('should apply CORS middleware')
    it('should serve /health endpoint')
    it('should return 200 when healthy')
    it('should return 503 when unhealthy')
    it('should include system status in health response')
    it('should close server cleanly')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement HTTP Server (Green)**
- Add Hono to dependencies
- Create `src/transports/http.transport.ts`:
  ```typescript
  async function createHttpTransport(
    config: HttpTransportConfig,
    server: McpServer
  ): Promise<HttpTransportContext>
  ```
- Setup Hono app with CORS middleware
- Implement `/health` endpoint
- Run tests → All pass (GREEN)

**Step 3: Refactor**
- Extract health status logic to separate module
- Add request logging middleware
- Run tests → All still pass

**Milestone:** HTTP server starts, health endpoint works, fully tested

#### Task 3.2: Implement MCP JSON-RPC over HTTP (Day 8-9) - TDD Approach

**Step 1: Write Tests First (Red)**
- Extend `tests/transports/http.transport.test.ts`:
  ```typescript
  describe('MCP JSON-RPC over HTTP', () => {
    it('should handle POST /mcp requests')
    it('should accept JSON-RPC initialize request')
    it('should return valid JSON-RPC response')
    it('should integrate with StreamableHTTPServerTransport')
    it('should authenticate requests with Bearer token if configured')
    it('should reject unauthenticated requests when auth enabled')
    it('should handle malformed JSON gracefully')
    it('should set correct content-type headers')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement MCP Endpoint (Green)**
- Integrate MCP SDK's `StreamableHTTPServerTransport`
- Implement POST `/mcp` endpoint
- Add Bearer token authentication middleware
- Run tests → All pass (GREEN)

**Step 3: Refactor**
- Extract auth middleware to separate function
- Add error handling for transport errors
- Run tests → All still pass

**Milestone:** HTTP transport handles MCP JSON-RPC (Issue #9 partial ✓)

#### Task 3.3: Integration & E2E Tests (Day 9-10) - TDD Approach

**Step 1: Write E2E Tests First (Red)**
- Create `tests/http.e2e.test.ts`:
  ```typescript
  describe('HTTP Transport E2E', () => {
    it('should initialize MCP connection via HTTP')
    it('should invoke get_note_content tool')
    it('should invoke obsidian_search tool')
    it('should read obsidian:// resources')
    it('should handle errors gracefully')
    it('should work with real Obsidian API')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Integrate HTTP Transport (Green)**
- Update `src/transports/manager.ts` to start HTTP
- Update `src/index.ts` to enable HTTP based on config
- Run E2E tests with real Obsidian → All pass (GREEN)

**Step 3: Refactor**
- Optimize transport initialization order
- Add debug logging
- Run all tests (unit + E2E) → All pass

**Milestone:** HTTP transport works end-to-end, fully tested

---

### Phase 4: SSE Transport (Days 11-13)

**Goal:** Implement SSE transport for streaming using TDD

#### Task 4.1: Implement SSE Transport (Day 11-12) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/transports/sse.transport.test.ts`:
  ```typescript
  describe('SSE Transport', () => {
    it('should mount on shared Hono app')
    it('should handle GET /sse for connection establishment')
    it('should generate unique session IDs')
    it('should establish SSE connection with proper headers')
    it('should handle POST /messages with valid session ID')
    it('should reject messages with invalid session ID')
    it('should manage session-to-transport mapping')
    it('should cleanup sessions on disconnect')
    it('should send events via SSE stream')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement SSE Transport (Green)**
- Create `src/transports/sse.transport.ts`:
  ```typescript
  async function createSseTransport(
    config: SseTransportConfig,
    server: McpServer,
    httpApp: Hono  // Share HTTP server
  ): Promise<SseTransportContext>
  ```
- Integrate MCP SDK's `SSEServerTransport`
- Implement GET `/sse` endpoint
- Implement POST `/messages` endpoint
- Handle session management (Map<sessionId, transport>)
- Run tests → All pass (GREEN)

**Step 3: Refactor**
- Extract session management to helper class
- Add session timeout cleanup
- Add memory leak prevention
- Run tests → All still pass

**Milestone:** SSE transport handles connections (Issue #9 complete ✓)

#### Task 4.2: Integration & E2E Tests (Day 12-13) - TDD Approach

**Step 1: Write E2E Tests First (Red)**
- Create `tests/sse.e2e.test.ts`:
  ```typescript
  describe('SSE Transport E2E', () => {
    it('should establish SSE connection')
    it('should receive session ID in SSE stream')
    it('should send initialize request via POST /messages')
    it('should receive streaming response')
    it('should invoke tools via SSE')
    it('should handle reconnection')
    it('should cleanup on disconnect')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Integrate SSE Transport (Green)**
- Update `src/transports/manager.ts` to support SSE
- Share HTTP server between HTTP and SSE (single port)
- Update `src/index.ts` for SSE config
- Run E2E tests → All pass (GREEN)

**Step 3: Refactor**
- Optimize session management
- Add heartbeat mechanism
- Run all tests → All pass

**Milestone:** SSE transport works end-to-end, fully tested

---

### Phase 5: Health Monitoring (Days 14-15)

**Goal:** Complete health monitoring and lifecycle management using TDD

#### Task 5.1: Implement Health Monitoring (Day 14) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/server/health.test.ts`:
  ```typescript
  describe('Health Monitoring', () => {
    it('should return healthy status when all systems operational')
    it('should return unhealthy when Obsidian disconnected')
    it('should include Obsidian connection details')
    it('should include all transport statuses')
    it('should include uptime')
    it('should include last check timestamp')
    it('should handle API errors gracefully')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Health Module (Green)**
- Create `src/server/health.ts`:
  ```typescript
  interface HealthStatus {
    healthy: boolean
    obsidian: { connected: boolean; url: string; lastCheck: Date }
    transports: { stdio, http, sse }
    uptime: number
  }

  async function getHealthStatus(
    api: SelfHealingObsidianAPI,
    manager: TransportManager
  ): Promise<HealthStatus>
  ```
- Integrate with self-healing API
- Run tests → All pass (GREEN)

**Step 3: Integration**
- Update HTTP `/health` endpoint to use new module
- Run HTTP transport tests → All pass

**Milestone:** Health endpoint shows complete system status, fully tested

#### Task 5.2: Finalize Transport Manager (Day 14-15) - TDD Approach

**Step 1: Write Tests First (Red)**
- Extend `tests/transports/manager.test.ts`:
  ```typescript
  describe('Transport Lifecycle', () => {
    it('should start all enabled transports')
    it('should stop all transports gracefully')
    it('should handle SIGTERM signal')
    it('should handle SIGINT signal')
    it('should cleanup resources on shutdown')
    it('should prevent duplicate starts')
    it('should allow restart after stop')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Lifecycle (Green)**
- Complete lifecycle management (start, stop, restart)
- Implement graceful shutdown:
  ```typescript
  async function gracefulShutdown(signal: string) {
    await transportManager.stopTransports()
    await selfHealingApi.destroy()
    process.exit(0)
  }
  ```
- Add signal handlers (SIGTERM, SIGINT)
- Run tests → All pass (GREEN)

**Step 3: Integration Test**
- Test full lifecycle in integration test
- Verify cleanup in all scenarios
- Run all tests → All pass

**Milestone:** All transports start/stop cleanly, fully tested

---

### Phase 6: Docker Integration (Days 16-18)

**Goal:** Docker configuration and container testing using TDD

#### Task 6.1: Update Dockerfile (Day 16)

**Step 1: Manual Updates (No tests for Dockerfile syntax)**
- Add port exposure:
  ```dockerfile
  EXPOSE 3000
  ```
- Update HEALTHCHECK to use HTTP endpoint:
  ```dockerfile
  HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
  ```
- Keep tini for signal handling

**Step 2: Verify with Build**
- Test Docker build: `docker build -t mcp/obsidian:test .`
- Verify image size increase <20MB
- Test manual run with HTTP transport

**Milestone:** Docker image builds with HTTP support

#### Task 6.2: Update Docker Compose Files (Day 16-17)

**Step 1: Update Compose Files**
- Update `docker-compose.yaml` with HTTP config
- Update `docker-compose.test.yaml` for testing
- Add port mappings and environment variables

**Step 2: Verify with Manual Test**
- Start compose: `docker compose up`
- Test health endpoint: `curl http://localhost:3000/health`
- Test MCP endpoint: `curl -X POST http://localhost:3000/mcp`
- Verify in container logs

**Milestone:** Docker compose works with HTTP

#### Task 6.3: Write Container Tests (Day 17-18) - TDD Approach

**Step 1: Write Tests First (Red)**
- Create `tests/mcp.http.containers.test.ts`:
  ```typescript
  describe('HTTP Transport in Container', () => {
    it('should start container with HTTP port exposed')
    it('should pass health check via HTTP')
    it('should accept MCP initialize request via HTTP')
    it('should invoke tools via HTTP')
    it('should work with real Obsidian container')
    it('should handle multiple URLs with self-healing')
    it('should cleanup resources on stop')
  })
  ```
- Run tests → All fail (RED)

**Step 2: Implement Container Test Utils (Green)**
- Update `tests/utils/setup.containers.ts`:
  - Add HTTP port mapping
  - Add HTTP client helpers
  - Add health check verification
- Implement container tests
- Run tests → All pass (GREEN)

**Step 3: Full Test Suite**
- Run unit tests: `bun test ./src`
- Run E2E tests: `bun test:e2e`
- Run container tests: `bun test:containers`
- Verify all pass

**Milestone:** All container tests pass, full TDD coverage

---

### Phase 7: Documentation & Release (Days 19-20)

**Goal:** Documentation and final polish

#### Task 7.1: Update Documentation (Day 19)
- Update [README.md](README.md):
  - Add HTTP/SSE transport usage examples
  - Document environment variables (`API_URLS`, `MCP_TRANSPORTS`, etc.)
  - Add Docker examples for each transport
  - Add WSL2 configuration examples
- Update [CLAUDE.md](CLAUDE.md):
  - Document new architecture
  - Update command examples
  - Add debugging tips for HTTP/SSE
- Create migration guide from stdio-only to multi-transport
- Add configuration examples for common scenarios
- **Milestone:** Documentation complete

#### Task 7.2: Final Testing & Polish (Day 19-20)
- Run full test suite across all environments
- Test WSL2 multi-URL scenario specifically
- Verify Docker image size increase is minimal
- Code review and refactoring for code quality
- Add debug logging throughout (using `debug` package)
- Verify Biome formatting/linting passes
- **Milestone:** Ready for release

#### Task 7.3: Close GitHub Issues (Day 20)
- Close Issue #7: Smart startup with multiple URLs ✓
- Close Issue #9: SSE implementation ✓
- Update issue comments with implementation details
- Reference commits and PRs

---

## Verification Plan

### TDD Red-Green-Refactor Compliance

**Every feature must follow:**
1. **Red**: Write failing test first
2. **Green**: Implement minimum code to pass
3. **Refactor**: Improve code while keeping tests green

**Verification:**
- [ ] All production code has corresponding test written FIRST
- [ ] Git history shows test commits before implementation commits
- [ ] No production code written without failing test
- [ ] All tests pass before moving to next phase

### Functional Testing Checklist

**Multi-Transport (TDD Verified):**
- [ ] Stdio transport works (backward compatibility) - TESTS PASS
- [ ] HTTP transport works (POST /mcp) - TESTS PASS
- [ ] SSE transport works (GET /sse, POST /messages) - TESTS PASS
- [ ] All three transports work simultaneously - TESTS PASS
- [ ] Transports can be selectively enabled/disabled via config - TESTS PASS

**Self-Healing (TDD Verified):**
- [ ] Parallel URL testing selects fastest working URL - TESTS PASS
- [ ] Connection monitoring detects Obsidian API failures - TESTS PASS
- [ ] Auto-reconnect switches to alternative URL on failure - TESTS PASS
- [ ] Health endpoint accurately reflects connection status - TESTS PASS

**HTTP Endpoints (TDD Verified):**
- [ ] POST /mcp handles all MCP JSON-RPC methods - TESTS PASS
- [ ] GET /health returns system status - TESTS PASS
- [ ] GET /sse establishes SSE connections - TESTS PASS
- [ ] POST /messages handles SSE messages - TESTS PASS
- [ ] CORS works for browser clients - TESTS PASS
- [ ] Authentication works (if enabled) - TESTS PASS

**Docker (TDD Verified where applicable):**
- [ ] Container builds successfully - MANUAL VERIFY
- [ ] HTTP port (3000) exposed correctly - TESTS PASS
- [ ] Health check uses HTTP endpoint - MANUAL VERIFY
- [ ] Environment variables configure transports - TESTS PASS
- [ ] Multi-URL configuration works in container - TESTS PASS
- [ ] Container size increase <20MB - MANUAL VERIFY

### Test Coverage Requirements (TDD Enforced)

- [ ] Unit test coverage >80% for new code (TDD ensures this)
- [ ] All existing tests pass (backward compatibility)
- [ ] E2E tests for each transport type (written first)
- [ ] Container tests verify Docker integration (written first)
- [ ] WSL2 scenario tested manually
- [ ] Every function has test written before implementation

### Performance Requirements (Test-Verified)

- [ ] Startup time increase <2 seconds - PERFORMANCE TEST
- [ ] HTTP latency <50ms over stdio baseline - PERFORMANCE TEST
- [ ] URL testing completes within 5 seconds (for 3 URLs) - UNIT TEST
- [ ] Memory usage increase <50MB with all transports - PERFORMANCE TEST

---

## Environment Variables Reference

### Obsidian API Configuration

```bash
# Multiple URLs (JSON array format) - NEW
API_URLS='["https://127.0.0.1:27124", "https://${WSL_GATEWAY_IP}:27124", "https://host.docker.internal:27124"]'

# Legacy single URL support (backward compatible)
API_HOST="https://127.0.0.1"
API_PORT="27124"

# Required: Obsidian Local REST API key
API_KEY="your-api-key-here"
```

### Transport Configuration

```bash
# Enable transports (comma-separated) - NEW
MCP_TRANSPORTS="stdio,http"  # Default: "stdio,http"

# HTTP transport settings - NEW
MCP_HTTP_PORT=3000
MCP_HTTP_HOST="0.0.0.0"
MCP_HTTP_PATH="/mcp"

# Optional authentication - NEW
MCP_API_TOKEN="your-secret-token"  # If not set, auth disabled
```

### Debugging & Monitoring

```bash
# Debug logging
DEBUG="mcp:*"  # All MCP logs
DEBUG="mcp:transport:*"  # Transport logs only
DEBUG="mcp:api:*"  # API client logs only

# Health monitoring - NEW
HEALTH_CHECK_INTERVAL=5000  # ms, default: 5000
```

---

## Usage Examples

### Stdio Only (Default - Backward Compatible)

```bash
# CLI usage
bun run start

# Docker
docker run --rm -i \
  -e API_KEY=xxx \
  -e API_HOST=https://host.docker.internal \
  mcp/obsidian:latest
```

### HTTP Transport

```bash
# Local development
MCP_TRANSPORTS=http MCP_HTTP_PORT=3000 bun run start

# Docker with port mapping
docker run --rm -p 3000:3000 \
  -e API_KEY=xxx \
  -e API_URLS='["https://host.docker.internal:27124"]' \
  -e MCP_TRANSPORTS=http \
  mcp/obsidian:latest

# Test HTTP endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}'

# Health check
curl http://localhost:3000/health
```

### All Transports with Multi-URL (WSL2 Scenario)

```bash
# Docker with all transports and multiple Obsidian URLs
docker run --rm -i -p 3000:3000 \
  -e API_KEY=xxx \
  -e API_URLS='["https://127.0.0.1:27124","https://host.docker.internal:27124","https://192.168.1.100:27124"]' \
  -e MCP_TRANSPORTS=stdio,http \
  -e DEBUG=mcp:* \
  mcp/obsidian:latest
```

### SSE Transport

```bash
# Establish SSE connection
curl -N http://localhost:3000/sse

# Send message (in another terminal)
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id-from-sse>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## Risk Assessment

| Risk                                         | Impact | Mitigation                                           |
| -------------------------------------------- | ------ | ---------------------------------------------------- |
| MCP SDK HTTP transport incompatible with Bun | High   | Test early in Phase 3; fallback to Node.js if needed |
| Multiple transports share state incorrectly  | High   | Single MCP server instance design; extensive tests   |
| Dependency updates break existing code       | Medium | Update dependencies first (Phase 0); run all tests   |
| Docker health check failures                 | Medium | Support both file-based and HTTP health checks       |
| Connection thrashing in self-healing         | Medium | Exponential backoff; configurable retry intervals    |

---

## Success Criteria

- [x] Phase 0: All dependencies updated to latest versions
- [x] Phase 1: Multi-URL configuration and self-healing works (Issue #7 ✓)
- [x] Phase 2: Transport abstraction layer complete
- [x] Phase 3: HTTP transport works (Issue #9 partial ✓)
- [x] Phase 4: SSE transport works (Issue #9 complete ✓)
- [x] Phase 5: Health monitoring complete
- [x] Phase 6: Docker integration complete
- [x] Phase 7: Documentation complete
- [x] All tests pass (>80% coverage for new code)
- [x] No breaking changes to existing stdio functionality
- [x] Docker image size increase <20MB
- [x] GitHub issues #7 and #9 closed

---

## Timeline Summary

- **Phase 0**: Dependency updates (1 day)
- **Phase 1**: Configuration & self-healing (3 days)
- **Phase 2**: Transport infrastructure (3 days)
- **Phase 3**: HTTP transport (3 days)
- **Phase 4**: SSE transport (3 days)
- **Phase 5**: Health monitoring (2 days)
- **Phase 6**: Docker integration (3 days)
- **Phase 7**: Documentation & release (2 days)

**Total: ~20 days** (conservative estimate with buffer)

**Critical Path: ~14 days** (with parallelization)
