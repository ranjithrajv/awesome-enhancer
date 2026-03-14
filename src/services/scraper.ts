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
    fetchGitLabDescription: (
      owner: string,
      repo: string,
    ) => Effect.Effect<Option.Option<string>, NetworkError>;
    fetchWebsiteDescription: (url: string) => Effect.Effect<Option.Option<string>, NetworkError>;
  }
>() {}

export const ScraperLive: Layer.Layer<ScraperService, never, CacheService | LoggerService> =
  Layer.effect(
    ScraperService,
    Effect.gen(function* () {
      const cache = yield* CacheService;
      const logger = yield* LoggerService;

      function fetchHtml(url: string): Effect.Effect<string, NetworkError> {
        return Effect.gen(function* () {
          const cached = yield* cache.get<string>(url);
          if (Option.isSome(cached)) return cached.value;

          const response = yield* Effect.tryPromise({
            try: () =>
              axios.get<string>(url, {
                headers: { 'User-Agent': 'awesome-enhancer-scraper' },
                timeout: DEFAULT_REQUEST_TIMEOUT,
              }),
            catch: (e: any) =>
              new NetworkError({
                url,
                statusCode: e.response?.status,
                message: e.message ?? String(e),
              }),
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
        /* c8 ignore next -- caller always passes a non-empty string (guarded by parseDescription) */
        if (!description) return Option.none();
        let cleaned = description
          .replace(/^GitHub - [^:]+:\s*/, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!cleaned) return Option.none();
        if (cleaned.length > DESCRIPTION_MAX_LENGTH) {
          cleaned = cleaned.substring(0, DESCRIPTION_MAX_LENGTH - 3) + '...';
        }
        return Option.some(cleaned);
      }

      function parseDescription(html: string, ...selectors: string[]): Option.Option<string> {
        const $ = cheerio.load(html);
        for (const selector of selectors) {
          let description: string | undefined;
          if (selector === 'og:description') {
            description = $('meta[property="og:description"]').attr('content');
          } else if (selector === 'twitter:description') {
            description = $('meta[name="twitter:description"]').attr('content');
          } else if (selector.startsWith('[')) {
            description = $(selector).first().text().trim();
          } else {
            description = $(`meta[name="${selector}"], meta[property="${selector}"]`).attr(
              'content',
            );
          }
          if (description) {
            return cleanDescription(description);
          }
        }
        return Option.none();
      }

      return {
        fetchGitHubDescription: (owner: string, repo: string) => {
          const url = `https://github.com/${owner}/${repo}`;
          return fetchHtml(url).pipe(
            Effect.map((html) =>
              parseDescription(
                html,
                'og:description',
                '[data-pjax="#repo-content-pjax-container"] p',
              ),
            ),
          );
        },

        fetchGitLabDescription: (owner: string, repo: string) => {
          const url = `https://gitlab.com/${owner}/${repo}`;
          return fetchHtml(url).pipe(Effect.map((html) => parseDescription(html, 'description')));
        },

        fetchWebsiteDescription: (url: string) => {
          if (!isValidUrl(url)) return Effect.succeed(Option.none<string>());
          return fetchHtml(url).pipe(
            Effect.map((html) =>
              parseDescription(html, 'description', 'og:description', 'twitter:description'),
            ),
          );
        },
      };
    }),
  );
