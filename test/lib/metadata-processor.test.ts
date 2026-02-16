import { describe, it, expect, vi } from 'vitest';
import { MetadataProcessor } from '../../src/lib/metadata-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import type { GitHubService } from '../../src/services/github.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';

function createMockGitHubService(metadata: any = { stargazers_count: 100 }) {
  return {
    fetchRepoMetadata: vi.fn().mockResolvedValue(metadata),
  } as unknown as GitHubService;
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText: string = ' - Description') {
  return {
    children: [linkNode, { type: 'text', value: trailingText }],
  };
}

describe('MetadataProcessor', () => {
  it('adds badges for GitHub links', async () => {
    const githubService = createMockGitHubService();
    const badgeGenerator = new BadgeGenerator('flat-square');
    const processor = new MetadataProcessor(githubService, badgeGenerator);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children[1].value).toContain('img.shields.io');
    expect(githubService.fetchRepoMetadata).toHaveBeenCalledWith('user', 'repo');
  });

  it('skips non-GitHub links', async () => {
    const githubService = createMockGitHubService();
    const badgeGenerator = new BadgeGenerator();
    const processor = new MetadataProcessor(githubService, badgeGenerator);

    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
    expect(githubService.fetchRepoMetadata).not.toHaveBeenCalled();
  });

  it('skips links that already have badges', async () => {
    const githubService = createMockGitHubService();
    const badgeGenerator = new BadgeGenerator();
    const processor = new MetadataProcessor(githubService, badgeGenerator);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' img.shields.io existing badge');

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
  });

  it('returns false when metadata fetch fails', async () => {
    const githubService = createMockGitHubService(null);
    const badgeGenerator = new BadgeGenerator();
    const processor = new MetadataProcessor(githubService, badgeGenerator);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode);

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
  });

  it('creates a text node if none exists after the link', async () => {
    const githubService = createMockGitHubService();
    const badgeGenerator = new BadgeGenerator();
    const processor = new MetadataProcessor(githubService, badgeGenerator);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children.length).toBe(2);
  });
});
