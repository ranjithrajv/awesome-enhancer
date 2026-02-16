import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Node } from 'unist';

export interface LinkNode extends Node {
  type: 'link';
  url: string;
  children: any[];
}

export interface Processor {
  execute(linkNode: LinkNode, parent: any, index: number): Promise<boolean>;
}

/**
 * ProcessorEngine handles markdown transformation
 */
export class ProcessorEngine {
  private processors: Processor[] = [];

  /**
   * Register a processor in the pipeline
   */
  register(processor: Processor): void {
    this.processors.push(processor);
  }

  /**
   * Run the transformation pipeline
   */
  async process(content: string): Promise<string> {
    const tree = unified().use(remarkParse).parse(content);

    const linkPromises: Promise<void>[] = [];

    let totalLinks = 0;
    visit(tree, 'link', () => {
      totalLinks++;
    });

    let processedCount = 0;
    let modifiedCount = 0;

    visit(tree, 'link', (linkNode: any, index: number | undefined, parent: any) => {
      if (index === undefined) return;

      linkPromises.push(
        (async () => {
          let modified = false;

          for (const processor of this.processors) {
            const result = await processor.execute(linkNode as LinkNode, parent, index);
            if (result) modified = true;
          }

          processedCount++;
          if (modified) modifiedCount++;

          if (modifiedCount > 0) {
            process.stdout.write(
              `\r✨ Processed ${processedCount}/${totalLinks} links, enhanced ${modifiedCount}...`,
            );
          }
        })(),
      );
    });

    await Promise.all(linkPromises);
    console.log(`\n✅ Finished: ${processedCount} links analyzed, ${modifiedCount} enhanced.`);

    return unified()
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '_',
        strong: '*',
        listItemIndent: 'one',
      })
      .stringify(tree as any);
  }
}
