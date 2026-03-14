import { Effect } from 'effect';
import { parseGitHubUrl, parseGitLabUrl } from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { GitLabService } from '../services/gitlab.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export interface StaleEntry {
  name: string;
  url: string;
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
  ): Effect.Effect<ProcessorResult, NetworkError, GitHubService | GitLabService> {
    const badgeGenerator = this.badgeGenerator;
    return Effect.gen(function* () {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);
      const gitlabInfo = parseGitLabUrl(url);

      if (!githubInfo && !gitlabInfo) return { modified: false };

      if (index + 1 >= parent.children.length) {
        const newTextNode = { type: 'text', value: '' };
        parent.children.splice(index + 1, 0, newTextNode);
      }
      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return { modified: false };
      if (nextNode.value.includes('img.shields.io/badge/status-archived'))
        return { modified: false };

      if (githubInfo) {
        const github = yield* GitHubService;
        const result = yield* github
          .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
          .pipe(Effect.either);

        if (result._tag === 'Left') {
          const error = result.left;
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

        return { modified: false };
      }

      if (gitlabInfo) {
        const gitlab = yield* GitLabService;
        const result = yield* gitlab
          .fetchRepoMetadata(gitlabInfo.owner, gitlabInfo.repo)
          .pipe(Effect.either);

        if (result._tag === 'Left') {
          const error = result.left;
          if (error.statusCode === 404) {
            const staleBadge = badgeGenerator.generateBadge(
              'status-archived',
              gitlabInfo.owner,
              gitlabInfo.repo,
              false,
            );
            nextNode.value = `${nextNode.value} ${staleBadge}`;
            return {
              modified: true,
              staleEntry: {
                name: `${gitlabInfo.owner}/${gitlabInfo.repo}`,
                url,
                reason: 'not-found',
              },
            };
          }
          return { modified: false };
        }

        const metadata = result.right;
        if (metadata.archived_at) {
          const staleBadge = badgeGenerator.generateBadge(
            'status-archived',
            gitlabInfo.owner,
            gitlabInfo.repo,
            false,
          );
          nextNode.value = `${nextNode.value} ${staleBadge}`;
          return {
            modified: true,
            staleEntry: {
              name: `${gitlabInfo.owner}/${gitlabInfo.repo}`,
              url,
              reason: 'archived',
            },
          };
        }

        return { modified: false };
      }

      return { modified: false };
    });
  }
}
