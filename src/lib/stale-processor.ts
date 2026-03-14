import { Effect } from 'effect';
import { parseGitHubUrl, ensureTextNodeExists, appendBadgeToNode } from '../core/utils.js';
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

function checkAndMarkStale(
  badgeGenerator: BadgeGenerator,
  nextNode: any,
  owner: string,
  repo: string,
  url: string,
  isArchived: boolean,
  isDisabled: boolean,
): ProcessorResult {
  if (!isArchived && !isDisabled) return { modified: false };

  const staleBadge = badgeGenerator.generateBadge('status-archived', owner, repo, false);
  appendBadgeToNode(nextNode, staleBadge);

  return {
    modified: true,
    staleEntry: createStaleEntry(`${owner}/${repo}`, url, isDisabled ? 'disabled' : 'archived'),
  };
}

function checkNotFound(
  badgeGenerator: BadgeGenerator,
  nextNode: any,
  owner: string,
  repo: string,
  url: string,
): ProcessorResult {
  const staleBadge = badgeGenerator.generateBadge('status-archived', owner, repo, false);
  appendBadgeToNode(nextNode, staleBadge);
  return {
    modified: true,
    staleEntry: createStaleEntry(`${owner}/${repo}`, url, 'not-found'),
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

      const nextNode = ensureTextNodeExists(parent, index);
      if (nextNode.type !== 'text') return { modified: false };
      if (nextNode.value.includes('img.shields.io/badge/status-archived'))
        return { modified: false };

      const github = yield* GitHubService;
      const result = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.either);

      if (result._tag === 'Left') {
        const error = result.left;
        if (error.statusCode === 404) {
          return checkNotFound(badgeGenerator, nextNode, githubInfo.owner, githubInfo.repo, url);
        }
        return { modified: false };
      }

      const metadata = result.right;
      return checkAndMarkStale(
        badgeGenerator,
        nextNode,
        githubInfo.owner,
        githubInfo.repo,
        url,
        metadata.archived,
        metadata.disabled,
      );
    });
  }
}
