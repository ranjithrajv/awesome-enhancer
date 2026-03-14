// tests/core/runner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('awesome-lint', () => ({ default: { report: vi.fn().mockResolvedValue(undefined) } }));

import { runEnhanceLocal, runEnhanceGithub } from '../../src/core/runner.js';

describe('runEnhanceLocal', () => {
  let tempDir: string;
  let originalCwd: string;
  let inputFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    inputFile = join(tempDir, 'test.md');
    await writeFile(inputFile, '# Test\n\n- [Link](https://example.com) - Desc\n', 'utf-8');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns success result for local file', async () => {
    const result = await runEnhanceLocal({
      file_path: inputFile,
      add_metadata: false,
      update_descriptions: false,
      dry_run: false,
    });

    expect(result.success).toBe(true);
    expect(result.enhanced_content).toBeDefined();
  });

  it('returns dry_run result when dry_run is true', async () => {
    const result = await runEnhanceLocal({
      file_path: inputFile,
      add_metadata: false,
      update_descriptions: false,
      dry_run: true,
    });

    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.preview).toBeDefined();
  });
});

describe('runEnhanceGithub', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'runner-gh-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns success result for GitHub URL', async () => {
    const axios = await import('axios');
    (axios.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '# Test Readme\n\n- [Link](https://example.com) - Desc\n',
      headers: {},
    });

    const result = await runEnhanceGithub({
      github_url: 'https://github.com/user/repo',
      add_metadata: false,
      update_descriptions: false,
      dry_run: false,
    });

    expect(result.success).toBe(true);
  });
});
