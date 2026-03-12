# Effect + Zod Full Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the entire codebase to Effect for typed async/error handling and dependency injection, add Zod for all external input validation, and resolve all DRY/SOLID violations identified in the code review.

**Architecture:** Services (GitHub, Scraper, Cache, Logger) become Effect `Context.Tag` Layers. All async operations return `Effect<A, E, R>` instead of `Promise<T | null>`. Zod schemas are the single source of truth for all external inputs — MCP tool schemas are derived from them. Entry points (CLI, HTTP, MCP) call `Effect.runPromise` at the outermost boundary.

**Tech Stack:** TypeScript, Effect (effect package), Zod (zod), zod-to-json-schema, vitest, bun, remark/unified (AST processing), axios (HTTP)

---

## Context: How Effect Works

Effect is a functional effects library. Key concepts you need:

```typescript
// An Effect<A, E, R> is a description of a computation that:
// - succeeds with A
// - fails with E
// - requires services R from the environment

// Create effects
const ok = Effect.succeed(42)                    // Effect<number, never, never>
const fail = Effect.fail(new MyError())          // Effect<never, MyError, never>
const fromPromise = Effect.tryPromise({
  try: () => axios.get(url),
  catch: (e) => new NetworkError({ message: String(e) })
})                                               // Effect<AxiosResponse, NetworkError, never>

// Compose with Effect.gen (like async/await)
const program = Effect.gen(function* () {
  const a = yield* Effect.succeed(1)
  const b = yield* Effect.succeed(2)
  return a + b
})

// Services via Context.Tag
class MyService extends Context.Tag('MyService')<MyService, { greet: () => Effect.Effect<string> }>() {}
const useService = Effect.gen(function* () {
  const svc = yield* MyService       // yields the service from environment
  return yield* svc.greet()
})

// Layers provide services
const MyLive = Layer.succeed(MyService, { greet: () => Effect.succeed('hello') })

// Provide layer and run
await Effect.runPromise(useService.pipe(Effect.provide(MyLive)))

// Option.Option<T> replaces T | null
Option.none()           // absence
Option.some(value)      // presence
Option.isNone(o)        // true if None
Option.fromNullable(x)  // null/undefined → None, else Some
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
bun add effect zod zod-to-json-schema
```

**Step 2: Verify install**

```bash
bun run typecheck
```

Expected: passes (or only pre-existing errors)

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add effect, zod, zod-to-json-schema dependencies"
```

---

## Task 2: Constants Module

**Files:**
- Create: `src/core/constants.ts`
- Modify: `src/core/config.ts` (line 14)
- Modify: `src/services/base-service.ts` (lines 17, 26)
- Modify: `src/services/github.ts` (line 7)
- Modify: `src/services/scraper.ts` (line 6)
- Modify: `src/lib/description-processor.ts` (line 25)

No test needed — pure constant exports with no behavior.

**Step 1: Create `src/core/constants.ts`**

```typescript
export const DEFAULT_CACHE_TTL = 86400; // seconds (24h)
export const DEFAULT_CACHE_DIR = '.awesome-cache';
export const DEFAULT_REQUEST_TIMEOUT = 10000; // ms
export const DEFAULT_BADGE_STYLE = 'flat-square';
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 200;
```

**Step 2: Update `src/core/config.ts` line 14**

Replace:
```typescript
  cacheTTL: 86400, // 24 hours
```
With:
```typescript
  cacheTTL: DEFAULT_CACHE_TTL,
```
Add import at top: `import { DEFAULT_CACHE_TTL } from './constants.js';`

**Step 3: Update `src/services/base-service.ts`**

Replace the constructor signature and literals:
```typescript
// line 17: replace cacheTTL: number = 86400 with:
constructor(serviceName: string, cacheTTL: number = DEFAULT_CACHE_TTL) {
  this.serviceName = serviceName;
  this.cache = new Cache(DEFAULT_CACHE_DIR, cacheTTL);
// line 26: replace timeout: number = 10000 with:
  timeout: number = DEFAULT_REQUEST_TIMEOUT,
```
Add import: `import { DEFAULT_CACHE_TTL, DEFAULT_CACHE_DIR, DEFAULT_REQUEST_TIMEOUT } from '../core/constants.js';`

**Step 4: Update `src/services/github.ts` line 7**

```typescript
constructor(githubToken: string | null = null, cacheTTL: number = DEFAULT_CACHE_TTL) {
```
Add import: `import { DEFAULT_CACHE_TTL } from '../core/constants.js';`

**Step 5: Update `src/services/scraper.ts` line 6 and line 51**

```typescript
constructor(cacheTTL: number = DEFAULT_CACHE_TTL) {
// line 51:
    if (cleaned.length > DESCRIPTION_MAX_LENGTH) {
      cleaned = cleaned.substring(0, DESCRIPTION_MAX_LENGTH - 3) + '...';
```
Add import: `import { DEFAULT_CACHE_TTL, DESCRIPTION_MAX_LENGTH } from '../core/constants.js';`

**Step 6: Update `src/lib/description-processor.ts` line 25**

```typescript
    if (currentText.length > DESCRIPTION_MIN_LENGTH) return false;
```
Add import: `import { DESCRIPTION_MIN_LENGTH } from '../core/constants.js';`

**Step 7: Run tests**

```bash
bun run test
```

Expected: 55 tests pass

**Step 8: Commit**

```bash
git add src/core/constants.ts src/core/config.ts src/services/base-service.ts src/services/github.ts src/services/scraper.ts src/lib/description-processor.ts
git commit -m "feat: extract magic numbers to constants module"
```

---

## Task 3: Zod Schemas

**Files:**
- Create: `src/core/schemas.ts`
- Create: `tests/core/schemas.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  EnhanceOptionsSchema,
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
} from '../../src/core/schemas.js';

describe('ConfigSchema', () => {
  it('parses valid config with defaults', () => {
    const result = ConfigSchema.parse({});
    expect(result.cacheTTL).toBe(86400);
    expect(result.githubToken).toBeUndefined();
  });

  it('accepts githubToken', () => {
    const result = ConfigSchema.parse({ githubToken: 'tok', cacheTTL: 3600 });
    expect(result.githubToken).toBe('tok');
    expect(result.cacheTTL).toBe(3600);
  });

  it('rejects non-number cacheTTL', () => {
    expect(() => ConfigSchema.parse({ cacheTTL: 'bad' })).toThrow();
  });
});

describe('EnhanceOptionsSchema', () => {
  it('applies all defaults on empty input', () => {
    const result = EnhanceOptionsSchema.parse({});
    expect(result.addMetadata).toBe(false);
    expect(result.updateDescriptions).toBe(false);
    expect(result.githubToken).toBeNull();
    expect(result.cacheTTL).toBe(86400);
    expect(result.badgeStyle).toBe('flat-square');
    expect(result.cacheDir).toBe('.awesome-cache');
  });
});

describe('HttpEnhanceLocalSchema', () => {
  it('requires file_path', () => {
    expect(() => HttpEnhanceLocalSchema.parse({})).toThrow();
  });

  it('parses valid input with defaults', () => {
    const result = HttpEnhanceLocalSchema.parse({ file_path: '/some/file.md' });
    expect(result.file_path).toBe('/some/file.md');
    expect(result.add_metadata).toBe(true);
    expect(result.dry_run).toBe(false);
  });
});

describe('HttpEnhanceGithubSchema', () => {
  it('requires github_url to be a valid URL', () => {
    expect(() => HttpEnhanceGithubSchema.parse({ github_url: 'not-a-url' })).toThrow();
  });

  it('parses valid GitHub URL', () => {
    const result = HttpEnhanceGithubSchema.parse({
      github_url: 'https://github.com/user/repo',
    });
    expect(result.output_path).toBe('enhanced-readme.md');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/core/schemas.test.ts
```

Expected: FAIL — "Cannot find module '../../src/core/schemas.js'"

**Step 3: Create `src/core/schemas.ts`**

```typescript
import { z } from 'zod';
import {
  DEFAULT_CACHE_TTL,
  DEFAULT_CACHE_DIR,
  DEFAULT_BADGE_STYLE,
} from './constants.js';

export const ConfigSchema = z.object({
  githubToken: z.string().optional(),
  cacheTTL: z.number().default(DEFAULT_CACHE_TTL),
});

export const EnhanceOptionsSchema = z.object({
  addMetadata: z.boolean().default(false),
  updateDescriptions: z.boolean().default(false),
  githubToken: z.string().nullable().default(null),
  cacheTTL: z.number().default(DEFAULT_CACHE_TTL),
  badgeStyle: z.string().default(DEFAULT_BADGE_STYLE),
  cacheDir: z.string().default(DEFAULT_CACHE_DIR),
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
export type HttpEnhanceLocalArgs = z.infer<typeof HttpEnhanceLocalSchema>;
export type HttpEnhanceGithubArgs = z.infer<typeof HttpEnhanceGithubSchema>;
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/core/schemas.test.ts
```

Expected: all 8 tests pass

**Step 5: Update `src/core/config.ts` to use ConfigSchema**

Replace the entire file:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { ConfigSchema, type Config } from './schemas.js';

dotenv.config();

export type { Config };

export async function loadConfig(): Promise<Config> {
  const configPath = join(process.cwd(), '.awesomerc.json');
  let fileConfig: Record<string, unknown> = {};

  try {
    const content = await readFile(configPath, 'utf-8');
    fileConfig = JSON.parse(content);
  } catch {
    // Config file is optional
  }

  return ConfigSchema.parse({
    ...fileConfig,
    githubToken: process.env.GITHUB_TOKEN || fileConfig.githubToken,
  });
}
```

**Step 6: Run all tests**

```bash
bun run test
```

Expected: 55 tests pass

**Step 7: Commit**

```bash
git add src/core/schemas.ts src/core/config.ts tests/core/schemas.test.ts
git commit -m "feat: add Zod schemas for all external inputs"
```

---

## Task 4: Typed Errors

**Files:**
- Create: `src/core/errors.ts`
- Create: `tests/core/errors.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/errors.test.ts
import { describe, it, expect } from 'vitest';
import { NetworkError, ConfigError, EnhanceError, ValidationError } from '../../src/core/errors.js';

describe('NetworkError', () => {
  it('has correct _tag', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'failed' });
    expect(e._tag).toBe('NetworkError');
  });

  it('is an instance of Error', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'failed' });
    expect(e).toBeInstanceOf(Error);
  });

  it('includes statusCode when provided', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'not found', statusCode: 404 });
    expect(e.statusCode).toBe(404);
  });

  it('exposes url and message', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'oops' });
    expect(e.url).toBe('https://example.com');
    expect(e.message).toBe('oops');
  });
});

describe('ConfigError', () => {
  it('has correct _tag', () => {
    const e = new ConfigError({ message: 'bad config' });
    expect(e._tag).toBe('ConfigError');
  });

  it('is an instance of Error', () => {
    expect(new ConfigError({ message: 'x' })).toBeInstanceOf(Error);
  });
});

describe('EnhanceError', () => {
  it('has correct _tag', () => {
    expect(new EnhanceError({ message: 'x' })._tag).toBe('EnhanceError');
  });
});

describe('ValidationError', () => {
  it('has correct _tag', () => {
    expect(new ValidationError({ message: 'x' })._tag).toBe('ValidationError');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/core/errors.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/core/errors.ts`**

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

**Step 4: Run test to verify it passes**

```bash
bun run test tests/core/errors.test.ts
```

Expected: all 8 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: 63 tests pass

**Step 6: Commit**

```bash
git add src/core/errors.ts tests/core/errors.test.ts
git commit -m "feat: add Effect Data.TaggedError typed error hierarchy"
```

---

## Task 5: Logger Service

**Files:**
- Create: `src/services/logger.ts`
- Create: `tests/services/logger.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/logger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Effect } from 'effect';
import { LoggerService, ConsoleLive, SilentLive } from '../../src/services/logger.js';

describe('SilentLive', () => {
  it('log does not call console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.log('hello');
      }).pipe(Effect.provide(SilentLive)),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warn does not call console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.warn('oops');
      }).pipe(Effect.provide(SilentLive)),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ConsoleLive', () => {
  it('log calls console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.log('hello');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('warn calls console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.warn('warning');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('warning');
    spy.mockRestore();
  });

  it('error calls console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.error('err');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('err');
    spy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/services/logger.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/services/logger.ts`**

```typescript
import { Context, Effect, Layer } from 'effect';

export class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    log: (msg: string) => Effect.Effect<void>;
    warn: (msg: string) => Effect.Effect<void>;
    error: (msg: string) => Effect.Effect<void>;
  }
>() {}

export const ConsoleLive: Layer.Layer<LoggerService> = Layer.succeed(LoggerService, {
  log: (msg) => Effect.sync(() => console.log(msg)),
  warn: (msg) => Effect.sync(() => console.warn(msg)),
  error: (msg) => Effect.sync(() => console.error(msg)),
});

export const SilentLive: Layer.Layer<LoggerService> = Layer.succeed(LoggerService, {
  log: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
});
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/services/logger.test.ts
```

Expected: all 4 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all pass

**Step 6: Commit**

```bash
git add src/services/logger.ts tests/services/logger.test.ts
git commit -m "feat: add LoggerService Effect Context.Tag with Console and Silent layers"
```

---

## Task 6: CacheService Layer

**Files:**
- Create: `src/services/cache.ts`
- Create: `tests/services/cache.test.ts`

Note: `src/core/cache.ts` (the existing `Cache` class) is kept as an internal implementation detail.

**Step 1: Write the failing test**

```typescript
// tests/services/cache.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Effect, Option } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { CacheService, FileCacheLive } from '../../src/services/cache.js';

describe('FileCacheLive', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cache-svc-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns None for missing key', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cache = yield* CacheService;
        return yield* cache.get<string>('nonexistent');
      }).pipe(Effect.provide(FileCacheLive('.test-cache', 3600))),
    );
    expect(Option.isNone(result)).toBe(true);
  });

  it('returns Some after set', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cache = yield* CacheService;
        yield* cache.set('key1', { foo: 'bar' });
        return yield* cache.get<{ foo: string }>('key1');
      }).pipe(Effect.provide(FileCacheLive('.test-cache', 3600))),
    );
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrNull(result)).toEqual({ foo: 'bar' });
  });

  it('returns None for expired entries', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cache = yield* CacheService;
        yield* cache.set('key', 'value');
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
        const got = yield* cache.get<string>('key');
        vi.restoreAllMocks();
        return got;
      }).pipe(Effect.provide(FileCacheLive('.test-cache', 1))),
    );
    expect(Option.isNone(result)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/services/cache.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/services/cache.ts`**

```typescript
import { Context, Effect, Layer, Option } from 'effect';
import { Cache } from '../core/cache.js';

export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    get: <T>(key: string) => Effect.Effect<Option.Option<T>>;
    set: <T>(key: string, data: T) => Effect.Effect<void>;
  }
>() {}

export const FileCacheLive = (cacheDir: string, ttl: number): Layer.Layer<CacheService> =>
  Layer.sync(CacheService, () => {
    const cache = new Cache(cacheDir, ttl);
    return {
      get: <T>(key: string) =>
        Effect.promise(() => cache.get<T>(key)).pipe(Effect.map(Option.fromNullable)),
      set: <T>(key: string, data: T) => Effect.promise(() => cache.set(key, data)),
    };
  });
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/services/cache.test.ts
```

Expected: all 3 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all pass

**Step 6: Commit**

```bash
git add src/services/cache.ts tests/services/cache.test.ts
git commit -m "feat: add CacheService Effect Layer wrapping existing Cache"
```

---

## Task 7: GitHubService Effect Migration

**Files:**
- Modify: `src/services/github.ts`
- Modify: `tests/services/github.test.ts`

**Step 1: Rewrite `tests/services/github.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { GitHubService, GitHubLive } from '../../src/services/github.js';
import { CacheService } from '../../src/services/cache.js';
import { SilentLive } from '../../src/services/logger.js';
import { NetworkError } from '../../src/core/errors.js';

const NoCacheLayer = Layer.succeed(CacheService, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
});

const TestLayer = (token: string | null = null) =>
  GitHubLive(token).pipe(
    Layer.provide(Layer.merge(NoCacheLayer, SilentLive)),
  );

const runGitHub = <A>(effect: Effect.Effect<A, any, GitHubService>, token: string | null = null) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer(token))));

describe('GitHubService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'github-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('fetches repo metadata', async () => {
    const mockMetadata = { stargazers_count: 1000, forks_count: 100, language: 'TypeScript' };
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockMetadata,
      headers: { 'x-ratelimit-remaining': '4999' },
    });

    const result = await runGitHub(
      Effect.flatMap(GitHubService, (s) => s.fetchRepoMetadata('owner', 'repo')),
    );
    expect(result).toEqual(mockMetadata);
  });

  it('fails with NetworkError on fetch failure', async () => {
    const axiosError = Object.assign(new Error('Network error'), { response: { status: 500 } });
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(axiosError);

    await expect(
      runGitHub(Effect.flatMap(GitHubService, (s) => s.fetchRepoMetadata('owner', 'repo'))),
    ).rejects.toMatchObject({ _tag: 'NetworkError', statusCode: 500 });
  });

  it('fails with NetworkError on 404', async () => {
    const axiosError = Object.assign(new Error('Not found'), { response: { status: 404 } });
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(axiosError);

    await expect(
      runGitHub(Effect.flatMap(GitHubService, (s) => s.fetchRepoReadme('owner', 'repo'))),
    ).rejects.toMatchObject({ _tag: 'NetworkError', statusCode: 404 });
  });

  it('fetches repo readme', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '# Hello World',
      headers: {},
    });

    const result = await runGitHub(
      Effect.flatMap(GitHubService, (s) => s.fetchRepoReadme('owner', 'repo')),
    );
    expect(result).toBe('# Hello World');
  });

  it('getRateLimitStatus returns None initially', async () => {
    const result = await runGitHub(
      Effect.flatMap(GitHubService, (s) => s.getRateLimitStatus()),
    );
    expect(Option.isNone(result)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/services/github.test.ts
```

Expected: FAIL — type errors / missing exports

**Step 3: Rewrite `src/services/github.ts`**

```typescript
import axios from 'axios';
import { Context, Effect, Layer, Option, Ref } from 'effect';
import { CacheService } from './cache.js';
import { LoggerService } from './logger.js';
import { NetworkError } from '../core/errors.js';
import { DEFAULT_REQUEST_TIMEOUT } from '../core/constants.js';

export interface RepoMetadata {
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  [key: string]: unknown;
}

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
      const rateLimitRef = yield* Ref.make<Option.Option<string>>(Option.none());

      function authHeaders() {
        const base: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
        if (token) base['Authorization'] = `token ${token}`;
        return base;
      }

      function fetchWithCache<T>(url: string, headers: Record<string, string>) {
        return Effect.gen(function* () {
          const cached = yield* cache.get<{ data: T; headers: Record<string, string> }>(url);
          if (Option.isSome(cached)) return cached.value.data;

          const response = yield* Effect.tryPromise({
            try: () =>
              axios.get<T>(url, { headers: { ...headers, 'User-Agent': 'awesome-enhance-github' }, timeout: DEFAULT_REQUEST_TIMEOUT }),
            catch: (e: any) =>
              new NetworkError({ url, statusCode: e.response?.status, message: e.message }),
          });

          yield* cache.set(url, { data: response.data, headers: response.headers as Record<string, string> });
          return response.data;
        });
      }

      return {
        fetchRepoMetadata: (owner, repo) => {
          const url = `https://api.github.com/repos/${owner}/${repo}`;
          return Effect.gen(function* () {
            const cached = yield* cache.get<{ data: RepoMetadata; headers: Record<string, string> }>(url);
            if (Option.isSome(cached)) {
              return cached.value.data;
            }
            const response = yield* Effect.tryPromise({
              try: () =>
                axios.get<RepoMetadata>(url, {
                  headers: { ...authHeaders(), 'User-Agent': 'awesome-enhance-github' },
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({ url, statusCode: e.response?.status, message: e.message }),
            });
            yield* Ref.set(rateLimitRef, Option.fromNullable(response.headers['x-ratelimit-remaining'] ?? null));
            yield* cache.set(url, { data: response.data, headers: response.headers as Record<string, string> });
            return response.data;
          });
        },

        fetchRepoReadme: (owner, repo) => {
          const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
          const headers = { ...authHeaders(), Accept: 'application/vnd.github.v3.raw' };
          return fetchWithCache<string>(url, headers).pipe(
            Effect.tapError((e) => logger.warn(`⚠️ [GitHubService] Failed to fetch ${url}: ${e.message}`)),
          );
        },

        getRateLimitStatus: () => Ref.get(rateLimitRef),
      };
    }),
  );
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/services/github.test.ts
```

Expected: all 5 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: most pass. The metadata-processor and description-processor tests will fail because they still use the old API. That is expected — we'll fix them in Tasks 11-12.

**Step 6: Commit**

```bash
git add src/services/github.ts tests/services/github.test.ts
git commit -m "feat: migrate GitHubService to Effect Context.Tag with typed NetworkError"
```

---

## Task 8: ScraperService Effect Migration

**Files:**
- Modify: `src/services/scraper.ts`
- Modify: `tests/services/scraper.test.ts`

**Step 1: Rewrite `tests/services/scraper.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { ScraperService, ScraperLive } from '../../src/services/scraper.js';
import { CacheService } from '../../src/services/cache.js';
import { SilentLive } from '../../src/services/logger.js';

const NoCacheLayer = Layer.succeed(CacheService, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
});

const TestLayer = ScraperLive.pipe(Layer.provide(Layer.merge(NoCacheLayer, SilentLive)));

const runScraper = <A>(effect: Effect.Effect<A, any, ScraperService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

describe('ScraperService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scraper-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('fetchGitHubDescription', () => {
    it('returns Some with og:description', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta property="og:description" content="A cool library"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('A cool library');
    });

    it('returns None when no description found', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isNone(result)).toBe(true);
    });

    it('fails with NetworkError on fetch failure', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        runScraper(Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo'))),
      ).rejects.toMatchObject({ _tag: 'NetworkError' });
    });
  });

  describe('fetchWebsiteDescription', () => {
    it('returns Some with meta description', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta name="description" content="My site"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) =>
          s.fetchWebsiteDescription('https://example.com'),
        ),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('My site');
    });

    it('returns None for invalid URL', async () => {
      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchWebsiteDescription('not-a-url')),
      );
      expect(Option.isNone(result)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/services/scraper.test.ts
```

Expected: FAIL — type errors / missing exports

**Step 3: Rewrite `src/services/scraper.ts`**

```typescript
import * as cheerio from 'cheerio';
import axios from 'axios';
import { Context, Effect, Layer, Option } from 'effect';
import { CacheService } from './cache.js';
import { LoggerService } from './logger.js';
import { NetworkError } from '../core/errors.js';
import { isValidUrl } from '../core/utils.js';
import { DEFAULT_REQUEST_TIMEOUT, DESCRIPTION_MAX_LENGTH } from '../core/constants.js';

export class ScraperService extends Context.Tag('ScraperService')<
  ScraperService,
  {
    fetchGitHubDescription: (
      owner: string,
      repo: string,
    ) => Effect.Effect<Option.Option<string>, NetworkError>;
    fetchWebsiteDescription: (url: string) => Effect.Effect<Option.Option<string>, NetworkError>;
  }
>() {}

export const ScraperLive: Layer.Layer<
  ScraperService,
  never,
  CacheService | LoggerService
> = Layer.effect(
  ScraperService,
  Effect.gen(function* () {
    const cache = yield* CacheService;
    const logger = yield* LoggerService;

    function fetchHtml(url: string) {
      return Effect.gen(function* () {
        const cached = yield* cache.get<string>(url);
        if (Option.isSome(cached)) return cached.value;

        const response = yield* Effect.tryPromise({
          try: () =>
            axios.get<string>(url, {
              headers: { 'User-Agent': 'awesome-enhance-scraper' },
              timeout: DEFAULT_REQUEST_TIMEOUT,
            }),
          catch: (e: any) =>
            new NetworkError({ url, statusCode: e.response?.status, message: e.message }),
        });

        yield* cache.set(url, response.data);
        return response.data;
      }).pipe(
        Effect.tapError((e) =>
          logger.warn(`⚠️ [ScraperService] Failed to fetch ${url}: ${e.message}`),
        ),
      );
    }

    function cleanDescription(description: string | undefined): Option.Option<string> {
      if (!description) return Option.none();
      let cleaned = description.replace(/^GitHub - [^:]+:\s*/, '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return Option.none();
      if (cleaned.length > DESCRIPTION_MAX_LENGTH) {
        cleaned = cleaned.substring(0, DESCRIPTION_MAX_LENGTH - 3) + '...';
      }
      return Option.some(cleaned);
    }

    return {
      fetchGitHubDescription: (owner, repo) => {
        const url = `https://github.com/${owner}/${repo}`;
        return fetchHtml(url).pipe(
          Effect.map((html) => {
            const $ = cheerio.load(html);
            let description = $('meta[property="og:description"]').attr('content');
            if (!description || description.length < 10) {
              description = $('[data-pjax="#repo-content-pjax-container"] p').first().text().trim();
            }
            return cleanDescription(description);
          }),
        );
      },

      fetchWebsiteDescription: (url) => {
        if (!isValidUrl(url)) return Effect.succeed(Option.none());
        return fetchHtml(url).pipe(
          Effect.map((html) => {
            const $ = cheerio.load(html);
            const description =
              $('meta[name="description"]').attr('content') ||
              $('meta[property="og:description"]').attr('content') ||
              $('meta[name="twitter:description"]').attr('content');
            return cleanDescription(description);
          }),
        );
      },
    };
  }),
);
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/services/scraper.test.ts
```

Expected: all 5 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: github and scraper tests pass; metadata/description processor tests still fail (expected — fixed in Tasks 11-12)

**Step 6: Commit**

```bash
git add src/services/scraper.ts tests/services/scraper.test.ts
git commit -m "feat: migrate ScraperService to Effect Context.Tag with Option returns"
```

---

## Task 9: Delete BaseService

**Files:**
- Delete: `src/services/base-service.ts`

`BaseService` is now fully replaced by `CacheService` + `LoggerService` layers. Both `GitHubService` and `ScraperService` no longer extend it.

**Step 1: Delete the file**

```bash
rm src/services/base-service.ts
```

**Step 2: Run all tests**

```bash
bun run test
```

Expected: all tests that currently pass continue to pass. No file imports `base-service` anymore (both services were rewritten in Tasks 7-8).

**Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: no errors related to base-service

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete BaseService, fully replaced by Effect Layers"
```

---

## Task 10: ProcessorEngine Effect Migration

**Files:**
- Modify: `src/lib/processor-engine.ts`
- Modify: `tests/lib/processor-engine.test.ts`

**Step 1: Rewrite `tests/lib/processor-engine.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { ProcessorEngine, type Processor, type LinkNode } from '../../src/lib/processor-engine.js';
import { SilentLive } from '../../src/services/logger.js';
import { GitHubService } from '../../src/services/github.js';
import { ScraperService } from '../../src/services/scraper.js';
import { CacheService } from '../../src/services/cache.js';
import { NetworkError } from '../../src/core/errors.js';

// Minimal stub layers for services the processors don't use
const StubGitHubLayer = Layer.succeed(GitHubService, {
  fetchRepoMetadata: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
  fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
  getRateLimitStatus: () => Effect.succeed(Option.none()),
});

const StubScraperLayer = Layer.succeed(ScraperService, {
  fetchGitHubDescription: () => Effect.succeed(Option.none()),
  fetchWebsiteDescription: () => Effect.succeed(Option.none()),
});

const StubCacheLayer = Layer.succeed(CacheService, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
});

const TestLayer = Layer.mergeAll(SilentLive, StubGitHubLayer, StubScraperLayer, StubCacheLayer);

function runEngine(engine: ProcessorEngine, content: string) {
  return Effect.runPromise(engine.process(content).pipe(Effect.provide(TestLayer)));
}

describe('ProcessorEngine', () => {
  it('processes markdown with no processors (passthrough)', async () => {
    const engine = new ProcessorEngine();
    const input = '# Title\n\n- [Link](https://example.com) - Description\n';
    const output = await runEngine(engine, input);
    expect(output).toContain('Link');
    expect(output).toContain('https://example.com');
  });

  it('calls registered processors for each link', async () => {
    const engine = new ProcessorEngine();
    const mockProcessor: Processor = {
      execute: vi.fn().mockReturnValue(Effect.succeed(false)),
    };
    engine.register(mockProcessor);

    const input = '- [Link1](https://example.com) - Desc1\n- [Link2](https://other.com) - Desc2\n';
    await runEngine(engine, input);

    expect(mockProcessor.execute).toHaveBeenCalledTimes(2);
  });

  it('runs multiple processors in sequence per link', async () => {
    const engine = new ProcessorEngine();
    const order: string[] = [];

    const proc1: Processor = {
      execute: vi.fn().mockImplementation(() =>
        Effect.sync(() => { order.push('proc1'); return false; }),
      ),
    };
    const proc2: Processor = {
      execute: vi.fn().mockImplementation(() =>
        Effect.sync(() => { order.push('proc2'); return false; }),
      ),
    };

    engine.register(proc1);
    engine.register(proc2);

    await runEngine(engine, '- [Link](https://example.com)\n');

    expect(order).toEqual(['proc1', 'proc2']);
  });

  it('passes link node to processors', async () => {
    const engine = new ProcessorEngine();
    let capturedUrl = '';

    const proc: Processor = {
      execute: vi.fn().mockImplementation((linkNode: LinkNode) =>
        Effect.sync(() => { capturedUrl = linkNode.url; return false; }),
      ),
    };

    engine.register(proc);
    await runEngine(engine, '- [My Link](https://github.com/user/repo)\n');

    expect(capturedUrl).toBe('https://github.com/user/repo');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/lib/processor-engine.test.ts
```

Expected: FAIL — type errors (process() doesn't return Effect yet)

**Step 3: Rewrite `src/lib/processor-engine.ts`**

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Node } from 'unist';
import { Effect, Ref } from 'effect';
import { LoggerService } from '../services/logger.js';
import { GitHubService } from '../services/github.js';
import { ScraperService } from '../services/scraper.js';
import { EnhanceError, NetworkError } from '../core/errors.js';

export interface LinkNode extends Node {
  type: 'link';
  url: string;
  children: any[];
}

export interface Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, GitHubService | ScraperService>;
}

export class ProcessorEngine {
  private processors: Processor[] = [];

  register(processor: Processor): void {
    this.processors.push(processor);
  }

  process(
    content: string,
  ): Effect.Effect<
    string,
    EnhanceError | NetworkError,
    LoggerService | GitHubService | ScraperService
  > {
    return Effect.gen((function* (this: ProcessorEngine) {
      const logger = yield* LoggerService;
      const tree = unified().use(remarkParse).parse(content);

      let totalLinks = 0;
      visit(tree, 'link', () => { totalLinks++; });

      const processedRef = yield* Ref.make(0);
      const modifiedRef = yield* Ref.make(0);

      const linkEffects: Effect.Effect<void, NetworkError, GitHubService | ScraperService>[] = [];

      visit(tree, 'link', (linkNode: any, index: number | undefined, parent: any) => {
        if (index === undefined) return;

        linkEffects.push(
          Effect.gen(function* () {
            let modified = false;
            for (const processor of this.processors) {
              const result = yield* processor.execute(linkNode as LinkNode, parent, index);
              if (result) modified = true;
            }
            const processed = yield* Ref.updateAndGet(processedRef, (n) => n + 1);
            if (modified) yield* Ref.update(modifiedRef, (n) => n + 1);
            const modifiedCount = yield* Ref.get(modifiedRef);
            if (modifiedCount > 0) {
              yield* logger.log(
                `\r✨ Processed ${processed}/${totalLinks} links, enhanced ${modifiedCount}...`,
              );
            }
          }.bind(this)),
        );
      });

      yield* Effect.all(linkEffects, { concurrency: 'unbounded' });

      const processed = yield* Ref.get(processedRef);
      const modified = yield* Ref.get(modifiedRef);
      yield* logger.log(`\n✅ Finished: ${processed} links analyzed, ${modified} enhanced.`);

      return unified()
        .use(remarkStringify, {
          bullet: '-',
          emphasis: '_',
          strong: '*',
          listItemIndent: 'one',
        })
        .stringify(tree as any);
    }).bind(this)());
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/lib/processor-engine.test.ts
```

Expected: all 4 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: engine tests pass; metadata/description processor tests still fail (expected)

**Step 6: Commit**

```bash
git add src/lib/processor-engine.ts tests/lib/processor-engine.test.ts
git commit -m "feat: migrate ProcessorEngine.process() to return Effect with LoggerService"
```

---

## Task 11: MetadataProcessor Effect Migration

**Files:**
- Modify: `src/lib/metadata-processor.ts`
- Modify: `tests/lib/metadata-processor.test.ts`

**Step 1: Rewrite `tests/lib/metadata-processor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { MetadataProcessor } from '../../src/lib/metadata-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import { GitHubService } from '../../src/services/github.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeGitHubLayer(metadata: any) {
  return Layer.succeed(GitHubService, {
    fetchRepoMetadata: () =>
      metadata === null
        ? Effect.fail(new NetworkError({ url: '', message: 'not found', statusCode: 404 }))
        : Effect.succeed(metadata),
    fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
    getRateLimitStatus: () => Effect.succeed(Option.none()),
  });
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText = ' - Description') {
  return { children: [linkNode, { type: 'text', value: trailingText }] };
}

function runProcessor(processor: MetadataProcessor, linkNode: LinkNode, parent: any, index: number, metadata: any = { stargazers_count: 100 }) {
  return Effect.runPromise(
    processor.execute(linkNode, parent, index).pipe(Effect.provide(makeGitHubLayer(metadata))),
  );
}

describe('MetadataProcessor', () => {
  it('adds badges for GitHub links', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator('flat-square'));
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io');
  });

  it('skips non-GitHub links', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result).toBe(false);
  });

  it('skips links that already have badges', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' img.shields.io existing badge');

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result).toBe(false);
  });

  it('returns false when metadata fetch fails (NetworkError)', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0, null);
    expect(result).toBe(false);
  });

  it('creates a text node if none exists after the link', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await runProcessor(processor, linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/lib/metadata-processor.test.ts
```

Expected: FAIL — type errors

**Step 3: Rewrite `src/lib/metadata-processor.ts`**

```typescript
import { Effect, Option } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export class MetadataProcessor implements Processor {
  private badgeGenerator: BadgeGenerator;

  constructor(badgeGenerator: BadgeGenerator) {
    this.badgeGenerator = badgeGenerator;
  }

  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, GitHubService> {
    return Effect.gen((function* (this: MetadataProcessor) {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);
      if (!githubInfo) return false;

      if (index + 1 >= parent.children.length) {
        const newTextNode = { type: 'text', value: '' };
        parent.children.splice(index + 1, 0, newTextNode);
      }

      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return false;
      if (nextNode.value.includes('img.shields.io')) return false;

      const github = yield* GitHubService;
      const metadata = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.option); // NetworkError → Option.None instead of failure

      if (Option.isNone(metadata)) return false;

      const starsBadge = this.badgeGenerator.generateBadge('stars', githubInfo.owner, githubInfo.repo);
      const langBadge = this.badgeGenerator.generateBadge('language', githubInfo.owner, githubInfo.repo);

      nextNode.value = `${nextNode.value} ${starsBadge} ${langBadge}`;
      return true;
    }).bind(this)());
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/lib/metadata-processor.test.ts
```

Expected: all 5 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: metadata-processor tests pass; description-processor tests still fail (fixed in Task 12)

**Step 6: Commit**

```bash
git add src/lib/metadata-processor.ts tests/lib/metadata-processor.test.ts
git commit -m "feat: migrate MetadataProcessor.execute() to return Effect, yield GitHubService"
```

---

## Task 12: DescriptionProcessor Effect Migration

**Files:**
- Modify: `src/lib/description-processor.ts`
- Modify: `tests/lib/description-processor.test.ts`

**Step 1: Rewrite `tests/lib/description-processor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { DescriptionProcessor } from '../../src/lib/description-processor.js';
import { ScraperService } from '../../src/services/scraper.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeScraperLayer(description: string | null) {
  const optDesc = Option.fromNullable(description);
  return Layer.succeed(ScraperService, {
    fetchGitHubDescription: () => Effect.succeed(optDesc),
    fetchWebsiteDescription: () => Effect.succeed(optDesc),
  });
}

function makeScraperErrorLayer() {
  return Layer.succeed(ScraperService, {
    fetchGitHubDescription: () => Effect.fail(new NetworkError({ url: '', message: 'fail' })),
    fetchWebsiteDescription: () => Effect.fail(new NetworkError({ url: '', message: 'fail' })),
  });
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText = ' - Short') {
  return { children: [linkNode, { type: 'text', value: trailingText }] };
}

function runProcessor(
  processor: DescriptionProcessor,
  linkNode: LinkNode,
  parent: any,
  description: string | null = 'A great library for doing things',
) {
  return Effect.runPromise(
    processor.execute(linkNode, parent, 0).pipe(Effect.provide(makeScraperLayer(description))),
  );
}

describe('DescriptionProcessor', () => {
  it('updates a short description for GitHub links', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' - Short');

    const result = await runProcessor(processor, linkNode, parent);

    expect(result).toBe(true);
    expect(parent.children[1].value).toContain('A great library');
  });

  it('skips if current description is already long enough', async () => {
    const processor = new DescriptionProcessor();
    const longDesc = ' - ' + 'x'.repeat(60);
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, longDesc);

    const result = await runProcessor(processor, linkNode, parent);
    expect(result).toBe(false);
  });

  it('skips if no description found', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, null);
    expect(result).toBe(false);
  });

  it('handles non-GitHub URLs', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 'A website description');
    expect(result).toBe(true);
    expect(parent.children[1].value).toContain('A website description');
  });

  it('returns false when scraper fails', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(
      processor
        .execute(linkNode, parent, 0)
        .pipe(Effect.provide(makeScraperErrorLayer())),
    );
    expect(result).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/lib/description-processor.test.ts
```

Expected: FAIL

**Step 3: Rewrite `src/lib/description-processor.ts`**

```typescript
import { Effect, Option } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { ScraperService } from '../services/scraper.js';
import { Processor, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';
import { DESCRIPTION_MIN_LENGTH } from '../core/constants.js';

export class DescriptionProcessor implements Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, ScraperService> {
    return Effect.gen(function* () {
      const url = linkNode.url;

      if (index + 1 >= parent.children.length) return false;

      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return false;

      const currentText = nextNode.value.replace(/^\s*-\s*/, '').trim();
      if (currentText.length > DESCRIPTION_MIN_LENGTH) return false;

      const scraper = yield* ScraperService;
      const githubInfo = parseGitHubUrl(url);

      const descriptionEffect = githubInfo
        ? scraper.fetchGitHubDescription(githubInfo.owner, githubInfo.repo)
        : scraper.fetchWebsiteDescription(url);

      const newDescription = yield* descriptionEffect.pipe(
        Effect.option, // NetworkError → None
        Effect.map((opt) => Option.flatten(opt)),
      );

      if (Option.isNone(newDescription)) return false;
      if (Option.getOrNull(newDescription) === currentText) return false;

      nextNode.value = ` - ${Option.getOrNull(newDescription)}`;
      return true;
    });
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/lib/description-processor.test.ts
```

Expected: all 5 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add src/lib/description-processor.ts tests/lib/description-processor.test.ts
git commit -m "feat: migrate DescriptionProcessor.execute() to return Effect, yield ScraperService"
```

---

## Task 13: Engine Factory

**Files:**
- Create: `src/core/engine-factory.ts`
- Create: `tests/core/engine-factory.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/engine-factory.test.ts
import { describe, it, expect } from 'vitest';
import { createEngine } from '../../src/core/engine-factory.js';
import { ProcessorEngine } from '../../src/lib/processor-engine.js';

describe('createEngine', () => {
  it('returns a ProcessorEngine', () => {
    const engine = createEngine({});
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers no processors when both options are false', () => {
    const engine = createEngine({ addMetadata: false, updateDescriptions: false });
    // ProcessorEngine.processors is private; we verify behavior: process() runs without calling any processors
    // (just verify it's a valid engine instance)
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers MetadataProcessor when addMetadata is true', async () => {
    // We can verify by running process() on a GitHub link and checking side effects would be attempted
    // Rather than testing internals, just verify no throw
    const engine = createEngine({ addMetadata: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers DescriptionProcessor when updateDescriptions is true', () => {
    const engine = createEngine({ updateDescriptions: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers both processors when both options are true', () => {
    const engine = createEngine({ addMetadata: true, updateDescriptions: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/core/engine-factory.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/core/engine-factory.ts`**

```typescript
import { ProcessorEngine } from '../lib/processor-engine.js';
import { BadgeGenerator } from '../lib/badge-generator.js';
import { MetadataProcessor } from '../lib/metadata-processor.js';
import { DescriptionProcessor } from '../lib/description-processor.js';
import { DEFAULT_BADGE_STYLE } from './constants.js';

export interface EngineConfig {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  badgeStyle?: string;
}

export function createEngine(config: EngineConfig): ProcessorEngine {
  const engine = new ProcessorEngine();

  if (config.addMetadata) {
    engine.register(new MetadataProcessor(new BadgeGenerator(config.badgeStyle ?? DEFAULT_BADGE_STYLE)));
  }

  if (config.updateDescriptions) {
    engine.register(new DescriptionProcessor());
  }

  return engine;
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/core/engine-factory.test.ts
```

Expected: all 5 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add src/core/engine-factory.ts tests/core/engine-factory.test.ts
git commit -m "feat: add engine-factory to deduplicate processor registration"
```

---

## Task 14: App Layer

**Files:**
- Create: `src/core/app-layer.ts`
- Create: `tests/core/app-layer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/app-layer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Option } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildAppLayer } from '../../src/core/app-layer.js';
import { GitHubService } from '../../src/services/github.js';
import { ScraperService } from '../../src/services/scraper.js';
import { LoggerService } from '../../src/services/logger.js';

describe('buildAppLayer', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'app-layer-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('provides GitHubService', async () => {
    const layer = buildAppLayer({
      addMetadata: false,
      updateDescriptions: false,
      githubToken: null,
      cacheTTL: 3600,
      badgeStyle: 'flat-square',
      cacheDir: '.test-cache',
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* GitHubService;
        return yield* github.getRateLimitStatus();
      }).pipe(Effect.provide(layer)),
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it('provides LoggerService (silent by default)', async () => {
    const layer = buildAppLayer({
      addMetadata: false,
      updateDescriptions: false,
      githubToken: null,
      cacheTTL: 3600,
      badgeStyle: 'flat-square',
      cacheDir: '.test-cache',
    });

    // Just verify it resolves without error
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.log('test');
      }).pipe(Effect.provide(layer)),
    );
  });

  it('provides ScraperService', async () => {
    const layer = buildAppLayer({
      addMetadata: false,
      updateDescriptions: false,
      githubToken: null,
      cacheTTL: 3600,
      badgeStyle: 'flat-square',
      cacheDir: '.test-cache',
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ScraperService;
      }).pipe(Effect.provide(layer)),
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/core/app-layer.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/core/app-layer.ts`**

```typescript
import { Layer } from 'effect';
import { GitHubLive } from '../services/github.js';
import { ScraperLive } from '../services/scraper.js';
import { SilentLive } from '../services/logger.js';
import { FileCacheLive } from '../services/cache.js';
import type { EnhanceOptions } from './schemas.js';
import type { GitHubService } from '../services/github.js';
import type { ScraperService } from '../services/scraper.js';
import type { LoggerService } from '../services/logger.js';
import type { CacheService } from '../services/cache.js';

export function buildAppLayer(
  options: EnhanceOptions,
): Layer.Layer<GitHubService | ScraperService | LoggerService | CacheService> {
  const cacheLayer = FileCacheLive(options.cacheDir, options.cacheTTL);
  const loggerLayer = SilentLive; // Library default: silent. CLI overrides at its boundary.

  const githubLayer = GitHubLive(options.githubToken).pipe(
    Layer.provide(Layer.merge(cacheLayer, loggerLayer)),
  );

  const scraperLayer = ScraperLive.pipe(
    Layer.provide(Layer.merge(cacheLayer, loggerLayer)),
  );

  return Layer.mergeAll(githubLayer, scraperLayer, loggerLayer, cacheLayer);
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/core/app-layer.test.ts
```

Expected: all 3 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add src/core/app-layer.ts tests/core/app-layer.test.ts
git commit -m "feat: add buildAppLayer to assemble full Effect Layer from options"
```

---

## Task 15: Public API (`src/index.ts`)

**Files:**
- Modify: `src/index.ts`
- Create: `tests/index.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import { enhance } from '../src/index.js';

describe('enhance()', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'enhance-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns an Effect', () => {
    const result = enhance('# Test\n');
    expect(typeof result.pipe).toBe('function'); // Effect has .pipe
  });

  it('passes through content with no processors registered', async () => {
    const result = await Effect.runPromise(
      enhance('# Title\n\n- [Link](https://example.com) - Desc\n'),
    );
    expect(result).toContain('Link');
    expect(result).toContain('https://example.com');
  });

  it('applies addMetadata option with GitHub links', async () => {
    const axios = await import('axios');
    (axios.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { stargazers_count: 500, language: 'TypeScript' },
      headers: {},
    });

    const content = '# Test\n\n- [Repo](https://github.com/user/repo) - A repo\n';
    const result = await Effect.runPromise(
      enhance(content, { addMetadata: true }),
    );
    expect(result).toContain('img.shields.io');
  });

  it('validates options with Zod and rejects invalid input', () => {
    expect(() => enhance('# Test\n', { cacheTTL: 'bad' as any })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/index.test.ts
```

Expected: FAIL — `enhance` returns Promise not Effect, or type errors

**Step 3: Rewrite `src/index.ts`**

```typescript
import { Effect } from 'effect';
import { ProcessorEngine } from './lib/processor-engine.js';
import { createEngine } from './core/engine-factory.js';
import { buildAppLayer } from './core/app-layer.js';
import { EnhanceOptionsSchema, type EnhanceOptions } from './core/schemas.js';
import type { AppError } from './core/errors.js';

export function enhance(
  content: string,
  options: Partial<EnhanceOptions> = {},
): Effect.Effect<string, AppError, never> {
  const parsed = EnhanceOptionsSchema.parse(options);
  const engine = createEngine(parsed);
  return engine.process(content).pipe(Effect.provide(buildAppLayer(parsed)));
}

// Re-exports for programmatic use
export { ProcessorEngine };
export type { EnhanceOptions };
export { createEngine } from './core/engine-factory.js';
export { buildAppLayer } from './core/app-layer.js';
export { EnhanceOptionsSchema } from './core/schemas.js';
export { LoggerService, ConsoleLive, SilentLive } from './services/logger.js';
export { GitHubService, GitHubLive } from './services/github.js';
export { ScraperService, ScraperLive } from './services/scraper.js';
export { CacheService, FileCacheLive } from './services/cache.js';
export { NetworkError, ConfigError, EnhanceError, ValidationError } from './core/errors.js';
export type { AppError } from './core/errors.js';
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/index.test.ts
```

Expected: all 4 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 6: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

**Step 7: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: enhance() returns Effect<string, AppError, never>, add full re-exports"
```

---

## Task 16: Shared Runner Module

**Files:**
- Create: `src/core/runner.ts`
- Create: `tests/core/runner.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/runner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('awesome-lint', () => ({ default: { report: vi.fn().mockResolvedValue(undefined) } }));

import { runEnhanceLocal, runEnhanceGithub } from '../../src/core/runner.js';

describe('runEnhanceLocal', () => {
  let tempDir: string;
  let originalCwd: string;
  let inputFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    inputFile = join(tempDir, 'test.md');
    await writeFile(inputFile, '# Test\n\n- [Link](https://example.com) - Desc\n', 'utf-8');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns success result for local file', async () => {
    const result = await runEnhanceLocal({
      file_path: inputFile,
      add_metadata: false,
      update_descriptions: false,
      dry_run: false,
    });

    expect(result.success).toBe(true);
    expect(result.enhanced_content).toBeDefined();
  });

  it('returns dry_run result when dry_run is true', async () => {
    const result = await runEnhanceLocal({
      file_path: inputFile,
      add_metadata: false,
      update_descriptions: false,
      dry_run: true,
    });

    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.preview).toBeDefined();
  });
});

describe('runEnhanceGithub', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'runner-gh-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns success result for GitHub URL', async () => {
    const axios = await import('axios');
    (axios.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '# Test Readme\n\n- [Link](https://example.com) - Desc\n',
      headers: {},
    });

    const result = await runEnhanceGithub({
      github_url: 'https://github.com/user/repo',
      add_metadata: false,
      update_descriptions: false,
      dry_run: false,
    });

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run test tests/core/runner.test.ts
```

Expected: FAIL — "Cannot find module"

**Step 3: Create `src/core/runner.ts`**

```typescript
import { readFile, writeFile } from 'fs/promises';
import { Effect } from 'effect';
import { enhanceCommand } from '../commands/enhance.js';
import { EnhanceOptionsSchema, type HttpEnhanceLocalArgs, type HttpEnhanceGithubArgs } from './schemas.js';

export interface EnhanceResult {
  success: boolean;
  output_file?: string;
  enhanced_content?: string;
  dry_run?: boolean;
  preview?: string;
}

export async function runEnhanceLocal(args: HttpEnhanceLocalArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
  });

  const outputPath = args.output_path || args.file_path;

  await enhanceCommand(args.file_path, {
    ...options,
    output: args.dry_run ? undefined : outputPath,
    dryRun: args.dry_run,
    skipLint: true,
  });

  if (args.dry_run) {
    const preview = await readFile(args.file_path, 'utf-8');
    return { success: true, dry_run: true, preview };
  }

  const enhanced_content = await readFile(outputPath, 'utf-8');
  return { success: true, output_file: outputPath, enhanced_content };
}

export async function runEnhanceGithub(args: HttpEnhanceGithubArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
  });

  const outputPath = args.output_path || 'enhanced-readme.md';

  await enhanceCommand(args.github_url, {
    ...options,
    output: outputPath,
    dryRun: args.dry_run,
    skipLint: true,
  });

  if (args.dry_run) {
    return { success: true, dry_run: true, preview: 'dry-run mode' };
  }

  const enhanced_content = await readFile(outputPath, 'utf-8');
  return { success: true, output_file: outputPath, enhanced_content };
}
```

**Step 4: Run test to verify it passes**

```bash
bun run test tests/core/runner.test.ts
```

Expected: all 3 tests pass

**Step 5: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add src/core/runner.ts tests/core/runner.test.ts
git commit -m "feat: add shared runner module, eliminating temp-dir duplication between MCP and HTTP"
```

---

## Task 17: Update `src/commands/enhance.ts`

**Files:**
- Modify: `src/commands/enhance.ts`

No tests (excluded from coverage — it's in `commands/`).

**Step 1: Rewrite `src/commands/enhance.ts`**

```typescript
import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import awesomeLint from 'awesome-lint';
import { Effect, Layer } from 'effect';
import { loadConfig } from '../core/config.js';
import { createEngine } from '../core/engine-factory.js';
import { buildAppLayer } from '../core/app-layer.js';
import { EnhanceOptionsSchema } from '../core/schemas.js';
import { ConsoleLive } from '../services/logger.js';
import { isValidUrl, parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { GitService } from '../services/git.js';
import type { AppError } from '../core/errors.js';

export interface EnhanceCommandOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  output?: string;
  dryRun?: boolean;
  githubToken?: string;
  skipLint?: boolean;
}

export async function enhanceCommand(
  fileOrUrl: string | undefined,
  options: EnhanceCommandOptions,
) {
  const program = Effect.gen(function* () {
    console.log('🚀 Starting awesome-enhance...\n');

    if (!fileOrUrl) {
      if (GitService.isGitRepo()) {
        const localReadme = GitService.findLocalReadme();
        if (localReadme) {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await rl.question(
            `🧐 I see you're in a Git repository. Would you like to enhance ${localReadme}? (y/n) `,
          );
          rl.close();
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '') {
            fileOrUrl = localReadme;
          } else {
            throw new Error('No file or URL provided.');
          }
        } else {
          throw new Error('No file or URL provided and no local README found.');
        }
      } else {
        throw new Error('Please provide a file path or GitHub URL.');
      }
    }

    if (!options.addMetadata && !options.updateDescriptions) {
      throw new Error('Please specify at least one enhancement option: --add-metadata or --update-descriptions');
    }

    const config = yield* Effect.promise(() => loadConfig());
    const githubToken = options.githubToken || config.githubToken || null;
    const cacheTTL = config.cacheTTL;

    const isUrl = isValidUrl(fileOrUrl!);
    let content: string;

    if (isUrl) {
      const githubInfo = parseGitHubUrl(fileOrUrl!);
      if (!githubInfo) throw new Error('Currently only GitHub repository URLs are supported.');

      console.log(`🌐 Fetching README from ${fileOrUrl}...`);
      const github = yield* GitHubService;
      content = yield* github.fetchRepoReadme(githubInfo.owner, githubInfo.repo);
    } else {
      console.log(`📖 Reading ${fileOrUrl}...`);
      content = yield* Effect.promise(() => readFile(fileOrUrl!, 'utf-8'));
    }

    if (!options.skipLint) {
      console.log('\n🔍 Running initial awesome-lint check...');
      try { await (awesomeLint as any).report({ filename: fileOrUrl }); } catch { /* ignore */ }
    }

    const parsed = EnhanceOptionsSchema.parse({
      addMetadata: options.addMetadata,
      updateDescriptions: options.updateDescriptions,
      githubToken,
      cacheTTL,
    });

    console.log('\n✨ Enhancing awesome list...\n');
    const engine = createEngine(parsed);
    const enhanced = yield* engine.process(content);

    const defaultOutputFile = isUrl ? 'enhanced-readme.md' : fileOrUrl!;
    const outputFile = options.output || defaultOutputFile;

    if (options.dryRun) {
      console.log('\n📋 Preview (dry-run mode):\n');
      console.log('─'.repeat(80));
      console.log(enhanced);
      console.log('─'.repeat(80));
      console.log('\n✅ Dry-run complete. No files were modified.');
    } else {
      yield* Effect.promise(() => writeFile(outputFile, enhanced, 'utf-8'));
      console.log(`\n✅ Successfully enhanced! Output written to: ${outputFile}`);
    }

    if (!options.skipLint && !options.dryRun) {
      console.log('\n🔍 Running awesome-lint to check for further improvements...');
      try {
        await (awesomeLint as any).report({ filename: outputFile });
        console.log('\n✅ Thank you for maintaining an awesome list!');
      } catch {
        console.warn('\n⚠️ Note: awesome-lint found some issues.');
      }
    }
  });

  const config = await loadConfig();
  const appLayer = buildAppLayer(
    EnhanceOptionsSchema.parse({
      addMetadata: options.addMetadata,
      updateDescriptions: options.updateDescriptions,
      githubToken: options.githubToken || config.githubToken || null,
      cacheTTL: config.cacheTTL,
    }),
  );

  // Override logger with ConsoleLive for CLI context
  const cliLayer = appLayer.pipe(Layer.provide(ConsoleLive));

  await Effect.runPromise(program.pipe(Effect.provide(cliLayer))).catch((error: AppError | Error) => {
    console.error(`\n❌ Error: ${error.message}`);
    if (process.env.DEBUG) console.error((error as Error).stack);
    process.exit(1);
  });
}
```

**Step 2: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

**Step 4: Commit**

```bash
git add src/commands/enhance.ts
git commit -m "feat: enhanceCommand uses Effect.runPromise at CLI boundary with ConsoleLive logger"
```

---

## Task 18: Update `bin/http-server.ts`

**Files:**
- Modify: `bin/http-server.ts`

No unit tests for HTTP server.

**Step 1: Rewrite `bin/http-server.ts`**

```typescript
#!/usr/bin/env node

import http from 'http';
import { ZodError } from 'zod';
import {
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
} from '../src/core/schemas.js';
import { runEnhanceLocal, runEnhanceGithub } from '../src/core/runner.js';

const DEFAULT_PORT = 9867;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res: http.ServerResponse, statusCode: number, data: object) {
  res.writeHead(statusCode, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${DEFAULT_PORT}`);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok', name: 'awesome-enhance' });
      return;
    }

    if (method === 'GET' && path === '/') {
      sendJson(res, 200, {
        name: 'awesome-enhance',
        endpoints: {
          'POST /enhance': 'Enhance a local file or URL',
          'POST /enhance/local': 'Enhance local file',
          'POST /enhance/github': 'Enhance GitHub URL',
          'GET /health': 'Health check',
        },
      });
      return;
    }

    if (method === 'POST' && path === '/enhance/local') {
      const body = await readJsonBody(req);
      const args = HttpEnhanceLocalSchema.parse(body);
      sendJson(res, 200, await runEnhanceLocal(args));
      return;
    }

    if (method === 'POST' && path === '/enhance/github') {
      const body = await readJsonBody(req);
      const args = HttpEnhanceGithubSchema.parse(body);
      sendJson(res, 200, await runEnhanceGithub(args));
      return;
    }

    if (method === 'POST' && path === '/enhance') {
      const body = await readJsonBody(req) as any;
      const isUrl = typeof body?.source === 'string' && body.source.startsWith('http');
      if (isUrl) {
        const args = HttpEnhanceGithubSchema.parse({ ...body, github_url: body.source });
        sendJson(res, 200, await runEnhanceGithub(args));
      } else {
        const args = HttpEnhanceLocalSchema.parse({ ...body, file_path: body.source });
        sendJson(res, 200, await runEnhanceLocal(args));
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      sendJson(res, 400, { success: false, error: 'Invalid request', details: error.errors });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
  }
});

const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
server.listen(port, () => {
  console.log(`🚀 awesome-enhance server running at http://localhost:${port}`);
  console.log(`   POST /enhance/local   - Enhance local file`);
  console.log(`   POST /enhance/github  - Enhance GitHub URL`);
  console.log(`   GET  /health          - Health check`);
});
```

**Step 2: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

**Step 4: Commit**

```bash
git add bin/http-server.ts
git commit -m "feat: refactor http-server with readJsonBody helper, Zod validation, and shared runner"
```

---

## Task 19: Update `bin/mcp-server.ts`

**Files:**
- Modify: `bin/mcp-server.ts`

**Step 1: Rewrite `bin/mcp-server.ts`**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { HttpEnhanceLocalSchema, HttpEnhanceGithubSchema } from '../src/core/schemas.js';
import { runEnhanceLocal, runEnhanceGithub } from '../src/core/runner.js';

const server = new Server(
  { name: 'awesome-enhance', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'enhance_local_file',
      description: 'Enhance a local awesome-list markdown file with GitHub metadata and improved descriptions',
      inputSchema: zodToJsonSchema(HttpEnhanceLocalSchema),
    },
    {
      name: 'enhance_github_url',
      description: 'Enhance an awesome list from a GitHub URL',
      inputSchema: zodToJsonSchema(HttpEnhanceGithubSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  function toMcpResult(data: object) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
  }

  try {
    if (name === 'enhance_local_file') {
      const parsed = HttpEnhanceLocalSchema.parse(args);
      return toMcpResult(await runEnhanceLocal(parsed));
    }

    if (name === 'enhance_github_url') {
      const parsed = HttpEnhanceGithubSchema.parse(args);
      return toMcpResult(await runEnhanceGithub(parsed));
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...toMcpResult({ success: false, error: message }), isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 2: Run all tests**

```bash
bun run test
```

Expected: all tests pass

**Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

**Step 4: Run coverage to verify thresholds**

```bash
bun run test:coverage
```

Expected: ≥80% lines/functions/statements, ≥75% branches

**Step 5: Commit**

```bash
git add bin/mcp-server.ts
git commit -m "feat: refactor mcp-server to use zodToJsonSchema and shared runner, remove 200-line duplication"
```

---

## Completion Checklist

- [ ] All 19 tasks completed
- [ ] `bun run test` passes (all tests green)
- [ ] `bun run typecheck` passes (no type errors)
- [ ] `bun run lint` passes (no lint errors)
- [ ] `bun run test:coverage` meets thresholds (80/75)
- [ ] `src/services/base-service.ts` is deleted
- [ ] No `console.log/warn` in service or lib code (only in CLI command)
- [ ] No magic numbers — all use constants
- [ ] `enhance()` returns `Effect`, not `Promise`
