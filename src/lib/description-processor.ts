import { Effect, Option } from 'effect';
import { parseGitHubUrl } from '../core/utils.js';
import { ScraperService } from '../services/scraper.js';
import { Processor, LinkNode } from './processor-engine.js';
import { NetworkError } from '../core/errors.js';
import { DESCRIPTION_MIN_LENGTH } from '../core/constants.js';

export class DescriptionProcessor implements Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<boolean, NetworkError, ScraperService> {
    return Effect.gen(function* () {
      const url = linkNode.url;

      if (index + 1 >= parent.children.length) return false;

      const nextNode = parent.children[index + 1];
      if (nextNode.type !== 'text') return false;

      const currentText = nextNode.value.replace(/^\s*-\s*/, '').trim();
      if (currentText.length > DESCRIPTION_MIN_LENGTH) return false;

      const scraper = yield* ScraperService;
      const githubInfo = parseGitHubUrl(url);

      const descriptionEffect = githubInfo
        ? scraper.fetchGitHubDescription(githubInfo.owner, githubInfo.repo)
        : scraper.fetchWebsiteDescription(url);

      const newDescription = yield* descriptionEffect.pipe(
        Effect.option, // NetworkError → None
        Effect.map((opt) => Option.flatten(opt)),
      );

      if (Option.isNone(newDescription)) return false;
      if (Option.getOrNull(newDescription) === currentText) return false;

      nextNode.value = ` - ${Option.getOrNull(newDescription)}`;
      return true;
    });
  }
}
