// tests/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import { enhance } from '../src/index.js';

describe('enhance()', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'enhance-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns an Effect', () => {
    const result = enhance('# Test\n');
    expect(typeof result.pipe).toBe('function'); // Effect has .pipe
  });

  it('passes through content with no processors registered', async () => {
    const result = await Effect.runPromise(
      enhance('# Title\n\n- [Link](https://example.com) - Desc\n'),
    );
    expect(result).toContain('Link');
    expect(result).toContain('https://example.com');
  });

  it('applies addMetadata option with GitHub links', async () => {
    const axios = await import('axios');
    (axios.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { stargazers_count: 500, language: 'TypeScript' },
      headers: {},
    });

    const content = '# Test\n\n- [Repo](https://github.com/user/repo) - A repo\n';
    const result = await Effect.runPromise(
      enhance(content, { addMetadata: true }),
    );
    expect(result).toContain('img.shields.io');
  });

  it('validates options with Zod and rejects invalid input', () => {
    expect(() => enhance('# Test\n', { cacheTTL: 'bad' as any })).toThrow();
  });
});
