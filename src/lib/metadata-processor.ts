import { Effect, Option } from 'effect';
import { parseGitHubUrl, ensureTextNodeExists, appendBadgeToNode } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

async function fetchMetadata<S>(
  service: S,
  owner: string,
  repo: string,
  fetchFn: (s: S, o: string, r: string) => Effect.Effect<any, NetworkError>,
) {
  return Effect.runPromise(fetchFn(service, owner, repo).pipe(Effect.option));
}

export class MetadataProcessor implements Processor {
  private badgeGenerator: BadgeGenerator;

  constructor(badgeGenerator: BadgeGenerator) {
    this.badgeGenerator = badgeGenerator;
  }

  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, GitHubService> {
    const badgeGenerator = this.badgeGenerator;
    return Effect.gen(function* () {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);

      if (!githubInfo) return { modified: false };

      const nextNode = ensureTextNodeExists(parent, index);
      if (nextNode.type !== 'text') return { modified: false };
      if (nextNode.value.includes('img.shields.io')) return { modified: false };

      const github = yield* GitHubService;
      const metadata = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.option);

      if (Option.isNone(metadata)) return { modified: false };

      const starsBadge = badgeGenerator.generateBadge('stars', githubInfo.owner, githubInfo.repo);
      const langBadge = badgeGenerator.generateBadge('language', githubInfo.owner, githubInfo.repo);

      appendBadgeToNode(nextNode, `${starsBadge} ${langBadge}`);
      return { modified: true };
    });
  }
}
