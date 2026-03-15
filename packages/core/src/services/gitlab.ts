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
>() {}

const GITLAB_BASE = 'https://gitlab.com/api/v4';
const GITLAB_USER_AGENT = 'awesome-enhancer-gitlab';
const GITLAB_RATE_LIMIT_HEADER = 'rate-limit-remaining';

export const GitLabLive = (
  token: string | null,
): Layer.Layer<GitLabService, never, CacheService | LoggerService> =>
  Layer.effect(
    GitLabService,
    Effect.gen(function* () {
      const cache = yield* CacheService;
      const _logger = yield* LoggerService;
      const rateLimitRef = yield* Ref.make<Option.Option<string>>(Option.none());

      const authHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {};
        if (token) headers['Private-Token'] = token;
        return { ...headers, 'User-Agent': GITLAB_USER_AGENT };
      };

      const fetchJson = <T>(path: string): Effect.Effect<T, NetworkError> => {
        return Effect.gen(function* () {
          const url = `${GITLAB_BASE}${path}`;
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
            Option.fromNullable(response.headers[GITLAB_RATE_LIMIT_HEADER] ?? null),
          );
          yield* cache.set(url, { data: response.data });
          return response.data;
        });
      };

      const fetchReadme = (owner: string, repo: string): Effect.Effect<string, NetworkError> => {
        return Effect.gen(function* () {
          const encoded = encodeURIComponent(`${owner}/${repo}`);
          const candidates = [
            `/projects/${encoded}/repository/files/README.md/raw?ref=main`,
            `/projects/${encoded}/repository/files/README.md/raw?ref=master`,
            `/projects/${encoded}/repository/files/README/raw?ref=main`,
            `/projects/${encoded}/repository/files/README/raw?ref=master`,
          ];

          for (const path of candidates) {
            const url = `${GITLAB_BASE}${path}`;
            const cached = yield* cache.get<{ data: string }>(url);
            if (Option.isSome(cached)) return cached.value.data;

            const result = yield* Effect.tryPromise({
              try: () =>
                axios.get<string>(url, {
                  headers: authHeaders(),
                  timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
              catch: (e: any) =>
                new NetworkError({
                  url,
                  statusCode: e.response?.status,
                  message: e.message ?? String(e),
                }),
            }).pipe(Effect.option);

            if (Option.isSome(result)) {
              yield* cache.set(url, { data: result.value.data });
              return result.value.data;
            }
          }

          return yield* Effect.fail(
            new NetworkError({
              url: `${GITLAB_BASE}/projects/${encoded}/repository/files/README.md/raw`,
              statusCode: 404,
              message: `README not found in ${owner}/${repo} (tried main/master branches)`,
            }),
          );
        });
      };

      return {
        fetchRepoMetadata: (owner, repo) =>
          fetchJson<RepoMetadata>(`/projects/${encodeURIComponent(`${owner}/${repo}`)}`),
        fetchRepoReadme: fetchReadme,
        getRateLimitStatus: () => Ref.get(rateLimitRef),
      };
    }),
  );
