import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from 'axios';
import { GitHubService } from '../../src/services/github.js';

describe('GitHubService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'github-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates service with token', () => {
    const service = new GitHubService('test-token', 3600);
    expect(service).toBeDefined();
  });

  it('creates service without token', () => {
    const service = new GitHubService();
    expect(service).toBeDefined();
  });

  it('gets rate limit status', () => {
    const service = new GitHubService();
    const status = service.getRateLimitStatus();
    expect(status).toBeNull();
  });

  it('fetches repo metadata', async () => {
    const mockMetadata = {
      stargazers_count: 1000,
      forks_count: 100,
      language: 'TypeScript',
    };

    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockMetadata,
      headers: { 'x-ratelimit-remaining': '4999' },
    });

    const service = new GitHubService();
    const result = await service.fetchRepoMetadata('owner', 'repo');

    expect(result).toEqual(mockMetadata);
    expect(service.getRateLimitStatus()).toBe('4999');
  });

  it('returns null on fetch failure', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const service = new GitHubService();
    const result = await service.fetchRepoMetadata('owner', 'repo');

    expect(result).toBeNull();
  });

  it('fetches repo readme', async () => {
    const mockReadme = '# Hello World';

    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockReadme,
      headers: {},
    });

    const service = new GitHubService();
    const result = await service.fetchRepoReadme('owner', 'repo');

    expect(result).toBe(mockReadme);
  });

  it('returns null when readme fetch fails', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Not found'));

    const service = new GitHubService();
    const result = await service.fetchRepoReadme('owner', 'repo');

    expect(result).toBeNull();
  });
});
