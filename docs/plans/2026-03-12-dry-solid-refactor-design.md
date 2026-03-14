# DRY/SOLID Refactor Design

**Date:** 2026-03-12
**Scope:** All high + medium severity DRY, SRP, and DIP violations
**Breaking changes:** Yes (public API `EnhanceOptions` expanded; semver major bump)
**Approach:** Big-bang — all changes in one branch

---

## Problem Summary

The codebase has several recurring violations:

- Magic numbers (`86400`, `50`, `200`, `10000`) duplicated across 4+ files
- `console.log/warn/error` scattered in library code, preventing silent programmatic use
- Processor registration logic duplicated in `enhance.ts` and `index.ts`
- Temp-dir + enhance + cleanup pattern duplicated between `mcp-server.ts` and `http-server.ts`
- `ProcessorEngine` owns terminal UI concerns (`process.stdout.write`)
- No typed error hierarchy; mix of `process.exit`, thrown strings, and null returns
- HTTP server repeats JSON body-reading pattern 3×

---

## New Files

### `src/core/constants.ts`

Single source of truth for all magic values:

```typescript
export const DEFAULT_CACHE_TTL = 86400; // seconds (24h)
export const DEFAULT_CACHE_DIR = '.awesome-cache';
export const DEFAULT_REQUEST_TIMEOUT = 10000; // ms
export const DEFAULT_BADGE_STYLE = 'flat-square';
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 200;
```

### `src/core/logger.ts`

Injectable logger interface replacing all `console.*` calls in library code:

```typescript
export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
export class ConsoleLogger implements Logger {
  /* wraps console.* */
}
export class SilentLogger implements Logger {
  /* no-ops */
}
```

- CLI (`enhanceCommand`) uses `ConsoleLogger` — preserves existing output behaviour
- Library (`enhance()`) defaults to `SilentLogger` — no console noise in programmatic use
- Tests inject a capturing logger to assert on warnings without mocking globals

### `src/core/errors.ts`

Typed error hierarchy for consistent error handling across all interfaces:

```typescript
export class EnhanceError extends Error {}
export class NetworkError extends EnhanceError {
  statusCode?: number;
}
export class ConfigError extends EnhanceError {}
```

- `enhanceCommand` catches `EnhanceError` → `process.exit(1)` (CLI behaviour preserved)
- `enhance()` lets errors propagate (library callers handle them)
- MCP/HTTP servers catch and serialize to structured error responses

### `src/core/engine-factory.ts`

Eliminates duplicated processor registration in `enhance.ts` and `index.ts`:

```typescript
export interface EngineConfig {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  githubToken?: string | null;
  cacheTTL?: number;
  badgeStyle?: string;
  cacheDir?: string;
  logger?: Logger;
}

export function createEngine(config: EngineConfig): ProcessorEngine;
```

Both `enhanceCommand` and `enhance()` call `createEngine()` instead of manually building the engine.

### `src/core/runner.ts`

Shared enhance logic extracted from both `bin/mcp-server.ts` and `bin/http-server.ts`:

```typescript
export interface EnhanceArgs {
  add_metadata?: boolean;
  update_descriptions?: boolean;
  output_path?: string;
  dry_run?: boolean;
}
export interface EnhanceLocalArgs extends EnhanceArgs {
  file_path: string;
}
export interface EnhanceGithubArgs extends EnhanceArgs {
  github_url: string;
}

export interface EnhanceResult {
  success: boolean;
  output_file?: string;
  enhanced_content?: string;
  dry_run?: boolean;
  preview?: string;
}

export async function runEnhanceLocal(args: EnhanceLocalArgs): Promise<EnhanceResult>;
export async function runEnhanceGithub(args: EnhanceGithubArgs): Promise<EnhanceResult>;
```

All temp-dir creation, file I/O, and cleanup lives here. Both servers become thin adapters.

---

## Modified Files

### `src/core/config.ts`

- Replace literal `86400` with `DEFAULT_CACHE_TTL`

### `src/services/base-service.ts`

- Constructor gains `cacheDir` and `logger` parameters (with defaults)
- `handleError()` calls `this.logger.warn()` instead of `console.warn()`
- Replace literal `10000` with `DEFAULT_REQUEST_TIMEOUT`, `'.awesome-cache'` with `DEFAULT_CACHE_DIR`

### `src/services/github.ts` / `src/services/scraper.ts`

- Forward `logger` and `cacheDir` to `super()`

### `src/lib/processor-engine.ts`

- Remove `process.stdout.write` and `console.log` from `process()`
- Add optional `onProgress?: ProgressCallback` parameter to `process()`
- `type ProgressCallback = (processed: number, total: number, modified: number) => void`

### `src/lib/description-processor.ts`

- Replace literal `50` with `DESCRIPTION_MIN_LENGTH`

### `src/services/scraper.ts`

- Replace literal `200` with `DESCRIPTION_MAX_LENGTH`

### `src/commands/enhance.ts`

- Use `createEngine()` instead of manual registration
- Use `ConsoleLogger` explicitly
- Throw typed `EnhanceError` / `ConfigError` instead of calling `process.exit` mid-function
- Pass `onProgress` callback to `engine.process()` for stdout output

### `src/index.ts`

- `EnhanceOptions` gains `logger`, `cacheDir`, `onProgress` fields
- `enhance()` calls `createEngine()` and passes `onProgress` to `engine.process()`
- Export: `Logger`, `ConsoleLogger`, `SilentLogger`, `EnhanceError`, `NetworkError`, `ProgressCallback`

### `bin/http-server.ts`

- Add `readJsonBody(req): Promise<unknown>` helper — eliminates 3× repeated chunk-reading
- Replace `enhanceLocalFile()` and `enhanceGithubUrl()` with calls to `runEnhanceLocal()` / `runEnhanceGithub()` from `runner.ts`

### `bin/mcp-server.ts`

- Replace inline tool implementations with calls to `runEnhanceLocal()` / `runEnhanceGithub()` from `runner.ts`

---

## Public API Changes

```typescript
// Before
export interface EnhanceOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  githubToken?: string | null;
  cacheTTL?: number;
  badgeStyle?: string;
}

// After
export interface EnhanceOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  githubToken?: string | null;
  cacheTTL?: number; // default: DEFAULT_CACHE_TTL
  badgeStyle?: string; // default: DEFAULT_BADGE_STYLE
  cacheDir?: string; // NEW — default: DEFAULT_CACHE_DIR
  logger?: Logger; // NEW — default: SilentLogger
  onProgress?: ProgressCallback; // NEW — default: undefined
}
```

New exports: `Logger`, `ConsoleLogger`, `SilentLogger`, `EnhanceError`, `NetworkError`, `ProgressCallback`
No existing exports removed.

---

## What Is Not Changed

- `BadgeGenerator` badge type registry (low priority — internal detail)
- MCP tool schema definitions (hardcoded but stable)
- HTTP endpoint routing pattern (if-chain; acceptable at current scale)
- `awesome-lint` integration behaviour
- All existing test interfaces
