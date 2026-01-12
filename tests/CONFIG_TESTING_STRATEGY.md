# Configuration Testing Strategy

This document explains the comprehensive testing approach for catching missing or inconsistent environment variable configurations.

## The Problem We're Solving

The `MCP_HTTP_TOKEN` environment variable was:
- ✅ Documented in CLAUDE.md and readme.md
- ✅ Used in examples and docker-compose.yaml
- ❌ **NOT** declared in `NodeJS.ProcessEnv` interface
- ❌ **NOT** read by `createTransportConfig()`
- ❌ **NOT** added to `Transport.HttpConfig` type

This slipped through because our tests only validated:
- That schemas accept certain field structures
- That basic config loading works for known-good cases

## Three-Layer Testing Strategy

### Layer 1: Schema Consistency Tests
**File:** `tests/config.schema-validation.test.ts`

**Purpose:** Ensure type compatibility between config loader types and transport types

**What it catches:**
- Missing fields in `Transport.Config` types vs `TransportConfig` types
- Type incompatibilities between config loader and transport implementations
- Missing optional fields like `auth` in transport configurations

**Example:**
```typescript
test("Transport.HttpConfig should be compatible with HttpConfig (transports)", () => {
  // This will fail at compile-time if types are incompatible
  const transportHttpConfig: HttpConfig = {
    auth: { enabled: true, token: "secret" }
  }
  const configLoaderType: Transport.HttpConfig = transportHttpConfig
  // ❌ Fails if Transport.HttpConfig is missing 'auth' field
})
```

### Layer 2: Environment Variable Integration Tests
**File:** `tests/config.env-vars.test.ts`

**Purpose:** Ensure all environment variables are actually read and used correctly

**What it catches:**
- Environment variables that are declared but not read
- Incorrect parsing or transformation of env var values
- Missing default values or validation
- Edge cases (empty strings, whitespace, undefined)

**Example:**
```typescript
test("should read MCP_HTTP_TOKEN and enable HTTP auth", () => {
  process.env.MCP_HTTP_TOKEN = "secret-token-123"
  const config = loadAppConfig()

  expect(config.transports.http.auth?.enabled).toBe(true)
  expect(config.transports.http.auth?.token).toBe("secret-token-123")
  // ❌ Fails if loadAppConfig() doesn't read MCP_HTTP_TOKEN
})
```

### Layer 3: Documentation Consistency Tests
**File:** `tests/config.documentation-consistency.test.ts`

**Purpose:** Ensure documentation matches implementation

**What it catches:**
- Environment variables documented but not implemented
- Environment variables implemented but not documented
- README examples using undeclared variables
- Mismatch between ProcessEnv declarations and actual usage

**Example:**
```typescript
test("should declare all environment variables documented in CLAUDE.md", () => {
  const documentedVars = parseDocumentation("CLAUDE.md")
  const declaredVars = parseProcessEnvInterface("src/config.ts")

  const missing = documentedVars.filter(v => !declaredVars.has(v))

  expect(missing).toEqual([])
  // ❌ Fails if MCP_HTTP_TOKEN is in docs but not in ProcessEnv
})
```

## How to Use This Strategy

### When Adding a New Environment Variable

1. **Declare it in `src/config.ts` ProcessEnv interface**
   ```typescript
   declare namespace NodeJS {
     interface ProcessEnv {
       MCP_HTTP_TOKEN?: string  // ← Add here
     }
   }
   ```

2. **Add it to the config type** (`src/config.types.ts` or `src/transports/types.ts`)
   ```typescript
   export interface HttpConfig {
     auth?: {
       enabled: boolean
       token?: string
     }
   }
   ```

3. **Read it in `createTransportConfig()`**
   ```typescript
   http: {
     auth: env.MCP_HTTP_TOKEN ? {
       enabled: true,
       token: env.MCP_HTTP_TOKEN
     } : undefined
   }
   ```

4. **Document it in CLAUDE.md**
   ```markdown
   - `MCP_HTTP_TOKEN` - Bearer token for HTTP authentication
   ```

5. **Write integration test in `tests/config.env-vars.test.ts`**
   ```typescript
   test("should read MCP_HTTP_TOKEN and enable HTTP auth", () => {
     // Test implementation
   })
   ```

6. **Run all three test layers**
   ```bash
   bun test tests/config.schema-validation.test.ts
   bun test tests/config.env-vars.test.ts
   bun test tests/config.documentation-consistency.test.ts
   ```

### When Modifying Existing Variables

Run all three test layers to ensure:
- Type consistency is maintained
- Behavior changes are intentional
- Documentation is updated

## Test Execution

```bash
# Run all config tests
bun test tests/config*.test.ts

# Run specific layer
bun test tests/config.env-vars.test.ts

# Watch mode during development
bun test --watch tests/config*.test.ts
```

## Coverage Checklist

For each environment variable, ensure:
- [ ] Declared in `NodeJS.ProcessEnv` interface
- [ ] Added to appropriate config type
- [ ] Read in `createTransportConfig()` or `loadAppConfig()`
- [ ] Documented in CLAUDE.md
- [ ] Has integration test verifying it works end-to-end
- [ ] Has edge case tests (empty, undefined, whitespace)
- [ ] Example usage in readme.md (if relevant)

## Current Test Results

The tests correctly identify the missing `MCP_HTTP_TOKEN` implementation:

```
❌ config.documentation-consistency.test.ts
   - MCP_HTTP_TOKEN documented but not declared

❌ config.env-vars.test.ts
   - MCP_HTTP_TOKEN not read by loadAppConfig()

❌ config.schema-validation.test.ts
   - Transport.HttpConfig missing auth field
```

## Next Steps

1. Fix the missing `MCP_HTTP_TOKEN` implementation
2. Run tests to verify fix
3. Consider adding similar tests for other configuration areas
4. Add pre-commit hook to run config tests automatically
