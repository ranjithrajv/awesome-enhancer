import { Effect } from 'effect';
import { ProcessorEngine } from './lib/processor-engine.js';
import { createEngine } from './core/engine-factory.js';
import { buildAppLayer } from './core/app-layer.js';
import { EnhanceOptionsSchema, type EnhanceOptions } from './core/schemas.js';
import type { AppError } from './core/errors.js';
import type { StaleEntry } from './lib/stale-processor.js';
import type { ProcessorResult } from './lib/processor-engine.js';

export function enhance(
  content: string,
  options: Partial<EnhanceOptions> = {},
): Effect.Effect<{ content: string; staleEntries: StaleEntry[] }, AppError, never> {
  const parsed = EnhanceOptionsSchema.parse(options);
  const engine = createEngine(parsed);
  return engine.process(content).pipe(Effect.provide(buildAppLayer(parsed)));
}

// Re-exports for programmatic use
export { ProcessorEngine };
export type { EnhanceOptions, StaleEntry, ProcessorResult };
export { createEngine } from './core/engine-factory.js';
export { buildAppLayer } from './core/app-layer.js';
export { EnhanceOptionsSchema } from './core/schemas.js';
export { LoggerService, ConsoleLive, SilentLive } from './services/logger.js';
export { GitHubService, GitHubLive } from './services/github.js';
export { ScraperService, ScraperLive } from './services/scraper.js';
export { CacheService, FileCacheLive } from './services/cache.js';
export { NetworkError, ConfigError, EnhanceError, ValidationError } from './core/errors.js';
export type { AppError } from './core/errors.js';
