import { describe, it, expect, vi } from 'vitest';
import { DescriptionProcessor } from '../../src/lib/description-processor.js';
import type { ScraperService } from '../../src/services/scraper.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';

function createMockScraper(
  githubDesc: string | null = 'A great tool',
  webDesc: string | null = 'Website desc',
) {
  return {
    fetchGitHubDescription: vi.fn().mockResolvedValue(githubDesc),
    fetchWebsiteDescription: vi.fn().mockResolvedValue(webDesc),
  } as unknown as ScraperService;
}

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText: string = ' - Short') {
  return {
    children: [linkNode, { type: 'text', value: trailingText }],
  };
}

describe('DescriptionProcessor', () => {
  it('replaces short descriptions for GitHub links', async () => {
    const scraper = createMockScraper('A comprehensive testing framework');
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' - Short');

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children[1].value).toBe(' - A comprehensive testing framework');
    expect(scraper.fetchGitHubDescription).toHaveBeenCalledWith('user', 'repo');
  });

  it('replaces short descriptions for non-GitHub links', async () => {
    const scraper = createMockScraper(null, 'A website for cool stuff');
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://example.com/tool');
    const parent = createParent(linkNode, ' - Short');

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(true);
    expect(parent.children[1].value).toBe(' - A website for cool stuff');
    expect(scraper.fetchWebsiteDescription).toHaveBeenCalledWith('https://example.com/tool');
  });

  it('skips descriptions longer than 50 characters', async () => {
    const scraper = createMockScraper();
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const longDesc = ' - ' + 'A'.repeat(51);
    const parent = createParent(linkNode, longDesc);

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
    expect(scraper.fetchGitHubDescription).not.toHaveBeenCalled();
  });

  it('returns false when no next node exists', async () => {
    const scraper = createMockScraper();
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = { children: [linkNode] };

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
  });

  it('returns false when scraper returns null', async () => {
    const scraper = createMockScraper(null, null);
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode, ' - Short');

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
  });

  it('returns false when new description matches current', async () => {
    const scraper = createMockScraper('Short');
    const processor = new DescriptionProcessor(scraper);

    const linkNode = createLinkNode('https://github.com/user/repo');
    const parent = createParent(linkNode, ' - Short');

    const result = await processor.execute(linkNode, parent, 0);

    expect(result).toBe(false);
  });
});
