import { parseGitHubUrl } from '../core/utils.js';
import { ScraperService } from '../services/scraper.js';
import { Processor, LinkNode } from './processor-engine.js';
import { DESCRIPTION_MIN_LENGTH } from '../core/constants.js';

/**
 * DescriptionProcessor improves link descriptions via scraping.
 */
export class DescriptionProcessor implements Processor {
  private scraperService: ScraperService;

  constructor(scraperService: ScraperService) {
    this.scraperService = scraperService;
  }

  async execute(linkNode: LinkNode, parent: any, index: number): Promise<boolean> {
    const url = linkNode.url;

    if (index + 1 >= parent.children.length) return false;

    const nextNode = parent.children[index + 1];
    if (nextNode.type !== 'text') return false;

    const currentText = nextNode.value.replace(/^\s*-\s*/, '').trim();

    if (currentText.length > DESCRIPTION_MIN_LENGTH) return false;

    let newDescription: string | null = null;
    const githubInfo = parseGitHubUrl(url);

    if (githubInfo) {
      newDescription = await this.scraperService.fetchGitHubDescription(
        githubInfo.owner,
        githubInfo.repo,
      );
    } else {
      newDescription = await this.scraperService.fetchWebsiteDescription(url);
    }

    if (newDescription && newDescription !== currentText) {
      nextNode.value = ` - ${newDescription}`;
      return true;
    }

    return false;
  }
}
