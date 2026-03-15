import { Effect } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export interface StaleEntry {
  name: string;
  url: string;
  reason: 'archived' | 'disabled' | 'not-found';
}

function createStaleEntry(
  name: string,
  url: string,
  reason: 'archived' | 'disabled' | 'not-found',
): StaleEntry {
  return { name, url, reason };
}

function insertStaleBadge(
  badgeGenerator: BadgeGenerator,
  parent: any,
  index: number,
  owner: string,
  repo: string,
  url: string,
  reason: 'archived' | 'disabled' | 'not-found',
): ProcessorResult {
  // Generate badge as HTML so remark-stringify emits it verbatim
  const staleBadge = badgeGenerator.generateBadge('status-archived', owner, repo, true);
  const nextNode = parent.children[index + 1] ?? null;
  if (nextNode?.type === 'html') {
    nextNode.value += ' ' + staleBadge;
  } else {
    parent.children.splice(index + 1, 0, { type: 'html', value: ' ' + staleBadge });
  }
  return {
    modified: true,
    staleEntry: createStaleEntry(`${owner}/${repo}`, url, reason),
  };
}

export class StaleProcessor implements Processor {
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

      // Check if a stale badge is already present in the node following this link
      const nextNode = parent.children[index + 1] ?? null;
      if (nextNode !== null && nextNode.type !== 'text' && nextNode.type !== 'html') {
        return { modified: false };
      }
      if ((nextNode?.value ?? '').includes('img.shields.io/badge/status-archived')) {
        return { modified: false };
      }

      const github = yield* GitHubService;
      const result = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.either);

      if (result._tag === 'Left') {
        const error = result.left;
        if (error.statusCode === 404) {
          return insertStaleBadge(
            badgeGenerator,
            parent,
            index,
            githubInfo.owner,
            githubInfo.repo,
            url,
            'not-found',
          );
        }
        return { modified: false };
      }

      const metadata = result.right;
      if (!metadata.archived && !metadata.disabled) return { modified: false };

      return insertStaleBadge(
        badgeGenerator,
        parent,
        index,
        githubInfo.owner,
        githubInfo.repo,
        url,
        metadata.disabled ? 'disabled' : 'archived',
      );
    });
  }
}
