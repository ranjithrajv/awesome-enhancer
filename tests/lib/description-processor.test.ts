import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { DescriptionProcessor } from '../../src/lib/description-processor.js';
import { ScraperService } from '../../src/services/scraper.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeScraperLayer(description: string | null) {
  const optDesc = Option.fromNullable(description);
  return Layer.succeed(ScraperService, {
    fetchGitHubDescription: () => Effect.succeed(optDesc),
    fetchWebsiteDescription: () => Effect.succeed(optDesc),
  });
}

function makeScraperErrorLayer() {
  return Layer.succeed(ScraperService, {
    fetchGitHubDescription: () => Effect.fail(new NetworkError({ url: '', message: 'fail' })),
    fetchWebsiteDescription: () => Effect.fail(new NetworkError({ url: '', message: 'fail' })),
  });
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText = ' - Short') {
  return { children: [linkNode, { type: 'text', value: trailingText }] };
}

function runProcessor(
  processor: DescriptionProcessor,
  linkNode: LinkNode,
  parent: any,
  description: string | null = 'A great library for doing things',
) {
  return Effect.runPromise(
    processor.execute(linkNode, parent, 0).pipe(Effect.provide(makeScraperLayer(description))),
  );
}

describe('DescriptionProcessor', () => {
  it('updates a short description for GitHub links', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' - Short');

    const result = await runProcessor(processor, linkNode, parent);

    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('A great library');
  });

  it('skips if current description is already long enough', async () => {
    const processor = new DescriptionProcessor();
    const longDesc = ' - ' + 'x'.repeat(60);
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, longDesc);

    const result = await runProcessor(processor, linkNode, parent);
    expect(result.modified).toBe(false);
  });

  it('skips if no description found', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, null);
    expect(result.modified).toBe(false);
  });

  it('handles non-GitHub URLs', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 'A website description');
    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('A website description');
  });

  it('returns false when scraper fails', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(
      processor.execute(linkNode, parent, 0).pipe(Effect.provide(makeScraperErrorLayer())),
    );
    expect(result.modified).toBe(false);
  });

  it('skips if next node is not a text node', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode, { type: 'heading', value: 'Title' }] };

    const result = await runProcessor(processor, linkNode, parent, null);
    expect(result.modified).toBe(false);
  });

  it('skips if description is same as current text', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' - A great library for doing things');

    const result = await runProcessor(processor, linkNode, parent, 'A great library for doing things');
    expect(result.modified).toBe(false);
  });

  it('skips if link is the last child (no next node)', async () => {
    const processor = new DescriptionProcessor();
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });
});
