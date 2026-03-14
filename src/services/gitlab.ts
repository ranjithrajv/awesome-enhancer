import axios from 'axios';
import { Context, Effect, Layer, Option, Ref } from 'effect';
import { CacheService } from './cache.js';
import { LoggerService } from './logger.js';
import { NetworkError } from '../core/errors.js';
import { DEFAULT_REQUEST_TIMEOUT } from '../core/constants.js';

export interface RepoMetadata {
  star_count: number;
  fork_count: number;
  description: string | null;
  [key: string]: unknown;
}

export class GitLabService extends Context.Tag('GitLabService')<
  GitLabService,
  {
    fetchRepoMetadata: (owner: string, repo: string) => Effect.Effect<RepoMetadata, NetworkError>;
    fetchRepoReadme: (owner: string, repo: string) => Effect.Effect<string, NetworkError>;
    getRateLimitStatus: () => Effect.Effect<Option.Option<string>>;
  }
> {}

export const GitLabLive = (
  token: string | null,
): Layer.Layer<GitLabService, never, CacheService | LoggerService> =>
  Layer.effect(
    GitLabService,
    Effect.gen(function* () {
      const cache = yield* CacheService;
      const logger = yield* LoggerService;
      const rateLimitRef = yield* Ref.make<Option.Option<string>>(Option.none());

      function authHeaders(): Record<string, string> {
        const base: Record<string, string> = {};
        if (token) base['Private-Token'] = token;
        return base;
      }

      return {
        fetchRepoMetadata: (owner: string, repo: string) => {
          const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(
            `${owner}%2F${repo}`,
          )}`;
          return Effect.gen(function* () {
            const cached = yield* cache.get<{
              data: RepoMetadata;
              headers: Record<string, string>;
            }>(url);
            if (Option.isSome(cached)) return cached.value.data;

            const response = yield* Effect.tryPromise({
              try: () =>
                axios.get<RepoMetadata>(url, {
                  headers: {
                    ...authHeaders(),
                    'User-Agent': 'awesome-enhancer-gitlab',
                  },
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({
                  url,
                  statusCode: e.response?.status,
                  message: e.message ?? String(e),
                }),
            });

            yield* Ref.set(
              rateLimitRef,
              Option.fromNullable(response.headers['rate-limit-remaining'] ?? null),
            );
            yield* cache.set(url, {
              data: response.data,
              headers: response.headers as Record<string, string>,
            });
            return response.data;
          });
        },

        fetchRepoReadme: (owner: string, repo: string) => {
          const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(
            `${owner}%2F${repo}`,
          )}/repository/files/README/raw?ref=master`;
          return Effect.gen(function* () {
            const cached = yield* cache.get<{ data: string; headers: Record<string, string> }>(url);
            if (Option.isSome(cached)) return cached.value.data;

            const response = yield* Effect.tryPromise({
              try: () =>
                axios.get<string>(url, {
                  headers: {
                    ...authHeaders(),
                    'User-Agent': 'awesome-enhancer-gitlab',
                  },
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({
                  url,
                  statusCode: e.response?.status,
                  message: e.message ?? String(e),
                }),
            }).pipe(
              Effect.tapError((e) =>
                logger.warn(`⚠️ [GitLabService] Failed to fetch ${url}: ${e.message}`),
              ),
            );

            yield* cache.set(url, {
              data: response.data,
              headers: response.headers as Record<string, string>,
            });
            return response.data;
          });
        },

        getRateLimitStatus: () => Ref.get(rateLimitRef),
      };
    }),
  );
