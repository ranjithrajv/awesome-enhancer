import { Layer } from 'effect';
import { GitHubLive } from '../services/github.js';
import { ScraperLive } from '../services/scraper.js';
import { SilentLive } from '../services/logger.js';
import { FileCacheLive } from '../services/cache.js';
import type { EnhanceOptions } from './schemas.js';
import type { GitHubService } from '../services/github.js';
import type { ScraperService } from '../services/scraper.js';
import type { LoggerService } from '../services/logger.js';
import type { CacheService } from '../services/cache.js';

export function buildAppLayer(
  options: EnhanceOptions,
): Layer.Layer<GitHubService | ScraperService | LoggerService | CacheService> {
  const cacheLayer = FileCacheLive(options.cacheDir, options.cacheTTL);
  const loggerLayer = SilentLive; // Library default: silent. CLI overrides at its boundary.

  const githubLayer = GitHubLive(options.githubToken).pipe(
    Layer.provide(Layer.merge(cacheLayer, loggerLayer)),
  );

  const scraperLayer = ScraperLive.pipe(
    Layer.provide(Layer.merge(cacheLayer, loggerLayer)),
  );

  return Layer.mergeAll(githubLayer, scraperLayer, loggerLayer, cacheLayer);
}
