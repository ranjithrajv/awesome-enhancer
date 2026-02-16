import { parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, LinkNode } from './processor-engine.js';

/**
 * MetadataProcessor adds GitHub stats badges to repository links.
 */
export class MetadataProcessor implements Processor {
  private githubService: GitHubService;
  private badgeGenerator: BadgeGenerator;

  constructor(githubService: GitHubService, badgeGenerator: BadgeGenerator) {
    this.githubService = githubService;
    this.badgeGenerator = badgeGenerator;
  }

  async execute(linkNode: LinkNode, parent: any, index: number): Promise<boolean> {
    const url = linkNode.url;
    const githubInfo = parseGitHubUrl(url);

    if (!githubInfo) return false;

    if (index + 1 >= parent.children.length) {
      const newTextNode = { type: 'text', value: '' };
      parent.children.splice(index + 1, 0, newTextNode);
    }

    const nextNode = parent.children[index + 1];
    if (nextNode.type !== 'text') return false;

    const metadata = await this.githubService.fetchRepoMetadata(githubInfo.owner, githubInfo.repo);
    if (!metadata) return false;

    if (nextNode.value.includes('img.shields.io')) return false;

    const starsBadge = this.badgeGenerator.generateBadge(
      'stars',
      githubInfo.owner,
      githubInfo.repo,
    );
    const langBadge = this.badgeGenerator.generateBadge(
      'language',
      githubInfo.owner,
      githubInfo.repo,
    );

    nextNode.value = `${nextNode.value} ${starsBadge} ${langBadge}`;
    return true;
  }
}
