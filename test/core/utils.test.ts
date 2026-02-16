import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, isValidUrl, formatNumber } from '../../src/core/utils.js';

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
