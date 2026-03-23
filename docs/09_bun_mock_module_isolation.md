# Bun `mock.module()` Isolation Issue

> **Bug present since:** Bun v1.0.3 (September 2023)
> **Still broken as of:** Bun v1.3.10 (March 2026)
> **Upstream tracking:** [#7823](https://github.com/oven-sh/bun/issues/7823), [#12823](https://github.com/oven-sh/bun/issues/12823), [#6040](https://github.com/oven-sh/bun/issues/6040)

## Summary

`mock.module()` overrides in Bun **persist for the entire process lifetime** and are
**not isolated between test files** that share the same Bun process.
`mock.restore()` clears function-level mocks (`mock()`, `spyOn()`) but does **not**
unregister `mock.module()` overrides. This causes test failures that are
order-dependent and very hard to diagnose — tests pass when run individually
(`bun test file.test.ts`) but silently fail when run together (`bun test`).

## Root Cause

All test files running in the same `bun test` invocation share a single
`GlobalObject`. The module registry maps (`virtualModules`, `esmRegistryMap`,
`requireMap`) are **never cleaned between files**. When `mock.module("path", factory)`
is called, its entry is written into the shared registry and stays there until the
process exits — no per-file scope, no cleanup hook.

## Observed Behaviour

When multiple test files are assigned to the same Bun worker (which happens
whenever the file count exceeds the number of CPU cores), module-level mocks leak
across file boundaries:

```
Worker N
├── self-healing.test.ts  ← mock.module("./url-tester", stubbed)
│     afterAll: mock.restore()  ← does NOT unregister the module override
└── url-tester.test.ts    ← imports "./url-tester" — gets the stub, not the real code
      ✗ tests pass stub behaviour, not production code
```

The same problem applies in reverse: `url-tester.test.ts` mocks `axios` so that
every request succeeds. If `obsidian-api.e2e.test.ts` runs in the same worker
*after* `url-tester.test.ts`, the e2e availability check (`isHostAvailable`) uses
the mocked axios and always returns `true`, causing all e2e describe blocks to run
instead of being skipped.

### Concrete failures seen in this project

| File that sets mock | Mocked module | Affected file | Symptom |
|---|---|---|---|
| `tests/server/health.test.ts` | `src/api/url-tester` | `tests/api/url-tester.test.ts` | `selectBestUrl` returns wrong URL (stub ignores `success` flag) |
| `tests/api/self-healing.test.ts` | `src/api/url-tester` | `tests/api/url-tester.test.ts` | Same as above |
| `tests/api/url-tester.test.ts` | `axios` | `tests/obsidian-api.e2e.test.ts` | `isHostAvailable` always true → e2e tests run without real Obsidian → 5 failures |

## Why `mock.restore()` Does Not Help

`mock.restore()` is documented to restore **function** mocks created with
`jest.fn()` / `mock()` / `spyOn()` to their original implementations. It does not
touch the module registry. Once `mock.module("some/path", factory)` has been
called, that path stays remapped in the worker's module registry until the worker
process exits.

```typescript
// This clears spy state — works fine
mock.restore()

// This has NO EFFECT on mock.module() registrations:
// The module registry entry for "../../src/api/url-tester" remains overridden.
```

## Workarounds

### ✅ Recommended: Process isolation (what this project uses)

Split tests that *test the real implementation* of a module from tests that *mock
that module* into separate `bun test` invocations. Each invocation is a fresh
process with a clean module registry.

```json
// package.json
"test": "bun test ./src && bun test ./tests"
```

- `bun test ./src` — unit tests for production code, no `mock.module()` on sibling
  modules, runs in its own process
- `bun test ./tests` — integration/higher-level tests that freely mock modules,
  runs in a completely separate process

Files that use `mock.module()` can only contaminate other files in the **same**
`bun test` invocation.

### ❌ Does not work: `afterAll(() => mock.restore())`

This cleans up `mock()` / `spyOn()` state but leaves `mock.module()` registrations
in place for the remainder of the worker's lifetime.

### ⚠️ Partial workaround: `--preload`

Using a preload script to set up and tear down mocks via Bun's lifecycle hooks can
reduce (but not fully eliminate) cross-file contamination when files share a worker.

### ⚠️ Partial workaround: co-locate test with source

Placing the test for a module next to its source file (e.g. `src/api/url-tester.test.ts`)
means it is discovered and assigned to workers alongside other `./src` tests, which
typically do not mock it. This reduces collision probability but does not guarantee
isolation when many files share a worker.

## Bun Issue Tracking

This is a known, long-standing bug. All issues below remain open as of March 2026.

### Issues

| # | Title | Opened | Status |
|---|---|---|---|
| [#6040](https://github.com/oven-sh/bun/issues/6040) | `mock` and `spyOn` are not reset after each test | Sep 2023 | Open |
| [#7823](https://github.com/oven-sh/bun/issues/7823) | `mock.restore()` for `mock.module()` does not work as expected | Dec 2023 | Open (56 comments) |
| [#12823](https://github.com/oven-sh/bun/issues/12823) | Bun mocks to be scoped to test file | Jul 2024 | Open |
| [#25712](https://github.com/oven-sh/bun/issues/25712) | `mock.module()` in consuming package leaks into dependency package tests (monorepo) | Dec 2025 | Closed as duplicate of #12823 |

Issue #12823 contains the most community discussion. Multiple reporters described
abandoning Bun for test suites that rely on module-level mocking.

### PRs in progress (not yet merged as of March 2026)

| # | Title | Author | Opened |
|---|---|---|---|
| [#25844](https://github.com/oven-sh/bun/pull/25844) | feat(bun:test): module restoration and partial module mocking | guizaodev | Jan 2026 |
| [#27823](https://github.com/oven-sh/bun/pull/27823) | fix(test): `mock.module()` replacements no longer leak across test files | ivanfilhoz | Mar 2026 |
| [#28077](https://github.com/oven-sh/bun/pull/28077) | fix(test): clear `mock.module()` mocks between test files and in `mock.restore()` | tdeaks | Mar 2026 |

**PR #27823** and **PR #28077** are the most relevant competing approaches. Both
introduce `beginModuleMockScope()` / `endModuleMockScope()` lifecycle hooks called
by the test runner around each file, and both make `mock.restore()` properly revert
`mock.module()` overrides. PR #27823 also separates `virtualModules`
(plugin-registered) from `moduleMocks` (test-time) in storage. PR #25844 adds a
Vitest-compatible `mock.restoreModule()` API and partial mocking via `importOriginal`.

## When to Expect the Fix

Once any of the above PRs merges and ships in a Bun release:
- `mock.module()` will be automatically scoped to the test file that called it
- `mock.restore()` will properly revert module-level overrides
- The process-isolation split in this project's `test` script will become optional
  hygiene rather than a necessity

Until then, the workaround described below is required.

## Impact on This Project

The CI failure in
[run #23425707014](https://github.com/OleksandrKucherenko/mcp-obsidian-via-rest/actions/runs/23425707014/job/68140206074)
was caused (in part) by this Bun limitation. The pre-flight job ran `bun test`
with no arguments, which put all test files into the same pool of workers, allowing
`mock.module()` overrides from `health.test.ts` to contaminate `url-tester.test.ts`.

### Applied fixes

1. **Moved** `tests/api/url-tester.test.ts` → `src/api/url-tester.test.ts` so it
   runs in the `bun test ./src` process, fully isolated from the files in `./tests`
   that mock `url-tester`.
2. **Split** the `test` npm script into two sequential invocations:
   `bun test ./src && bun test ./tests`.
3. **Added** `afterAll(() => mock.restore())` to `health.test.ts` and
   `self-healing.test.ts` as a best-effort cleanup for function-level mocks (does
   not fix module mocks, but is still good hygiene).
4. **Added** Docker availability guard to `mcp.stdio.containers.test.ts` so
   container tests self-skip instead of failing when Docker is not available.
