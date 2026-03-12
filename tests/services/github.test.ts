import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
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

const NoCacheLayer = Layer.succeed(CacheService, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
});

const TestLayer = (token: string | null = null) =>
  GitHubLive(token).pipe(
    Layer.provide(Layer.merge(NoCacheLayer, SilentLive)),
  );

const runGitHub = async <A>(effect: Effect.Effect<A, any, GitHubService>, token: string | null = null) => {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(TestLayer(token))));
  if (Exit.isFailure(exit)) {
    const failure = Cause.failureOption(exit.cause);
    if (Option.isSome(failure)) {
      throw failure.value;
    }
    throw Cause.squash(exit.cause);
  }
  return exit.value;
};

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

  it('getRateLimitStatus returns Some after successful fetch', async () => {
    const mockMetadata = { stargazers_count: 500, forks_count: 50, language: 'Go' };
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockMetadata,
      headers: { 'x-ratelimit-remaining': '3000' },
    });

    const result = await runGitHub(
      Effect.flatMap(GitHubService, (s) =>
        s.fetchRepoMetadata('owner', 'repo').pipe(
          Effect.flatMap(() => s.getRateLimitStatus()),
        ),
      ),
    );
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrNull(result)).toBe('3000');
  });

  it('uses token in auth headers when provided', async () => {
    const mockMetadata = { stargazers_count: 100, forks_count: 10, language: 'Rust' };
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockMetadata,
      headers: { 'x-ratelimit-remaining': '4000' },
    });

    const result = await runGitHub(
      Effect.flatMap(GitHubService, (s) => s.fetchRepoMetadata('owner', 'repo')),
      'my-github-token',
    );
    expect(result).toEqual(mockMetadata);
    const callHeaders = (axios.get as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toBe('token my-github-token');
  });

  it('returns cached metadata on cache hit', async () => {
    const cachedData = { stargazers_count: 999, forks_count: 99, language: 'Python' };
    const CacheHitLayer = (token: string | null = null) =>
      GitHubLive(token).pipe(
        Layer.provide(
          Layer.merge(
            Layer.succeed(CacheService, {
              get: () =>
                Effect.succeed(Option.some({ data: cachedData, headers: {} })),
              set: () => Effect.void,
            }),
            SilentLive,
          ),
        ),
      );

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(GitHubService, (s) => s.fetchRepoMetadata('owner', 'repo')).pipe(
        Effect.provide(CacheHitLayer()),
      ),
    );
    if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
    expect(exit.value).toEqual(cachedData);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns cached readme on cache hit', async () => {
    const CacheHitLayer = Layer.succeed(CacheService, {
      get: () =>
        Effect.succeed(Option.some({ data: '# Cached README', headers: {} })),
      set: () => Effect.void,
    });

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(GitHubService, (s) => s.fetchRepoReadme('owner', 'repo')).pipe(
        Effect.provide(GitHubLive(null).pipe(Layer.provide(Layer.merge(CacheHitLayer, SilentLive)))),
      ),
    );
    if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
    expect(exit.value).toBe('# Cached README');
    expect(axios.get).not.toHaveBeenCalled();
  });
});
