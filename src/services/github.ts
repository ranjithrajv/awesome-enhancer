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

      function authHeaders(): Record<string, string> {
        const base: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
        if (token) base['Authorization'] = `token ${token}`;
        return base;
      }

      return {
        fetchRepoMetadata: (owner: string, repo: string) => {
          const url = `https://api.github.com/repos/${owner}/${repo}`;
          return Effect.gen(function* () {
            const cached = yield* cache.get<{ data: RepoMetadata; headers: Record<string, string> }>(url);
            if (Option.isSome(cached)) return cached.value.data;

            const response = yield* Effect.tryPromise({
              try: () =>
                axios.get<RepoMetadata>(url, {
                  headers: { ...authHeaders(), 'User-Agent': 'awesome-enhancer-github' },
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({ url, statusCode: e.response?.status, message: e.message ?? String(e) }),
            });

            yield* Ref.set(
              rateLimitRef,
              Option.fromNullable(response.headers['x-ratelimit-remaining'] ?? null),
            );
            yield* cache.set(url, { data: response.data, headers: response.headers as Record<string, string> });
            return response.data;
          });
        },

        fetchRepoReadme: (owner: string, repo: string) => {
          const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
          return Effect.gen(function* () {
            const cached = yield* cache.get<{ data: string; headers: Record<string, string> }>(url);
            if (Option.isSome(cached)) return cached.value.data;

            const response = yield* Effect.tryPromise({
              try: () =>
                axios.get<string>(url, {
                  headers: {
                    ...authHeaders(),
                    Accept: 'application/vnd.github.v3.raw',
                    'User-Agent': 'awesome-enhancer-github',
                  },
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({ url, statusCode: e.response?.status, message: e.message ?? String(e) }),
            }).pipe(
              Effect.tapError((e) =>
                logger.warn(`⚠️ [GitHubService] Failed to fetch ${url}: ${e.message}`),
              ),
            );

            yield* cache.set(url, { data: response.data, headers: response.headers as Record<string, string> });
            return response.data;
          });
        },

        getRateLimitStatus: () => Ref.get(rateLimitRef),
      };
    }),
  );
