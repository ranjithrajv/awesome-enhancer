import { describe, it, expect } from 'vitest';
import { BadgeGenerator } from '../../src/lib/badge-generator.js';

describe('BadgeGenerator', () => {
  const generator = new BadgeGenerator('flat-square');

  describe('generateBadge (HTML)', () => {
    it('generates stars badge', () => {
      const badge = generator.generateBadge('stars', 'user', 'repo', true);
      expect(badge).toBe(
        '<img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars">',
      );
    });

    it('generates language badge', () => {
      const badge = generator.generateBadge('language', 'user', 'repo', true);
      expect(badge).toContain('languages/top/user/repo');
      expect(badge).toContain('alt="Language"');
    });

    it('generates forks badge', () => {
      const badge = generator.generateBadge('forks', 'user', 'repo', true);
      expect(badge).toContain('forks/user/repo');
    });

    it('generates last-commit badge', () => {
      const badge = generator.generateBadge('last-commit', 'user', 'repo', true);
      expect(badge).toContain('last-commit/user/repo');
    });
  });

  describe('generateBadge (Markdown)', () => {
    it('generates markdown format when useHtml is false', () => {
      const badge = generator.generateBadge('stars', 'user', 'repo', false);
      expect(badge).toBe(
        '![Stars](https://img.shields.io/github/stars/user/repo?style=flat-square)',
      );
    });
  });

  describe('badge style', () => {
    it('uses custom style', () => {
      const custom = new BadgeGenerator('for-the-badge');
      const badge = custom.generateBadge('stars', 'user', 'repo', false);
      expect(badge).toContain('style=for-the-badge');
    });

    it('defaults to flat-square', () => {
      const defaultGen = new BadgeGenerator();
      const badge = defaultGen.generateBadge('stars', 'user', 'repo', false);
      expect(badge).toContain('style=flat-square');
    });
  });

  describe('generateRedirectBadge', () => {
    it('generates redirect badge', () => {
      const badge = generator.generateRedirectBadge('redirect', 'old', 'new');
      expect(badge).toBe(
        '<img src="https://img.shields.io/badge/redirect-old/new-blue?style=flat-square" alt="redirect">',
      );
    });

    it('generates redirect badge with custom label', () => {
      const badge = generator.generateRedirectBadge('moved', 'user', 'repo');
      expect(badge).toContain('moved');
      expect(badge).toContain('user/repo');
    });
  });

  describe('status-archived badge', () => {
    it('generates status-archived badge without github prefix', () => {
      const badge = generator.generateBadge('status-archived', 'user', 'repo', true);
      expect(badge).toBe(
        '<img src="https://img.shields.io/badge/status-archived-red?style=flat-square" alt="Status">',
      );
    });

    it('generates status-archived badge in markdown format', () => {
      const badge = generator.generateBadge('status-archived', 'user', 'repo', false);
      expect(badge).toBe('![Status](https://img.shields.io/badge/status-archived-red?style=flat-square)');
    });
  });
});
