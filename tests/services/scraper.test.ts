import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import { ScraperService } from '../../src/services/scraper.js';
import axios from 'axios';

describe('ScraperService', () => {
  let tempDir: string;
  let originalCwd: string;

  // Use a temp dir per test so the file-based cache starts empty
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scraper-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('fetchGitHubDescription', () => {
    it('strips GitHub prefix from descriptions', async () => {
      const html = `<html><head><meta property="og:description" content="GitHub - user/repo: A great tool for testing"></head></html>`;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: html, headers: {} });

      const scraper = new ScraperService(3600);
      const result = await scraper.fetchGitHubDescription('user', 'repo');

      expect(result).toBe('A great tool for testing');
    });

    it('truncates descriptions over 200 characters', async () => {
      const longDesc = 'A'.repeat(250);
      const html = `<html><head><meta property="og:description" content="${longDesc}"></head></html>`;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: html, headers: {} });

      const scraper = new ScraperService(3600);
      const result = await scraper.fetchGitHubDescription('user', 'repo');

      expect(result!.length).toBe(200);
      expect(result!.endsWith('...')).toBe(true);
    });

    it('returns null when fetch fails', async () => {
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const scraper = new ScraperService(3600);
      const result = await scraper.fetchGitHubDescription('user', 'repo');

      expect(result).toBeNull();
    });
  });

  describe('fetchWebsiteDescription', () => {
    it('extracts meta description', async () => {
      const html = `<html><head><meta name="description" content="A cool website"></head></html>`;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: html, headers: {} });

      const scraper = new ScraperService(3600);
      const result = await scraper.fetchWebsiteDescription('https://example.com');

      expect(result).toBe('A cool website');
    });

    it('falls back to og:description', async () => {
      const html = `<html><head><meta property="og:description" content="OG description"></head></html>`;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: html, headers: {} });

      const scraper = new ScraperService(3600);
      const result = await scraper.fetchWebsiteDescription('https://example.com');

      expect(result).toBe('OG description');
    });

    it('returns null for invalid URLs', async () => {
      const scraper = new ScraperService(3600);
      const result = await scraper.fetchWebsiteDescription('not-a-url');

      expect(result).toBeNull();
    });
  });
});
