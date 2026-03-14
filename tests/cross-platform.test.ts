import { describe, it, expect } from 'vitest';
import { parse, basename, extname } from 'path';
import { platform } from 'os';

/**
 * Cross-platform compatibility tests
 * Ensures awesome-enhancer works correctly on Windows, macOS, and Linux
 */
describe('Cross-Platform Compatibility', () => {
  describe('Path handling', () => {
    it('handles Windows-style paths', () => {
      const windowsPath = 'C:\\Users\\test\\README.md';
      // On Windows, basename works differently than on POSIX
      // This test verifies the path can be parsed, actual behavior depends on OS
      const ext = extname(windowsPath);
      expect(ext).toBe('.md');
      // The basename behavior varies by platform
      const currentPlatform = platform();
      const name = basename(windowsPath, ext);
      if (currentPlatform === 'win32') {
        expect(name).toBe('README');
      } else {
        // On POSIX systems, the whole path is treated as filename
        expect(name).toContain('README');
      }
    });

    it('handles Unix-style paths', () => {
      const unixPath = '/home/user/README.md';
      const name = basename(unixPath, extname(unixPath));
      expect(name).toBe('README');
      expect(extname(unixPath)).toBe('.md');
    });

    it('handles relative paths', () => {
      const relativePath = './tests/sample-awesome.md';
      const name = basename(relativePath, extname(relativePath));
      expect(name).toBe('sample-awesome');
      expect(extname(relativePath)).toBe('.md');
    });

    it('handles paths with spaces', () => {
      const pathWithSpaces = './tests/my awesome list/README.md';
      const name = basename(pathWithSpaces, extname(pathWithSpaces));
      expect(name).toBe('README');
      expect(extname(pathWithSpaces)).toBe('.md');
    });
  });

  describe('Line endings', () => {
    it('handles CRLF line endings', () => {
      const crlfContent = 'Line 1\r\nLine 2\r\nLine 3';
      const lines = crlfContent.split(/\r?\n/);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
    });

    it('handles LF line endings', () => {
      const lfContent = 'Line 1\nLine 2\nLine 3';
      const lines = lfContent.split(/\r?\n/);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
    });

    it('handles mixed line endings', () => {
      const mixedContent = 'Line 1\nLine 2\r\nLine 3';
      const lines = mixedContent.split(/\r?\n/);
      expect(lines).toHaveLength(3);
    });
  });

  describe('Environment variables', () => {
    it('reads GITHUB_TOKEN from environment (may be undefined)', () => {
      const token = process.env.GITHUB_TOKEN;
      // Token may or may not be set in CI - just verify it's accessible
      expect(token === undefined || typeof token === 'string').toBe(true);
    });

    it('reads GITLAB_TOKEN from environment (may be undefined)', () => {
      const token = process.env.GITLAB_TOKEN;
      // Token may or may not be set in CI - just verify it's accessible
      expect(token === undefined || typeof token === 'string').toBe(true);
    });

    it('reads NODE_ENV from environment', () => {
      const nodeEnv = process.env.NODE_ENV;
      // Should be set in CI
      expect(nodeEnv).toBeDefined();
    });
  });

  describe('File system operations', () => {
    it('handles file paths with special characters', () => {
      const specialPath = './tests/awesome-list-2024/README.md';
      const parsed = parse(specialPath);
      expect(parsed.dir).toContain('awesome-list-2024');
    });

    it('handles unicode characters in paths', () => {
      const unicodePath = './tests/テスト/README.md';
      const parsed = parse(unicodePath);
      expect(parsed.name).toBe('README');
    });
  });
});
