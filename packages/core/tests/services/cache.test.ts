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
