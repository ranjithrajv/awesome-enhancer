import { Effect, Option } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export class MetadataProcessor implements Processor {
  private badgeGenerator: BadgeGenerator;

  constructor(badgeGenerator: BadgeGenerator) {
    this.badgeGenerator = badgeGenerator;
  }

  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, GitHubService> {
    const badgeGenerator = this.badgeGenerator;
    return Effect.gen(function* () {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);
      if (!githubInfo) return false;

      if (index + 1 >= parent.children.length) {
        const newTextNode = { type: 'text', value: '' };
        parent.children.splice(index + 1, 0, newTextNode);
      }

      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return false;
      if (nextNode.value.includes('img.shields.io')) return false;

      const github = yield* GitHubService;
      const metadata = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.option); // NetworkError → Option.None instead of failure

      if (Option.isNone(metadata)) return false;

      const starsBadge = badgeGenerator.generateBadge('stars', githubInfo.owner, githubInfo.repo);
      const langBadge = badgeGenerator.generateBadge('language', githubInfo.owner, githubInfo.repo);

      nextNode.value = `${nextNode.value} ${starsBadge} ${langBadge}`;
      return true;
    });
  }
}
