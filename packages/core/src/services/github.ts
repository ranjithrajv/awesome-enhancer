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
  archived: boolean;
  disabled: boolean;
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

const GITHUB_BASE = 'https://api.github.com';
const GITHUB_USER_AGENT = 'awesome-enhancer-github';
const GITHUB_RATE_LIMIT_HEADER = 'x-ratelimit-remaining';

export const GitHubLive = (
  token: string | null,
): Layer.Layer<GitHubService, never, CacheService | LoggerService> =>
  Layer.effect(
    GitHubService,
    Effect.gen(function* () {
      const cache = yield* CacheService;
      const logger = yield* LoggerService;
      const rateLimitRef = yield* Ref.make<Option.Option<string>>(Option.none());

      const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
        const base: Record<string, string> = { Accept: 'application/vnd.github.v3+json', ...extra };
        if (token) base['Authorization'] = `token ${token}`;
        return { ...base, 'User-Agent': GITHUB_USER_AGENT };
      };

      const fetchJson = <T>(path: string): Effect.Effect<T, NetworkError> => {
        return Effect.gen(function* () {
          const url = `${GITHUB_BASE}${path}`;
          const cached = yield* cache.get<{ data: T }>(url);
          if (Option.isSome(cached)) return cached.value.data;

          const response = yield* Effect.tryPromise({
            try: () =>
              axios.get<T>(url, { headers: authHeaders(), timeout: DEFAULT_REQUEST_TIMEOUT }),
            catch: (e: any) =>
              new NetworkError({
                url,
                statusCode: e.response?.status,
                message: e.message ?? String(e),
              }),
          });

          yield* Ref.set(
            rateLimitRef,
            Option.fromNullable(response.headers[GITHUB_RATE_LIMIT_HEADER] ?? null),
          );
          yield* cache.set(url, { data: response.data });
          return response.data;
        });
      };

      const fetchReadme = (owner: string, repo: string): Effect.Effect<string, NetworkError> => {
        return Effect.gen(function* () {
          const url = `${GITHUB_BASE}/repos/${owner}/${repo}/readme`;
          const cached = yield* cache.get<{ data: string }>(url);
          if (Option.isSome(cached)) return cached.value.data;

          const response = yield* Effect.tryPromise({
            try: () =>
              axios.get<string>(url, {
                headers: authHeaders({ Accept: 'application/vnd.github.v3.raw' }),
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
              logger.warn(`⚠️ [GitHubService] Failed to fetch ${url}: ${e.message}`),
            ),
          );

          yield* cache.set(url, { data: response.data });
          return response.data;
        });
      };

      return {
        fetchRepoMetadata: (owner, repo) => fetchJson(`/repos/${owner}/${repo}`),
        fetchRepoReadme: fetchReadme,
        getRateLimitStatus: () => Ref.get(rateLimitRef),
      };
    }),
  );
