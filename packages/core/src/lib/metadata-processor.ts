import { Effect, Option } from 'effect';
import {
  parseGitHubUrl,
  parseGitLabUrl,
  detectExistingBadges,
  getMissingBadges,
  BadgeType,
} from '../core/utils.js';
import { GitHubService } from '../services/github.js';
import { GitLabService } from '../services/gitlab.js';
import { BadgeGenerator, type Platform } from './badge-generator.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';

export class MetadataProcessor implements Processor {
  private badgeGenerator: BadgeGenerator;
  private addStars: boolean;
  private addForks: boolean;
  private addLastCommit: boolean;

  constructor(
    badgeGenerator: BadgeGenerator,
    addStars: boolean = true,
    addForks: boolean = true,
    addLastCommit: boolean = true,
  ) {
    this.badgeGenerator = badgeGenerator;
    this.addStars = addStars;
    this.addForks = addForks;
    this.addLastCommit = addLastCommit;
  }

  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, GitHubService | GitLabService> {
    const addStars = this.addStars;
    const addForks = this.addForks;
    const addLastCommit = this.addLastCommit;
    return Effect.gen(function* () {
      const url = linkNode.url;
      const githubInfo = parseGitHubUrl(url);
      const gitlabInfo = parseGitLabUrl(url);

      if (!githubInfo && !gitlabInfo) return { modified: false };

      // Find the node immediately after the link — may be text, html, or absent
      const nextNode = parent.children[index + 1] ?? null;

      // Skip if the next sibling is a structural node (another link, image, etc.)
      if (nextNode !== null && nextNode.type !== 'text' && nextNode.type !== 'html') {
        return { modified: false };
      }

      // Detect badges already present in whatever node follows the link
      const existingBadges = detectExistingBadges(nextNode?.value ?? '');
      const missingBadges = getMissingBadges(existingBadges);

      const filteredBadges = missingBadges.filter((badge) => {
        if (badge === 'stars' && !addStars) return false;
        if (badge === 'forks' && !addForks) return false;
        if (badge === 'last-commit' && !addLastCommit) return false;
        return true;
      });

      if (filteredBadges.length === 0) return { modified: false };

      let metadata: Option.Option<unknown>;
      let platform: Platform = 'github';
      let owner = '';
      let repo = '';

      if (githubInfo) {
        const github = yield* GitHubService;
        metadata = yield* github
          .fetchRepoMetadata(githubInfo.owner, githubInfo.repo)
          .pipe(Effect.option);
        owner = githubInfo.owner;
        repo = githubInfo.repo;
        platform = 'github';
      } else {
        const gitlab = yield* GitLabService;
        metadata = yield* gitlab
          .fetchRepoMetadata(gitlabInfo!.owner, gitlabInfo!.repo)
          .pipe(Effect.option);
        owner = gitlabInfo!.owner;
        repo = gitlabInfo!.repo;
        platform = 'gitlab';
      }

      if (Option.isNone(metadata)) return { modified: false };

      const badgeGenerator = new BadgeGenerator('flat-square', platform);
      const htmlBadges = filteredBadges
        .map((badgeType) => badgeGenerator.generateBadge(badgeType as BadgeType, owner, repo))
        .join(' ');

      // Use an html AST node so remark-stringify emits the <img> tags verbatim
      // (text nodes get their HTML characters backslash-escaped, breaking rendering)
      if (nextNode?.type === 'html') {
        nextNode.value += ' ' + htmlBadges;
      } else {
        parent.children.splice(index + 1, 0, { type: 'html', value: ' ' + htmlBadges });
      }
      return { modified: true };
    });
  }
}
