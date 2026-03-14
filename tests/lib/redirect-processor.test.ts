import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { RedirectProcessor } from '../../src/lib/redirect-processor.js';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';
import type { LinkNode } from '../../src/lib/processor-engine.js';
import axios from 'axios';

const mockAxios = axios as unknown as { head: ReturnType<typeof vi.fn> };
vi.mock('axios', () => ({
  default: {
    head: vi.fn(),
  },
}));

function createLinkNode(url: string): LinkNode {
  return { type: 'link', url, children: [{ type: 'text', value: 'Link' }] } as LinkNode;
}

function createParent(linkNode: LinkNode, trailingText = ' - Description') {
  return { children: [linkNode, { type: 'text', value: trailingText }] };
}

describe('RedirectProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips non-GitHub links', async () => {
    const processor = new RedirectProcessor(new BadgeGenerator('flat-square'));
    const linkNode = createLinkNode('https://example.com');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(false);
  });

  it('skips links that already have redirect badge', async () => {
    const processor = new RedirectProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/facebook/react');
    const parent = createParent(linkNode, ' - Description img.shields.io/badge/status-transferred');

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(false);
    expect(mockAxios.head).not.toHaveBeenCalled();
  });

  it('detects redirect and adds badge', async () => {
    mockAxios.head.mockImplementation(() =>
      Promise.resolve({
        headers: { location: 'https://github.com/new-owner/new-repo' },
      }),
    );

    const processor = new RedirectProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/old-owner/old-repo');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('transferred-new-owner');
  });

  it('detects rename and adds badge', async () => {
    mockAxios.head.mockImplementation(() =>
      Promise.resolve({
        headers: { location: 'https://github.com/facebook/new-name' },
      }),
    );

    const processor = new RedirectProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/facebook/old-name');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(true);
    expect(parent.children[1].value).toContain('renamed-facebook');
  });

  it('returns modified false when no location header', async () => {
    mockAxios.head.mockImplementation(() =>
      Promise.resolve({
        headers: {},
      }),
    );

    const processor = new RedirectProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/facebook/react');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(false);
  });

  it('returns modified false when network error occurs', async () => {
    mockAxios.head.mockImplementation(() => Promise.reject(new Error('Network error')));

    const processor = new RedirectProcessor(new BadgeGenerator());
    const linkNode = createLinkNode('https://github.com/facebook/react');
    const parent = createParent(linkNode);

    const result = await Effect.runPromise(processor.execute(linkNode, parent, 0));

    expect(result.modified).toBe(false);
  });
});
