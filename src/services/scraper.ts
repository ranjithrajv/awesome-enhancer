import * as cheerio from 'cheerio';
import { BaseService } from './base-service.js';
import { isValidUrl } from '../core/utils.js';
import { DEFAULT_CACHE_TTL, DESCRIPTION_MAX_LENGTH } from '../core/constants.js';

export class ScraperService extends BaseService {
  constructor(cacheTTL: number = DEFAULT_CACHE_TTL) {
    super('awesome-enhance-scraper', cacheTTL);
  }

  async fetchGitHubDescription(owner: string, repo: string): Promise<string | null> {
    const url = `https://github.com/${owner}/${repo}`;
    const result = await this.getCached<string>(url);

    if (!result) return null;

    const $ = cheerio.load(result.data);

    let description = $('meta[property="og:description"]').attr('content');

    if (!description || description.length < 10) {
      description = $('[data-pjax="#repo-content-pjax-container"] p').first().text().trim();
    }

    return this.cleanDescription(description);
  }

  async fetchWebsiteDescription(url: string): Promise<string | null> {
    if (!isValidUrl(url)) return null;

    const result = await this.getCached<string>(url);
    if (!result) return null;

    const $ = cheerio.load(result.data);

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content');

    return this.cleanDescription(description);
  }

  private cleanDescription(description: string | undefined): string | null {
    if (!description) return null;

    let cleaned = description
      .replace(/^GitHub - [^:]+:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > DESCRIPTION_MAX_LENGTH) {
      cleaned = cleaned.substring(0, DESCRIPTION_MAX_LENGTH - 3) + '...';
    }

    return cleaned;
  }
}
