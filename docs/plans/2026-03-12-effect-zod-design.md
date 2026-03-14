# Effect + Zod Full Integration Design

**Date:** 2026-03-12
**Scope:** Full Effect migration + Zod validation, merged with DRY/SOLID refactor
**Supersedes:** `2026-03-12-dry-solid-refactor-design.md` (absorbed into this design)
**Breaking changes:** Yes — `enhance()` now returns `Effect<string, AppError>` (semver major)
**Approach:** Big-bang — all changes in one branch

---

## Goals

1. All async operations return `Effect<A, E, R>` — no `Promise<T | null>` anti-pattern
2. All external inputs validated with Zod at system boundaries
3. Dependency injection via Effect Layers — no constructor-injected logger/cache
4. Typed error channel via `Data.TaggedError` — no `process.exit` in library code
5. All DRY/SOLID violations from prior analysis resolved

---

## New Packages

```
effect          — Effect runtime, Context, Layer, Data, Option
zod             — Schema validation
zod-to-json-schema — Derive MCP tool inputSchema from Zod schemas (eliminates duplication)
```

---

## New Files

### `src/core/schemas.ts`

All external input validation in one place. Single source of truth — MCP/HTTP schemas derived from these.

```typescript
export const ConfigSchema = z.object({
  githubToken: z.string().optional(),
  cacheTTL: z.number().default(86400),
});

export const EnhanceOptionsSchema = z.object({
  addMetadata: z.boolean().default(false),
  updateDescriptions: z.boolean().default(false),
  githubToken: z.string().nullable().default(null),
  cacheTTL: z.number().default(86400),
  badgeStyle: z.string().default('flat-square'),
  cacheDir: z.string().default('.awesome-cache'),
});

export const HttpEnhanceLocalSchema = z.object({
  file_path: z.string(),
  add_metadata: z.boolean().default(true),
  update_descriptions: z.boolean().default(false),
  output_path: z.string().optional(),
  dry_run: z.boolean().default(false),
});

export const HttpEnhanceGithubSchema = z.object({
  github_url: z.string().url(),
  add_metadata: z.boolean().default(true),
  update_descriptions: z.boolean().default(false),
  output_path: z.string().default('enhanced-readme.md'),
  dry_run: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;
export type EnhanceOptions = z.infer<typeof EnhanceOptionsSchema>;
```

### `src/core/errors.ts`

`Data.TaggedError` replaces `class X extends Error`. Gives `_tag` discriminant for exhaustive matching, structural equality, and full stack traces.

```typescript
import { Data } from 'effect';

export class NetworkError extends Data.TaggedError('NetworkError')<{
  url: string;
  statusCode?: number;
  message: string;
}> {}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  message: string;
}> {}

export class EnhanceError extends Data.TaggedError('EnhanceError')<{
  message: string;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  message: string;
}> {}

export type AppError = NetworkError | ConfigError | EnhanceError | ValidationError;
```

### `src/core/constants.ts`

Single source of truth for magic values (replaces all inline literals).

```typescript
export const DEFAULT_CACHE_TTL = 86400;
export const DEFAULT_CACHE_DIR = '.awesome-cache';
export const DEFAULT_REQUEST_TIMEOUT = 10000;
export const DEFAULT_BADGE_STYLE = 'flat-square';
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 200;
```

### `src/core/engine-factory.ts`

Registers processors based on options. Services are not constructed here — they come from Layers.

```typescript
export function createEngine(options: {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
}): ProcessorEngine {
  const engine = new ProcessorEngine();
  if (options.addMetadata) engine.register(new MetadataProcessor());
  if (options.updateDescriptions) engine.register(new DescriptionProcessor());
  return engine;
}
```

### `src/core/app-layer.ts`

Assembles the full application Layer from parsed `EnhanceOptions`. Entry points call this once.

```typescript
export function buildAppLayer(
  options: EnhanceOptions,
): Layer.Layer<GitHubService | ScraperService | LoggerService | CacheService> {
  const cache = FileCacheLive(options.cacheDir, options.cacheTTL);
  const logger = SilentLive; // library default; CLI overrides with ConsoleLive
  const github = GitHubLive(options.githubToken).pipe(Layer.provide(cache), Layer.provide(logger));
  const scraper = ScraperLive.pipe(Layer.provide(cache), Layer.provide(logger));
  return Layer.mergeAll(github, scraper, logger, cache);
}
```

### `src/core/runner.ts`

Shared enhance logic for HTTP and MCP servers. Eliminates the duplicated temp-dir + enhance + cleanup pattern.

```typescript
export interface EnhanceResult {
  success: boolean;
  output_file?: string;
  enhanced_content?: string;
  dry_run?: boolean;
  preview?: string;
}

export async function runEnhanceLocal(
  args: z.infer<typeof HttpEnhanceLocalSchema>,
): Promise<EnhanceResult>;
export async function runEnhanceGithub(
  args: z.infer<typeof HttpEnhanceGithubSchema>,
): Promise<EnhanceResult>;
```

### `src/services/logger.ts`

Effect `Context.Tag` — replaces scattered `console.*` calls in library code.

```typescript
export class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    log: (msg: string) => Effect.Effect<void>;
    warn: (msg: string) => Effect.Effect<void>;
    error: (msg: string) => Effect.Effect<void>;
  }
>() {}

export const ConsoleLive = Layer.succeed(LoggerService, {
  log: (msg) => Effect.sync(() => console.log(msg)),
  warn: (msg) => Effect.sync(() => console.warn(msg)),
  error: (msg) => Effect.sync(() => console.error(msg)),
});

export const SilentLive = Layer.succeed(LoggerService, {
  log: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
});
```

---

## Modified / Replaced Files

### `src/services/cache.ts` (replaces `src/core/cache.ts`)

Becomes an Effect `CacheService` Layer. `FileCache` is the existing implementation behind the interface.

```typescript
export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    get: <T>(key: string) => Effect.Effect<Option.Option<T>>;
    set: <T>(key: string, data: T) => Effect.Effect<void>;
  }
>() {}

export const FileCacheLive = (cacheDir: string, ttl: number): Layer.Layer<CacheService> =>
  Layer.effect(
    CacheService,
    Effect.sync(() => makeFileCache(cacheDir, ttl)),
  );
```

### `src/services/base-service.ts` → **DELETED**

Replaced entirely by `CacheService` + `LoggerService` Layers.

### `src/services/github.ts`

Becomes an Effect `Context.Tag`. Methods return `Effect<T, NetworkError>` — no more `null` on failure.

```typescript
export class GitHubService extends Context.Tag('GitHubService')<
  GitHubService,
  {
    fetchRepoMetadata: (owner: string, repo: string) => Effect.Effect<RepoMetadata, NetworkError>;
    fetchRepoReadme: (owner: string, repo: string) => Effect.Effect<string, NetworkError>;
    getRateLimitStatus: () => Effect.Effect<Option.Option<string>>;
  }
>() {}

export const GitHubLive = (
  token: string | null,
): Layer.Layer<GitHubService, never, CacheService | LoggerService> =>
  Layer.effect(
    GitHubService,
    Effect.gen(function* () {
      const cache = yield* CacheService;
      const logger = yield* LoggerService;
      return {
        fetchRepoMetadata: (owner, repo) =>
          Effect.tryPromise({
            try: () =>
              axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
                headers,
                timeout: DEFAULT_REQUEST_TIMEOUT,
              }),
            catch: (e) =>
              new NetworkError({ url: `...`, statusCode: e.response?.status, message: e.message }),
          }),
        // ...
      };
    }),
  );
```

### `src/services/scraper.ts`

Same pattern as `github.ts`. Description methods return `Effect.Effect<Option.Option<string>, NetworkError>` — `None` for not found, `Some` for found, `NetworkError` for failure.

```typescript
export class ScraperService extends Context.Tag('ScraperService')<
  ScraperService,
  {
    fetchGitHubDescription: (owner: string, repo: string) => Effect.Effect<Option.Option<string>, NetworkError>
    fetchWebsiteDescription: (url: string) => Effect.Effect<Option.Option<string>, NetworkError>
  }
>() {}

export const ScraperLive: Layer.Layer<ScraperService, never, CacheService | LoggerService> = ...
```

### `src/lib/processor-engine.ts`

`process()` returns `Effect`. Progress output goes through `LoggerService`.

```typescript
export interface Processor {
  execute(linkNode: LinkNode, parent: any, index: number): Effect.Effect<boolean, NetworkError>;
}

export class ProcessorEngine {
  process(content: string): Effect.Effect<string, EnhanceError | NetworkError, LoggerService>;
}
```

### `src/lib/metadata-processor.ts` and `src/lib/description-processor.ts`

`execute()` returns `Effect`, yields `GitHubService` / `ScraperService` directly — no constructor injection.

```typescript
export class MetadataProcessor implements Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, GitHubService>;
}
```

### `src/commands/enhance.ts`

Uses `Effect.runPromise` at the CLI boundary. Catches `AppError` and calls `process.exit(1)`.

```typescript
export async function enhanceCommand(fileOrUrl: string | undefined, options: EnhanceOptions) {
  const program = Effect.gen(function* () {
    const engine = createEngine(options);
    const enhanced = yield* engine.process(content);
    // ... write output
  });

  await Effect.runPromise(program.pipe(Effect.provide(buildAppLayer(options)))).catch(
    (error: AppError) => {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    },
  );
}
```

### `src/index.ts`

`enhance()` returns `Effect`. Library callers use `Effect.runPromise`.

```typescript
export function enhance(
  content: string,
  options: Partial<EnhanceOptions> = {},
): Effect.Effect<string, AppError, never> {
  const parsed = EnhanceOptionsSchema.parse(options);
  const engine = createEngine(parsed);
  return engine.process(content).pipe(Effect.provide(buildAppLayer(parsed)));
}

// New exports
export { LoggerService, ConsoleLive, SilentLive };
export { NetworkError, ConfigError, EnhanceError, ValidationError, type AppError };
export { GitHubService, ScraperService, CacheService };
export { FileCacheLive, GitHubLive, ScraperLive };
```

### `bin/http-server.ts`

`readJsonBody` helper eliminates 3× repeated chunk-reading. Zod parses bodies. Calls `runner.ts`.

```typescript
async function readJsonBody(req: http.IncomingMessage): Promise<unknown>;

// Route handler becomes 3 lines:
const body = await readJsonBody(req);
const args = HttpEnhanceLocalSchema.parse(body);
sendJson(res, 200, await runEnhanceLocal(args));
```

### `bin/mcp-server.ts`

Tool `inputSchema` derived from Zod schemas via `zodToJsonSchema` — eliminates manual duplication. Tool handlers call `runner.ts`.

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

// inputSchema is now:
inputSchema: zodToJsonSchema(HttpEnhanceLocalSchema);
```

---

## Data Flow (After)

```
User Input
    ↓
Zod.parse() → ValidationError if invalid
    ↓
createEngine(options) → ProcessorEngine
    ↓
buildAppLayer(options) → Layer<GitHubService | ScraperService | LoggerService | CacheService>
    ↓
engine.process(content).pipe(Effect.provide(layer))
    ↓  [Effect runtime]
ProcessorEngine visits links → runs Processors in parallel (Effect.all)
    ├─ MetadataProcessor → yield* GitHubService → Effect.tryPromise(axios) → NetworkError | RepoMetadata
    └─ DescriptionProcessor → yield* ScraperService → Effect.tryPromise(axios) → NetworkError | Option<string>
    ↓
Effect<string, AppError, never>
    ↓
Effect.runPromise() → Promise<string>  (at CLI / HTTP / MCP boundary)
```

---

## What Is Not Changed

- `BadgeGenerator` (no side effects, no services needed)
- `GitService` (static filesystem checks, no async)
- `src/ui/` components (React/Ink, no Effect)
- `bin/cli.tsx` interactive React/Ink flow (calls `enhanceCommand` which handles Effect)
- awesome-lint integration behaviour
- Test file structure (`tests/**/*.test.ts`, vitest)
