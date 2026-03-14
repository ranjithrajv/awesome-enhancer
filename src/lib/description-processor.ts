import { Effect, Option } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { ScraperService } from '../services/scraper.js';
import { Processor, ProcessorResult, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';
import { DESCRIPTION_MIN_LENGTH } from '../core/constants.js';

export class DescriptionProcessor implements Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, ScraperService> {
    return Effect.gen(function* () {
      const url = linkNode.url;

      if (index + 1 >= parent.children.length) return { modified: false };

      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return { modified: false };

      const currentText = nextNode.value.replace(/^\s*-\s*/, '').trim();
      if (currentText.length > DESCRIPTION_MIN_LENGTH) return { modified: false };

      const scraper = yield* ScraperService;
      const githubInfo = parseGitHubUrl(url);

      const descriptionEffect = githubInfo
        ? scraper.fetchGitHubDescription(githubInfo.owner, githubInfo.repo)
        : scraper.fetchWebsiteDescription(url);

      const newDescription = yield* descriptionEffect.pipe(
        Effect.option,
        Effect.map((opt) => Option.flatten(opt)),
      );

      if (Option.isNone(newDescription)) return { modified: false };
      if (Option.getOrNull(newDescription) === currentText) return { modified: false };

      nextNode.value = ` - ${Option.getOrNull(newDescription)}`;
      return { modified: true };
    });
  }
}
