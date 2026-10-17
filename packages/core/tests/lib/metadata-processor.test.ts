import { describe, it, expect } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { MetadataProcessor } from '../../src/lib/metadata-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import { GitHubService } from '../../src/services/github.js';
import { GitLabService } from '../../src/services/gitlab.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import { NetworkError } from '../../src/core/errors.js';

function makeGitLabLayer(metadata: any) {
  return Layer.succeed(GitLabService, {
    fetchRepoMetadata: () =>
      metadata === null
        ? Effect.fail(new NetworkError({ url: '', message: 'not found', statusCode: 404 }))
        : Effect.succeed(metadata),
    fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
    getRateLimitStatus: () => Effect.succeed(Option.none()),
  });
}

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

  it('skips links that already have all metadata badges', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(
      linkNode,
      ' <img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars"> <img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks"> <img src="https://img.shields.io/github/languages/top/user/repo?style=flat-square" alt="Language"> <img src="https://img.shields.io/github/last-commit/user/repo?style=flat-square" alt="Last Commit">',
    );

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });

  it('adds badges when only non-metadata shields.io badge exists', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(
      linkNode,
      ' <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">',
    );

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io/github/stars');
  });

  it('returns false when metadata fetch fails (NetworkError)', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0, null);
    expect(result.modified).toBe(false);
  });

  it('creates an html node if none exists after the link', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children.length).toBe(2);
    expect(parent.children[1].type).toBe('html');
  });

  it('skips if next node is not a text node', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode, { type: 'heading', value: 'Title' }] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });

  it('skips when all badges are already present', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(
      linkNode,
      ' <img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars"> <img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks"> <img src="https://img.shields.io/github/languages/top/user/repo?style=flat-square" alt="Language"> <img src="https://img.shields.io/github/last-commit/user/repo?style=flat-square" alt="Last Commit">',
    );

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(false);
  });

  it('adds only missing badges when some badges exist', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(
      linkNode,
      ' <img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars">',
    );

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    // Processor splices an html node with the missing badges at index+1,
    // pushing the original text node (which has stars) to index+2
    const htmlNode = parent.children[1];
    expect(htmlNode.type).toBe('html');
    expect(htmlNode.value).not.toContain('img.shields.io/github/stars'); // not duplicated
    expect(htmlNode.value).toContain('img.shields.io/github/forks');
    expect(htmlNode.value).toContain('img.shields.io/github/languages/top');
    expect(htmlNode.value).toContain('img.shields.io/github/last-commit');
    // Stars badge should appear exactly once across all child nodes
    const allContent = parent.children.map((c: any) => c.value ?? '').join('');
    const starsMatches = allContent.match(/img\.shields\.io\/github\/stars/g);
    expect(starsMatches).toHaveLength(1);
  });

  it('adds missing badges when only forks badge exists', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(
      linkNode,
      ' <img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks">',
    );

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    // Should add stars, language, and last-commit
    expect(parent.children[1].value).toContain('img.shields.io/github/stars');
    expect(parent.children[1].value).toContain('img.shields.io/github/languages/top');
    expect(parent.children[1].value).toContain('img.shields.io/github/last-commit');
  });

  it('appends to existing html node when one follows the link', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/user/repo');
    const existingHtmlNode = { type: 'html', value: ' <img src="existing-badge">' };
    const parent = { children: [linkNode, existingHtmlNode] };

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children.length).toBe(2); // no new node spliced
    expect(parent.children[1].value).toContain('existing-badge');
    expect(parent.children[1].value).toContain('img.shields.io');
  });

  it('skips disabled badges but still adds language', async () => {
    // language has no flag; stars/forks/last-commit can be disabled
    const processor = new MetadataProcessor(new BadgeGenerator(), false, false, false);
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children[1].value).not.toContain('img.shields.io/github/stars');
    expect(parent.children[1].value).not.toContain('img.shields.io/github/forks');
    expect(parent.children[1].value).not.toContain('img.shields.io/github/last-commit');
    expect(parent.children[1].value).toContain('img.shields.io/github/languages/top');
  });

  it('adds only enabled badges when some flags are false', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator(), true, false, false);
    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await runProcessor(processor, linkNode, parent, 0);
    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io/github/stars');
    expect(parent.children[1].value).not.toContain('img.shields.io/github/forks');
    expect(parent.children[1].value).not.toContain('img.shields.io/github/last-commit');
  });

  it('adds badges for GitLab links', async () => {
    const processor = new MetadataProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://gitlab.com/user/repo');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(
      processor.execute(linkNode, parent, 0).pipe(
        Effect.provide(
          makeGitHubLayer({ stargazers_count: 100 }).pipe(
            Layer.merge(
              makeGitLabLayer({
                stars: 100,
                forks: 10,
                language: 'Go',
                lastCommit: '2024-01-01',
              }),
            ),
          ),
        ),
      ),
    );

    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io/gitlab');
  });
});
