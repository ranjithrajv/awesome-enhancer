import axios from 'axios';
import { Effect } from 'effect';
import { parseGitHubUrl, ensureTextNodeExists } from '../core/utils.js';
import { BadgeGenerator } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';
import { DEFAULT_REQUEST_TIMEOUT } from '../core/constants.js';

export interface RedirectEntry {
  name: string;
  url: string;
  newUrl: string;
  reason: 'transferred' | 'renamed';
}

function createRedirectEntry(
  name: string,
  url: string,
  newUrl: string,
  reason: 'transferred' | 'renamed',
): RedirectEntry {
  return { name, url, newUrl, reason };
}

export class RedirectProcessor implements Processor {
  private badgeGenerator: BadgeGenerator;

  constructor(badgeGenerator: BadgeGenerator) {
    this.badgeGenerator = badgeGenerator;
  }

  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, never> {
    const badgeGenerator = this.badgeGenerator;
    return Effect.gen(function* () {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);

      if (!githubInfo) return { modified: false };

      const nextNode = ensureTextNodeExists(parent, index);
      if (nextNode.type !== 'text') return { modified: false };
      if (
        nextNode.value.includes('img.shields.io/badge/status-transferred') ||
        nextNode.value.includes('img.shields.io/badge/status-renamed')
      )
        return { modified: false };

      try {
        const response = yield* Effect.tryPromise({
          try: () =>
            axios.head(url, {
              timeout: DEFAULT_REQUEST_TIMEOUT,
              maxRedirects: 0,
              validateStatus: (status) => status >= 200 && status < 400,
            }),
          catch: (e: any) =>
            new NetworkError({
              url,
              statusCode: e.response?.status,
              message: e.message ?? String(e),
            }),
        }).pipe(Effect.either);

        if (response._tag === 'Left') {
          return { modified: false };
        }

        const data = response.right;
        const location = data.headers['location'];
        if (!location) return { modified: false };

        const newUrl = new URL(location, url).href;
        const newGithubInfo = parseGitHubUrl(newUrl);

        if (!newGithubInfo) return { modified: false };

        const isDifferent =
          newGithubInfo.owner !== githubInfo.owner || newGithubInfo.repo !== githubInfo.repo;

        if (!isDifferent) return { modified: false };

        const reason: 'transferred' | 'renamed' =
          newGithubInfo.owner !== githubInfo.owner ? 'transferred' : 'renamed';
        const badgeLabel = reason === 'transferred' ? 'transferred' : 'renamed';
        const redirectBadge = badgeGenerator.generateRedirectBadge(
          badgeLabel,
          newGithubInfo.owner,
          newGithubInfo.repo,
        );
        nextNode.value = `${nextNode.value} ${redirectBadge}`;

        return {
          modified: true,
          redirectEntry: createRedirectEntry(
            `${githubInfo.owner}/${githubInfo.repo}`,
            url,
            newUrl,
            reason,
          ),
        };
      } catch {
        return { modified: false };
      }
    });
  }
}
