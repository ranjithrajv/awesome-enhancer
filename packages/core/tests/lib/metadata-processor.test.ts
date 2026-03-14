import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { MetadataProcessor } from '../../src/lib/metadata-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import { GitHubService } from '../../src/services/github.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeGitHubLayer(metadata: any) {
  return Layer.succeed(GitHubService, {
    fetchRepoMetadata: () =>
      metadata === null
        ? Effect.fail(new NetworkError({ url: '', message: 'not found', statusCode: 404 }))
        : Effect.succeed(metadata),
    fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
    getRateLimitStatus: () => Effect.succeed(Option.none()),
  });
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText = ' - Description') {
  return { children: [linkNode, { type: 'text', value: trailingText }] };
}

function runProcessor(
  processor: MetadataProcessor,
  linkNode: LinkNode,
  parent: any,
  index: number,
  metadata: any = { stargazers_count: 100 },
) {
  return Effect.runPromise(
    processor.execute(linkNode, parent, index).pipe(Effect.provide(makeGitHubLayer(metadata))),
  );
}

describe('MetadataProcessor', () => {
  it('adds badges for GitHub links', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator('flat-square'));
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);

    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io');
  });

  it('skips non-GitHub links', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });

  it('skips links that already have badges', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' img.shields.io existing badge');

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });

  it('returns false when metadata fetch fails (NetworkError)', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0, null);
    expect(result.modified).toBe(false);
  });

  it('creates a text node if none exists after the link', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children.length).toBe(2);
  });

  it('skips if next node is not a text node', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode, { type: 'heading', value: 'Title' }] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });
});
