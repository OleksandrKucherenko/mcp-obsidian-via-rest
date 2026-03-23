# Bun `mock.module()` Isolation Issue

## Summary

`mock.module()` overrides in Bun **persist for the entire worker lifetime** and are
**not isolated between test files** that share the same worker process.
`mock.restore()` clears function-level mocks (`mock()`, `spyOn()`) but does **not**
unregister `mock.module()` overrides. This causes test failures that are
order-dependent and hard to diagnose.

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

This is a known, long-standing bug. All issues below are open as of March 2026.

### Issues

| # | Title | Opened | Status |
|---|---|---|---|
| [#7823](https://github.com/oven-sh/bun/issues/7823) | `mock.restore()` for `mock.module()` does not work as expected | Dec 2023 | Open |
| [#12823](https://github.com/oven-sh/bun/issues/12823) | Bun mocks to be scoped to test file | Jul 2024 | Open |
| [#6040](https://github.com/oven-sh/bun/issues/6040) | `mock` and `spyOn` are not reset after each test | Sep 2023 | Open |

### PRs in progress (not yet merged)

| # | Title | Opened |
|---|---|---|
| [#27823](https://github.com/oven-sh/bun/pull/27823) | fix(test): `mock.module()` replacements no longer leak across test files | Mar 2026 |
| [#28077](https://github.com/oven-sh/bun/pull/28077) | fix(test): clear `mock.module()` mocks between test files | Mar 2026 |
| [#25844](https://github.com/oven-sh/bun/pull/25844) | feat(bun:test): module restoration and partial module mocking | Jan 2026 |

PR #27823 is the most complete fix: it introduces a dedicated `moduleMocks` map,
scope-based lifecycle management (`beginModuleMockScope` / `endModuleMockScope`),
and makes `mock.restore()` properly revert `mock.module()` overrides by saving
original export values before patching.

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
