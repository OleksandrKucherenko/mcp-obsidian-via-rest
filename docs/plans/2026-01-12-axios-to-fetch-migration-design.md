---
title: Axios to Undici Migration Findings
date: 2026-01-12
status: draft
---

# Axios to Undici Migration Findings

## Context and Goals
- Primary target runtime: Node 18+.
- Goal: replace Axios with `undici` while preserving current behavior (timeouts, retries, logging, error shaping).
- Use `undici-retry` for fixed, fail-fast retries aligned with MCP availability reporting.

## Why Undici
Node's native `fetch` is powered by `undici`, but using `undici` directly provides:
- Explicit control over timeouts, TLS settings, and connection reuse.
- Better unit test ergonomics via `MockAgent` without global `fetch` mocks.
- A clean retry story with `undici-retry` when we need predictable, fixed attempts.

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

## Comparison Table
| Axios usage today | Undici replacement | Pros | Cons |
| --- | --- | --- | --- |
| `axios.create` with `baseURL` and default headers | `undici` Client or Pool with base URL and default headers | Explicit connection reuse | Requires client lifecycle management |
| Timeout via Axios config | `headersTimeout` / `bodyTimeout` on undici request | Clear separation of timeout types | Must set per-request or in client defaults |
| Retries via `axios-retry` | `undici-retry` with fixed attempts | Built-in retryable status list | Adds dependency and ties to undici Client |
| Logging via `axios-debug-log` | `debug` logging around request/response | Consistent with existing logging | Manual mapping of request/response details |
| Self-signed TLS via `https.Agent` | `undici` Client with `connect` TLS options (configurable) | Explicit TLS control | Must ensure TLS bypass is opt-in |
| Error shaping via `axios.isAxiosError` | Inspect status code + parse JSON `{ errorCode, message }` | Clear error mapping | Must handle non-JSON and network errors |
| `response.data` convenience | `body.json()` / `body.text()` on undici response | No extra deps | Must always consume body |
| URL tester axios instance | Shared undici client + simple `GET /` | Reuse shared logic | Update tests and mocks |
| Tests mocking Axios module | `undici` `MockAgent` | Cleaner, isolated unit tests | Requires refactor of test setup |

## Undici Approaches
### 1) `undici` Client + `undici-retry` (recommended)
Use `undici` Client for requests and `undici-retry` for fixed retry attempts.
- Pros: explicit control + predictable retry behavior.
- Cons: extra dependency, must always consume response bodies.

### 2) `undici` Client with manual retry loop
Implement a small retry loop in the wrapper without `undici-retry`.
- Pros: fewer dependencies.
- Cons: more custom logic to maintain.

## Recommendation
Adopt `undici` Client with `undici-retry` as the primary HTTP stack. This keeps tight control over TLS and timeouts, improves unit test ergonomics via `MockAgent`, and gives a consistent retry mechanism while preserving existing behavior.

## Implementation Sketch (No Code Yet)
1. Create `src/client/http-client.ts` wrapper around `undici`:
   - Inputs: `baseURL`, `headers`, `timeout`, `retries`, `logger`, `tls` options.
   - Configure a shared Client or Pool with TLS settings and default headers.
   - Use `undici-retry` with fixed attempts; log each retry.
   - Parse JSON responses where applicable; preserve status and error payloads.
2. Update `src/client/obsidian-api.ts`:
   - Replace Axios instance with the undici wrapper.
   - Keep existing `safeCall` error shaping but adjust to undici response payloads.
3. Update `src/api/url-tester.ts`:
   - Use wrapper for `GET /` requests with short timeouts.
4. Update tests:
   - Use `undici` `MockAgent` to simulate responses in unit tests.
   - E2E host check: use undici client with TLS config.
5. Dependencies:
   - Remove `axios`, `axios-retry`, `axios-debug-log` from `package.json`.
   - Add `undici` and `undici-retry`.

## Risks and Considerations
- TLS: self-signed cert handling must remain explicit and safe (avoid global TLS overrides).
- Error mapping: ensure `safeCall` still surfaces `Error <code>: <message>` for REST API errors.
- Retries: current behavior retries all errors; keep same semantics or document change.
- Response bodies must always be consumed to avoid connection leaks with undici.

## Open Questions
Resolved:
- TLS bypass should be configurable (on/off) to allow future use of trusted certs.
- Use fixed retries to fail fast and surface Obsidian availability issues quickly.
- Provide a typed response helper in the wrapper to simplify caller parsing.

## Next Steps (If Approved)
1. Implement wrapper and update API client and URL tester.
2. Update tests to mock wrapper.
3. Remove Axios dependencies and adjust docs.
