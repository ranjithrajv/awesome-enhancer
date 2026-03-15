import { describe, it, expect } from 'vitest';
import {
  parseGitHubUrl,
  parseGitLabUrl,
  isValidUrl,
  formatNumber,
  detectExistingBadges,
  getMissingBadges,
} from '../../src/core/utils.js';

describe('parseGitHubUrl', () => {
  it('parses standard GitHub URLs', () => {
    expect(parseGitHubUrl('https://github.com/sindresorhus/awesome')).toEqual({
      owner: 'sindresorhus',
      repo: 'awesome',
    });
  });

  it('parses GitHub URLs with .git suffix', () => {
    expect(parseGitHubUrl('https://github.com/user/repo.git')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('parses URLs with trailing path segments', () => {
    const result = parseGitHubUrl('https://github.com/user/repo/tree/main');
    expect(result).toEqual({ owner: 'user', repo: 'repo' });
  });

  it('parses URLs with query strings', () => {
    const result = parseGitHubUrl('https://github.com/user/repo?tab=readme');
    expect(result).toEqual({ owner: 'user', repo: 'repo' });
  });

  it('parses URLs with hash fragments', () => {
    const result = parseGitHubUrl('https://github.com/user/repo#readme');
    expect(result).toEqual({ owner: 'user', repo: 'repo' });
  });

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/user/repo')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(parseGitHubUrl('')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(parseGitHubUrl('not a url')).toBeNull();
  });
});

describe('isValidUrl', () => {
  it('returns true for valid HTTP URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('returns true for URLs with paths', () => {
    expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('returns false for relative paths', () => {
    expect(isValidUrl('/path/to/file')).toBe(false);
  });
});

describe('formatNumber', () => {
  it('returns number as-is below 1000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(42)).toBe('42');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(99999)).toBe('100.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

describe('parseGitLabUrl', () => {
  it('parses standard GitLab URLs', () => {
    expect(parseGitLabUrl('https://gitlab.com/sindresorhus/awesome')).toEqual({
      owner: 'sindresorhus',
      repo: 'awesome',
    });
  });

  it('parses GitLab URLs with .git suffix', () => {
    expect(parseGitLabUrl('https://gitlab.com/user/repo.git')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('parses URLs with trailing path segments', () => {
    const result = parseGitLabUrl('https://gitlab.com/user/repo/tree/main');
    expect(result).toEqual({ owner: 'user', repo: 'repo' });
  });

  it('returns null for non-GitLab URLs', () => {
    expect(parseGitLabUrl('https://github.com/user/repo')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(parseGitLabUrl('')).toBeNull();
  });
});

describe('detectExistingBadges', () => {
  it('detects stars badge', () => {
    const text =
      '<img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars">';
    expect(detectExistingBadges(text)).toEqual(['stars']);
  });

  it('detects forks badge', () => {
    const text =
      '<img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks">';
    expect(detectExistingBadges(text)).toEqual(['forks']);
  });

  it('detects language badge', () => {
    const text =
      '<img src="https://img.shields.io/github/languages/top/user/repo?style=flat-square" alt="Language">';
    expect(detectExistingBadges(text)).toEqual(['language']);
  });

  it('detects last-commit badge', () => {
    const text =
      '<img src="https://img.shields.io/github/last-commit/user/repo?style=flat-square" alt="Last Commit">';
    expect(detectExistingBadges(text)).toEqual(['last-commit']);
  });

  it('detects multiple badges', () => {
    const text =
      '<img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars"> <img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks">';
    expect(detectExistingBadges(text)).toEqual(['stars', 'forks']);
  });

  it('detects all four badges', () => {
    const text =
      '<img src="https://img.shields.io/github/stars/user/repo?style=flat-square" alt="Stars"> <img src="https://img.shields.io/github/forks/user/repo?style=flat-square" alt="Forks"> <img src="https://img.shields.io/github/languages/top/user/repo?style=flat-square" alt="Language"> <img src="https://img.shields.io/github/last-commit/user/repo?style=flat-square" alt="Last Commit">';
    expect(detectExistingBadges(text)).toEqual(['stars', 'forks', 'language', 'last-commit']);
  });

  it('returns empty array when no badges present', () => {
    const text = 'Just some description without badges';
    expect(detectExistingBadges(text)).toEqual([]);
  });

  it('is case insensitive', () => {
    const text =
      '<IMG SRC="HTTPS://IMG.SHIELDS.IO/GITHUB/STARS/USER/REPO?STYLE=FLAT-SQUARE" ALT="Stars">';
    expect(detectExistingBadges(text)).toEqual(['stars']);
  });

  it('detects GitLab stars badge', () => {
    const text =
      '<img src="https://img.shields.io/gitlab/stars/user/repo?style=flat-square" alt="Stars">';
    expect(detectExistingBadges(text)).toEqual(['stars']);
  });

  it('detects GitLab forks badge', () => {
    const text =
      '<img src="https://img.shields.io/gitlab/forks/user/repo?style=flat-square" alt="Forks">';
    expect(detectExistingBadges(text)).toEqual(['forks']);
  });

  it('detects GitLab last-commit badge', () => {
    const text =
      '<img src="https://img.shields.io/gitlab/last-commit/user/repo?style=flat-square" alt="Last Commit">';
    expect(detectExistingBadges(text)).toEqual(['last-commit']);
  });
});

describe('getMissingBadges', () => {
  it('returns all badges when none exist', () => {
    expect(getMissingBadges([])).toEqual(['stars', 'forks', 'language', 'last-commit']);
  });

  it('returns missing badges when some exist', () => {
    expect(getMissingBadges(['stars'])).toEqual(['forks', 'language', 'last-commit']);
  });

  it('returns missing badges when multiple exist', () => {
    expect(getMissingBadges(['stars', 'forks'])).toEqual(['language', 'last-commit']);
  });

  it('returns empty array when all badges exist', () => {
    expect(getMissingBadges(['stars', 'forks', 'language', 'last-commit'])).toEqual([]);
  });

  it('handles single missing badge', () => {
    expect(getMissingBadges(['stars', 'forks', 'language'])).toEqual(['last-commit']);
  });
});
