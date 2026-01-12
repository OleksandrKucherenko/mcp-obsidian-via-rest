---
title: Axios to Fetch Migration Findings
date: 2026-01-12
status: draft
---

# Axios to Fetch Migration Findings

## Context and Goals
- Primary target runtime: Node 18+.
- Goal: replace Axios with native `fetch` to reduce dependencies while preserving current behavior.
- Secondary goal: investigate `undici` where native `fetch` needs extra control (TLS, retries, timeouts).

## Current Axios Usage (Observed)
- `src/client/obsidian-api.ts`
  - `axios.create` with `baseURL`, auth header, timeout, `https.Agent` for self-signed certs.
  - Retry via `axios-retry` (5 retries, reset timeout).
  - Logging via `axios-debug-log` + `debug`.
  - Error shaping in `safeCall` distinguishes response vs network errors.
- `src/api/url-tester.ts`
  - Creates per-request Axios instance, performs `GET /` with timeout.
- Tests
  - Unit tests mock Axios modules (`src/client/obsidian-api.test.ts`, `tests/api/url-tester.test.ts`).
  - E2E tests use Axios to probe host availability with self-signed TLS in `tests/obsidian-api.e2e.test.ts`.

## Options Considered
### 1) Native `fetch` with a small wrapper (recommended)
Use a single wrapper for headers, timeout, retries, logging, and JSON parsing.
- Pros: minimal dependencies, consistent behavior across call sites, easy to unit test.
- Cons: need to re-implement retries and error shaping, careful handling of timeouts and aborts.

### 2) Native `fetch` + `undici` Agent only (recommended add-on)
Use `undici.Agent` for self-signed TLS and pass as `dispatcher` to `fetch` requests.
- Pros: keep fetch API, add TLS control without Axios.
- Cons: TypeScript types for `dispatcher` are not in standard `fetch` types; may need explicit types or `undici` fetch.

### 3) Full `undici` Client/Pool
Use `undici` directly for all HTTP calls.
- Pros: strongest control over TLS, timeouts, and connection reuse.
- Cons: more verbose, larger refactor in tests, no standard `fetch` semantics.

### 4) Lightweight fetch wrapper (`ky`, `ofetch`)
- Pros: retries/timeouts provided out of the box, clean API.
- Cons: new dependency, may still need `undici` for TLS, less aligned with "native fetch only".

## Recommendation
Adopt a native `fetch` wrapper as the primary client and use `undici.Agent` only when self-signed TLS is required. This keeps dependencies minimal while preserving Axios behavior (retry, timeout, logging, error shaping).

## Implementation Sketch (No Code Yet)
1. Create `src/client/http-client.ts` wrapper:
   - Inputs: `baseURL`, `headers`, `timeout`, `retries`, `logger`, `tls` options.
   - Implement timeout via `AbortController`.
   - Implement retry loop (retry all errors, log each retry).
   - Parse JSON responses where applicable; preserve status and error payloads.
2. Update `src/client/obsidian-api.ts`:
   - Replace Axios instance with the wrapper.
   - Keep existing `safeCall` error shaping but adjust to fetch errors and response payloads.
3. Update `src/api/url-tester.ts`:
   - Use wrapper for `GET /` requests.
4. Update tests:
   - Mock wrapper functions instead of Axios module.
   - E2E host check: use fetch + optional `undici.Agent` for self-signed TLS.
5. Dependencies:
   - Remove `axios`, `axios-retry`, `axios-debug-log` from `package.json`.
   - Add `undici` only if using an explicit Agent for TLS.

## Risks and Considerations
- Node 18 `fetch` supports `dispatcher` for `undici.Agent`, but standard TS types do not. Options:
  - Import `fetch` from `undici` and use its types.
  - Extend RequestInit typing locally to include `dispatcher`.
- TLS: self-signed cert handling must remain explicit and safe (avoid global TLS overrides).
- Error mapping: ensure `safeCall` still surfaces `Error <code>: <message>` for REST API errors.
- Retries: current behavior retries all errors; keep same semantics or document change.
- Runtime differences: Bun has built-in `fetch` but does not support `undici` dispatchers. If Bun is still used at runtime, guard Node-only TLS logic.

## Open Questions
- Should TLS bypass be configurable (on/off) rather than always enabled?
- Do we want exponential backoff instead of fixed retries?
- Should the wrapper expose a typed response helper to simplify parsing in callers?

## Next Steps (If Approved)
1. Implement wrapper and update API client and URL tester.
2. Update tests to mock wrapper.
3. Remove Axios dependencies and adjust docs.
