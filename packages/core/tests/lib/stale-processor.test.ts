import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { StaleProcessor } from '../../src/lib/stale-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import { GitHubService } from '../../src/services/github.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeGitHubLayer(result: 'archived' | 'disabled' | 'healthy' | 'not-found' | 'error') {
  return Layer.succeed(GitHubService, {
    fetchRepoMetadata: () => {
      if (result === 'not-found') {
        return Effect.fail(new NetworkError({ url: '', message: 'Not Found', statusCode: 404 }));
      }
      if (result === 'error') {
        return Effect.fail(new NetworkError({ url: '', message: 'Server Error', statusCode: 500 }));
      }
      return Effect.succeed({
        stars: 100,
        forks: 10,
        language: 'TypeScript',
        lastCommit: '2024-01-01',
        archived: result === 'archived',
        disabled: result === 'disabled',
      });
    },
    fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
    getRateLimitStatus: () => Effect.succeed(Option.none()),
  });
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function run(processor: StaleProcessor, linkNode: LinkNode, parent: any, layer: any) {
  return Effect.runPromise(processor.execute(linkNode, parent, 0).pipe(Effect.provide(layer)));
}

describe('StaleProcessor', () => {
  it('skips non-GitHub links', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://example.com');
    const parent = { children: [linkNode, { type: 'text', value: '' }] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('healthy'));
    expect(result.modified).toBe(false);
  });

  it('skips when stale badge already present', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = {
      children: [
        linkNode,
        { type: 'html', value: ' <img src="https://img.shields.io/badge/status-archived-red">' },
      ],
    };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('archived'));
    expect(result.modified).toBe(false);
  });

  it('skips if next node is a structural node', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode, { type: 'heading', value: 'Title' }] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('healthy'));
    expect(result.modified).toBe(false);
  });

  it('marks as not-found when 404', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/deleted-repo');
    const parent = { children: [linkNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('not-found'));
    expect(result.modified).toBe(true);
    expect(result.staleEntry?.reason).toBe('not-found');
    expect(parent.children[1].type).toBe('html');
    expect(parent.children[1].value).toContain('status-archived');
  });

  it('returns false for non-404 errors', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('error'));
    expect(result.modified).toBe(false);
  });

  it('returns false when repo is healthy', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('healthy'));
    expect(result.modified).toBe(false);
  });

  it('marks as archived when repo is archived', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('archived'));
    expect(result.modified).toBe(true);
    expect(result.staleEntry?.reason).toBe('archived');
    expect(parent.children[1].type).toBe('html');
    expect(parent.children[1].value).toContain('status-archived');
  });

  it('marks as disabled when repo is disabled', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('disabled'));
    expect(result.modified).toBe(true);
    expect(result.staleEntry?.reason).toBe('disabled');
  });

  it('appends to existing html node when one follows the link', async () => {
    const processor = new StaleProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const existingHtmlNode = { type: 'html', value: ' <img src="existing-badge">' };
    const parent = { children: [linkNode, existingHtmlNode] };

    const result = await run(processor, linkNode, parent, makeGitHubLayer('archived'));
    expect(result.modified).toBe(true);
    expect(parent.children.length).toBe(2); // no new node spliced
    expect(parent.children[1].value).toContain('existing-badge');
    expect(parent.children[1].value).toContain('status-archived');
  });
});
