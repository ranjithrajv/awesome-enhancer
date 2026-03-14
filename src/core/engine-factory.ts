import { ProcessorEngine } from '../lib/processor-engine.js';
import { BadgeGenerator } from '../lib/badge-generator.js';
import { MetadataProcessor } from '../lib/metadata-processor.js';
import { DescriptionProcessor } from '../lib/description-processor.js';
import { StaleProcessor } from '../lib/stale-processor.js';
import { RedirectProcessor } from '../lib/redirect-processor.js';
import { DEFAULT_BADGE_STYLE } from './constants.js';

export interface EngineConfig {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  detectStale?: boolean;
  detectRedirects?: boolean;
  badgeStyle?: string;
}

export function createEngine(config: EngineConfig): ProcessorEngine {
  const engine = new ProcessorEngine();

  if (config.addMetadata) {
    engine.register(
      new MetadataProcessor(new BadgeGenerator(config.badgeStyle ?? DEFAULT_BADGE_STYLE)),
    );
  }

  if (config.updateDescriptions) {
    engine.register(new DescriptionProcessor());
  }

  if (config.detectStale) {
    engine.register(
      new StaleProcessor(new BadgeGenerator(config.badgeStyle ?? DEFAULT_BADGE_STYLE)),
    );
  }

  if (config.detectRedirects) {
    engine.register(
      new RedirectProcessor(new BadgeGenerator(config.badgeStyle ?? DEFAULT_BADGE_STYLE)),
    );
  }

  return engine;
}
