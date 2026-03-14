import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Node } from 'unist';
import { Effect, Ref } from 'effect';
import { LoggerService } from '../services/logger.js';
import { GitHubService } from '../services/github.js';
import { ScraperService } from '../services/scraper.js';
import { EnhanceError, NetworkError } from '../core/errors.js';
import { StaleEntry } from './stale-processor.js';

export interface LinkNode extends Node {
  type: 'link';
  url: string;
  children: any[];
}

export interface ProcessorResult {
  modified: boolean;
  staleEntry?: StaleEntry; // only set by StaleProcessor
}

export interface Processor {
  execute(
    linkNode: LinkNode,
    parent: any,
    index: number,
  ): Effect.Effect<ProcessorResult, NetworkError, GitHubService | ScraperService>;
}

export class ProcessorEngine {
  private processors: Processor[] = [];

  register(processor: Processor): void {
    this.processors.push(processor);
  }

  process(
    content: string,
  ): Effect.Effect<
    { content: string; staleEntries: StaleEntry[] },
    EnhanceError | NetworkError,
    LoggerService | GitHubService | ScraperService
  > {
    const processors = this.processors;
    return Effect.gen(function* () {
      const logger = yield* LoggerService;
      const tree = unified().use(remarkParse).parse(content);

      let totalLinks = 0;
      visit(tree, 'link', () => {
        totalLinks++;
      });

      const processedRef = yield* Ref.make(0);
      const modifiedRef = yield* Ref.make(0);
      const staleEntriesRef = yield* Ref.make<StaleEntry[]>([]);

      const linkEffects: Effect.Effect<
        ProcessorResult,
        NetworkError,
        GitHubService | ScraperService
      >[] = [];

      visit(tree, 'link', (linkNode: any, index: number | undefined, parent: any) => {
        if (index === undefined) return;

        linkEffects.push(
          Effect.gen(function* () {
            let modified = false;
            for (const processor of processors) {
              const result = yield* processor.execute(linkNode as LinkNode, parent, index);
              if (result.modified) modified = true;
              if (result.staleEntry !== undefined) {
                yield* Ref.update(staleEntriesRef, (es) => [...es, result.staleEntry!]);
              }
            }
            const processed = yield* Ref.updateAndGet(processedRef, (n) => n + 1);
            if (modified) yield* Ref.update(modifiedRef, (n) => n + 1);
            const modifiedCount = yield* Ref.get(modifiedRef);
            if (modifiedCount > 0) {
              yield* logger.log(
                `\r✨ Processed ${processed}/${totalLinks} links, enhanced ${modifiedCount}...`,
              );
            }
            return { modified: modified, staleEntry: undefined };
          }),
        );
      });

      const _linkResults = yield* Effect.all(linkEffects, { concurrency: 'unbounded' });
      const processed = yield* Ref.get(processedRef);
      const modified = yield* Ref.get(modifiedRef);
      const staleEntries = yield* Ref.get(staleEntriesRef);
      yield* logger.log(`\n✅ Finished: ${processed} links analyzed, ${modified} enhanced.`);

      let contentString: string;
      contentString = unified()
        .use(remarkStringify, {
          bullet: '-',
          emphasis: '_',
          strong: '*',
          listItemIndent: 'one',
        })
        .stringify(tree as any);

      return {
        content: contentString,
        staleEntries,
      };
    });
  }
}
