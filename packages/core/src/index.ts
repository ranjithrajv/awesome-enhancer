// Core library entry point
export { runEnhanceLocal, runEnhanceGithub, runEnhanceGitLab } from './core/runner.js';
export { createEngine } from './core/engine-factory.js';
export { buildAppLayer } from './core/app-layer.js';

// Re-export types and schemas
export {
  EnhanceOptionsSchema,
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
  HttpEnhanceGitLabSchema,
} from './core/schemas.js';
export type {
  EnhanceOptions,
  HttpEnhanceLocalArgs,
  HttpEnhanceGithubArgs,
  HttpEnhanceGitLabArgs,
} from './core/schemas.js';
export type { StaleEntry } from './lib/stale-processor.js';
export type { RedirectEntry } from './lib/redirect-processor.js';

// Re-export services
export { GitHubService, GitHubLive } from './services/github.js';
export { GitLabService, GitLabLive } from './services/gitlab.js';
export { ScraperService, ScraperLive } from './services/scraper.js';
export { CacheService, FileCacheLive } from './services/cache.js';
export { LoggerService, ConsoleLive, SilentLive } from './services/logger.js';

// Re-export errors
export { NetworkError, ConfigError, EnhanceError, ValidationError } from './core/errors.js';
export type { AppError } from './core/errors.js';

// Re-export config
export { loadConfig } from './core/config.js';

// Re-export constants
export {
  DEFAULT_BADGE_STYLE,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DEFAULT_REQUEST_TIMEOUT,
} from './core/constants.js';

// Re-export utils
export { parseGitHubUrl, parseGitLabUrl, isValidUrl, formatNumber } from './core/utils.js';
