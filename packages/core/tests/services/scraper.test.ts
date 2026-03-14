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

  describe('fetchGitLabDescription', () => {
    it('returns Some with description meta tag', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta name="description" content="GitLab project"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitLabDescription('user', 'repo')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('GitLab project');
    });

    it('returns None when no description found', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitLabDescription('user', 'repo')),
      );
      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe('description cleaning', () => {
    it('removes GitHub prefix', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta property="og:description" content="GitHub - user/repo: A cool library"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('A cool library');
    });

    it('truncates long descriptions', async () => {
      const longDesc = 'x'.repeat(300);
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: `<html><head><meta property="og:description" content="${longDesc}"></head></html>`,
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)?.length).toBeLessThanOrEqual(255);
      expect(Option.getOrNull(result)?.endsWith('...')).toBe(true);
    });
  });

  describe('parseDescription selectors', () => {
    it('uses twitter:description meta tag', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta name="twitter:description" content="Twitter description"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchWebsiteDescription('https://example.com')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('Twitter description');
    });

    it('uses CSS selector for description', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><body><div data-pjax="#repo-content-pjax-container"><p>CSS selector description</p></div></body></html>',
        headers: {},
      });

      // This tests the selector.startsWith('[') branch in parseDescription
      // fetchGitHubDescription uses [data-pjax="#repo-content-pjax-container"] p selector
      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('CSS selector description');
    });

    it('falls back to name meta tag', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta name="description" content="Name meta description"></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchWebsiteDescription('https://example.com')),
      );
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrNull(result)).toBe('Name meta description');
    });
  });

  describe('cache behavior', () => {
    it('returns cached HTML on cache hit', async () => {
      const cachedHtml =
        '<html><head><meta property="og:description" content="Cached description"></head></html>';
      const CacheHitLayer = Layer.succeed(CacheService, {
        get: () => Effect.succeed(Option.some(cachedHtml)),
        set: () => Effect.void,
      });

      const TestCacheLayer = ScraperLive.pipe(
        Layer.provide(Layer.merge(CacheHitLayer, SilentLive)),
      );

      const exit = await Effect.runPromiseExit(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')).pipe(
          Effect.provide(TestCacheLayer),
        ),
      );
      if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
      expect(Option.isSome(exit.value)).toBe(true);
      expect(Option.getOrNull(exit.value)).toBe('Cached description');
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('cleanDescription edge cases', () => {
    it('returns None for empty description', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta property="og:description" content=""></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isNone(result)).toBe(true);
    });

    it('returns None for whitespace-only description', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: '<html><head><meta property="og:description" content="   "></head></html>',
        headers: {},
      });

      const result = await runScraper(
        Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo')),
      );
      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles error with response status', async () => {
      const axiosError = Object.assign(new Error('Server error'), { response: { status: 500 } });
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(axiosError);

      await expect(
        runScraper(Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo'))),
      ).rejects.toMatchObject({ _tag: 'NetworkError', statusCode: 500 });
    });

    it('handles error without response', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        runScraper(Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo'))),
      ).rejects.toMatchObject({ _tag: 'NetworkError', message: 'Network error' });
    });

    it('handles non-Error rejection (covers String(e) fallback)', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 'ECONNREFUSED' });

      await expect(
        runScraper(Effect.flatMap(ScraperService, (s) => s.fetchGitHubDescription('user', 'repo'))),
      ).rejects.toMatchObject({ _tag: 'NetworkError' });
    });
  });
});
