import { Effect } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export interface StaleEntry {
  name: string; // e.g. "axios/axios-mock-adapter"
  url: string; // original GitHub URL
  reason: 'archived' | 'disabled' | 'not-found';
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

      // Idempotency: skip if already has a stale badge
      if (index + 1 >= parent.children.length) {
        const newTextNode = { type: 'text', value: '' };
        parent.children.splice(index + 1, 0, newTextNode);
      }
      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return { modified: false };
      if (nextNode.value.includes('img.shields.io/badge/status-archived'))
        return { modified: false };

      const github = yield* GitHubService;
      const result = yield* github
        .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
        .pipe(Effect.either); // Keep error channel

      if (result._tag === 'Left') {
        const error = result.left;
        // Only 404 is considered stale (not-found)
        if (error.statusCode === 404) {
          const staleBadge = badgeGenerator.generateBadge(
            'status-archived',
            githubInfo.owner,
            githubInfo.repo,
            false,
          );
          nextNode.value = `${nextNode.value} ${staleBadge}`;
          return {
            modified: true,
            staleEntry: {
              name: `${githubInfo.owner}/${githubInfo.repo}`,
              url,
              reason: 'not-found',
            },
          };
        }
        // Non-404 errors are ignored (no badge, no stale entry)
        return { modified: false };
      }

      const metadata = result.right;
      if (metadata.archived) {
        const staleBadge = badgeGenerator.generateBadge(
          'status-archived',
          githubInfo.owner,
          githubInfo.repo,
          false,
        );
        nextNode.value = `${nextNode.value} ${staleBadge}`;
        return {
          modified: true,
          staleEntry: {
            name: `${githubInfo.owner}/${githubInfo.repo}`,
            url,
            reason: 'archived',
          },
        };
      }
      if (metadata.disabled) {
        const staleBadge = badgeGenerator.generateBadge(
          'status-archived',
          githubInfo.owner,
          githubInfo.repo,
          false,
        );
        nextNode.value = `${nextNode.value} ${staleBadge}`;
        return {
          modified: true,
          staleEntry: {
            name: `${githubInfo.owner}/${githubInfo.repo}`,
            url,
            reason: 'disabled',
          },
        };
      }

      // Healthy repo
      return { modified: false };
    });
  }
}
