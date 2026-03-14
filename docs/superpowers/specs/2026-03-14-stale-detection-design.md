# Stale/Archived Repo Detection — Design Spec
**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Add a `--detect-stale` flag to `awesome-enhancer` that detects archived, disabled, and deleted (404) GitHub repositories in an awesome list. When enabled, stale entries receive a red shields.io badge appended in-place, and a summary report is printed to stdout (and returned in HTTP/MCP responses).

**Stale signals:**
- `archived: true` — GitHub marks repo as read-only archive
- `disabled: true` — GitHub has disabled the repo
- HTTP 404 — repo no longer exists

**Explicitly excluded:** Time-based heuristics (last commit date, star decline). Only official GitHub signals.

---

## Prerequisite: `RepoMetadata` interface update

Before implementing `StaleProcessor`, add the missing fields to `RepoMetadata` in `src/services/github.ts`:

```ts
export interface RepoMetadata {
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  archived: boolean;   // ADD
  disabled: boolean;   // ADD
  [key: string]: unknown;
}
```

Without these, `metadata.archived` has type `unknown` and TypeScript will reject it.

---

## Architecture

### `Processor` interface change (`src/lib/processor-engine.ts`)

`execute()` return type changes from `boolean` to a new `ProcessorResult` object. This lets `ProcessorEngine` collect stale entries centrally without constructor injection or making `engine-factory.ts` an Effect.

```ts
// New — in processor-engine.ts
export interface ProcessorResult {
  modified: boolean
  staleEntry?: StaleEntry  // only set by StaleProcessor
}

export interface Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, GitHubService | ScraperService>
}
```

`MetadataProcessor` and `DescriptionProcessor` return `{ modified: true/false }` with no `staleEntry`. `StaleProcessor` returns `{ modified: true, staleEntry: { ... } }` when stale, `{ modified: false }` otherwise.

`ProcessorEngine.process()` is updated to:
1. Create `staleEntriesRef = yield* Ref.make<StaleEntry[]>([])` at the top of the Effect.
2. Per link, collect `staleEntry` from each processor result: `if (result.staleEntry) yield* Ref.update(staleEntriesRef, es => [...es, result.staleEntry!])`.
3. After `Effect.all(linkEffects)`, read `yield* Ref.get(staleEntriesRef)`.
4. Return `{ content: stringified, staleEntries }` instead of bare `string`.

`engine-factory.ts` remains a synchronous function — no `Effect.gen` conversion needed.

---

### New: `StaleProcessor` (`src/lib/stale-processor.ts`)

Registered in `engine-factory.ts` when `options.detectStale === true`.

**Per-link logic (per GitHub link in AST):**

1. Skip non-GitHub URLs entirely.
2. Check for existing stale badge — skip if text node after the link contains `img.shields.io/badge/status-archived` (idempotency sentinel — see Idempotency section).
3. Call `GitHubService.fetchRepoMetadata(owner, repo)` via **`Effect.either`** (not `Effect.option`) to keep the error channel observable:

```ts
Effect.either(github.fetchRepoMetadata(owner, repo))
```

- `Right(metadata)` with `archived: true` → reason `'archived'`
- `Right(metadata)` with `disabled: true` → reason `'disabled'`
- `Right(metadata)` healthy → return `{ modified: false }`
- `Left(NetworkError { statusCode: 404 })` → reason `'not-found'`
- `Left(NetworkError { statusCode: !== 404 | undefined })` → return `{ modified: false }` (skip silently)

When both `archived` and `disabled` are true, `'archived'` takes precedence (first field wins).

4. If stale: append badge to AST, return `{ modified: true, staleEntry: { name, url, reason } }`.

**Badge format:**
```
![archived](https://img.shields.io/badge/status-archived-red?style=flat-square)
```
Badge label is always `"archived"` regardless of reason — signals "do not use" to readers. Uses `DEFAULT_BADGE_STYLE` constant from `constants.ts`.

**Cache:** `fetchRepoMetadata` is cached by `CacheService`. When `--add-metadata` and `--detect-stale` are both enabled, the second processor call per link is a cache hit — zero extra API requests.

---

## Idempotency

The idempotency check inspects the text node immediately after the link node in the AST. If that text node's value contains `img.shields.io/badge/status-archived`, the entry is already marked and processing is skipped. This string is specific enough to avoid false positives from other shields.io badges (language, stars, etc.) added by `MetadataProcessor`.

---

## Type Changes

### `StaleEntry` (new, exported from `src/lib/stale-processor.ts`)
```ts
export interface StaleEntry {
  name: string   // e.g. "axios/axios-mock-adapter"
  url: string    // original GitHub URL
  reason: 'archived' | 'disabled' | 'not-found'
}
```

### `ProcessResult` (new, exported from `src/lib/stale-processor.ts`)
```ts
export interface ProcessResult {
  content: string
  staleEntries: StaleEntry[]
}
```

`ProcessorEngine.process()` return type changes from `Effect<string, AppError>` to `Effect<ProcessResult, AppError>`.

`enhance()` in `src/index.ts` changes from `Effect<string, AppError>` to `Effect<ProcessResult, AppError>`.

`ProcessResult` and `StaleEntry` must be added to the re-exports in `src/index.ts` for programmatic consumers.

---

## Schema & Options Changes

### `src/core/schemas.ts`
Add to `EnhanceOptionsSchema`:
```ts
detectStale: z.boolean().default(false)
```

Add `detect_stale: z.boolean().default(false)` to **both** `HttpEnhanceLocalSchema` and `HttpEnhanceGithubSchema`. Without this, the HTTP and MCP surfaces cannot expose stale detection (they parse their own schemas separately from `EnhanceOptionsSchema`).

`runner.ts` must also pass `detect_stale` through when building the options object forwarded to `enhance()`:
```ts
// In runEnhanceLocal and runEnhanceGithub:
detectStale: args.detect_stale
```

### `src/commands/enhance.ts`
Add `detectStale?: boolean` to `EnhanceCommandOptions` interface.

Update the existing "no options" guard to include `detectStale`:
```ts
// Before:
if (!options.addMetadata && !options.updateDescriptions) { throw ... }

// After:
if (!options.addMetadata && !options.updateDescriptions && !options.detectStale) { throw ... }
```

### `bin/cli.tsx`
Three changes required:
1. Add `detectStale?: boolean` to the `CliOptions` interface.
2. Add `--detect-stale` to `parseArgs()`, parsed identically to `--add-metadata`.
3. Update the no-options guard at line ~345 (same pattern as `enhance.ts`):
```ts
// Before:
if (!options.addMetadata && !options.updateDescriptions) { ... }

// After:
if (!options.addMetadata && !options.updateDescriptions && !options.detectStale) { ... }
```

---

## Caller Updates

| File | Change |
|---|---|
| `src/commands/enhance.ts` | Destructure `{ content, staleEntries }`; print stale report table |
| `src/core/runner.ts` | Destructure `{ content, staleEntries }`; update `EnhanceResult` interface to add `stale_entries: StaleEntry[]`; include in response |
| `bin/http-server.ts` | Pass `stale_entries` in JSON response |
| `bin/mcp-server.ts` | Include stale entries in MCP text content |
| `src/index.ts` | Update return type; add `ProcessResult`, `StaleEntry` to re-exports |
| `tests/index.test.ts` | Update return type assertions to expect `ProcessResult` |
| `tests/core/processor-engine.test.ts` | Expect `ProcessResult` shape from `process()` |
| `tests/core/runner.test.ts` | Expect `stale_entries: []` on healthy repos; non-empty on stale repos |

### Updated `EnhanceResult` in `src/core/runner.ts`
```ts
interface EnhanceResult {
  success: boolean
  output_file?: string
  enhanced_content?: string   // now mapped from ProcessResult.content
  preview?: string            // now mapped from ProcessResult.content on dry-run
  stale_entries: StaleEntry[] // new
  error?: string
}
```

---

## CLI Report Output

After processing, if stale entries exist, print to stdout:

```
⚠️  Stale entries detected (2):
  • axios/axios-mock-adapter  [archived]   https://github.com/axios/axios-mock-adapter
  • old/dead-lib              [not-found]  https://github.com/user/dead-lib
```

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Non-404 / undefined statusCode network error | Skip silently (`Left` from `Effect.either`, statusCode missing or ≠ 404) |
| `Left(NetworkError { statusCode: 404 })` | Mark as `not-found`, append badge |
| `archived: true` | Mark as `archived`, append badge |
| `disabled: true` | Mark as `disabled`, append badge |
| Both `archived` and `disabled` true | Mark as `archived` (first field wins) |
| Non-GitHub URL | Skip entirely |
| Badge already present (`img.shields.io/badge/status-archived` in text node) | Skip (idempotent) |

---

## Testing

### New: `tests/lib/stale-processor.test.ts`

| Scenario | Expected |
|---|---|
| Archived repo (`archived: true`) | Badge appended; `staleEntries` has entry with reason `'archived'` |
| Disabled repo (`disabled: true`) | Badge appended; `staleEntries` has entry with reason `'disabled'` |
| Both archived and disabled | Badge appended; reason is `'archived'` |
| `Left(NetworkError { statusCode: 404 })` | Badge appended; reason `'not-found'` |
| `Left(NetworkError { statusCode: 500 })` | No badge; no stale entry |
| `Left(NetworkError { statusCode: undefined })` | No badge; no stale entry |
| Non-GitHub URL | No badge; no stale entry |
| Already has stale badge | Idempotent — badge not duplicated |
| Healthy repo | No badge; no stale entry |
| `--add-metadata` + `--detect-stale` simultaneously | `CacheService.set` called once, `CacheService.get` called twice — verifies cache hit |

### Updated tests
- `tests/core/processor-engine.test.ts` — expect `ProcessResult` from `process()`
- `tests/index.test.ts` — expect `ProcessResult` from `enhance()`
- `tests/core/runner.test.ts` — expect `stale_entries: []` in healthy response; non-empty when stale processor active
