import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
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

const runScraper = async <A>(effect: Effect.Effect<A, any, ScraperService>) => {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(TestLayer)));
  if (Exit.isFailure(exit)) {
    const failure = Cause.failureOption(exit.cause);
    if (Option.isSome(failure)) {
      throw failure.value;
    }
    throw Cause.squash(exit.cause);
  }
  return exit.value;
};

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
        Effect.flatMap(ScraperService, (s) => s.fetchWebsiteDescription('https://example.com')),
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
