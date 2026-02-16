import { ProcessorEngine } from './lib/processor-engine.js';
import { GitHubService } from './services/github.js';
import { ScraperService } from './services/scraper.js';
import { BadgeGenerator } from './lib/badge-generator.js';
import { MetadataProcessor } from './lib/metadata-processor.js';
import { DescriptionProcessor } from './lib/description-processor.js';

export interface EnhanceOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  githubToken?: string | null;
  cacheTTL?: number;
  badgeStyle?: string;
}

/**
 * Programmatic API for awesome-enhance
 */
export async function enhance(content: string, options: EnhanceOptions = {}): Promise<string> {
  const {
    addMetadata = false,
    updateDescriptions = false,
    githubToken = null,
    cacheTTL = 86400,
    badgeStyle = 'flat-square',
  } = options;

  const engine = new ProcessorEngine();

  if (addMetadata) {
    const githubService = new GitHubService(githubToken, cacheTTL);
    const badgeGenerator = new BadgeGenerator(badgeStyle);
    engine.register(new MetadataProcessor(githubService, badgeGenerator));
  }

  if (updateDescriptions) {
    const scraperService = new ScraperService(cacheTTL);
    engine.register(new DescriptionProcessor(scraperService));
  }

  return engine.process(content);
}

export {
  ProcessorEngine,
  GitHubService,
  ScraperService,
  BadgeGenerator,
  MetadataProcessor,
  DescriptionProcessor,
};
