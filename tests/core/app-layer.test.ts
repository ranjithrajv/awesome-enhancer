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
