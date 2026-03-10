import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

const CLI_PATH = './bin/cli.tsx';
const TEST_SAMPLE = './tests/sample-awesome.md';

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const cmd = `bun run ${CLI_PATH} ${args.join(' ')}`;
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? 1 : 0,
      });
    });
  });
}

describe('E2E: Local File Enhancement', () => {
  it('enhances local markdown file with metadata', async () => {
    const result = await runCli([TEST_SAMPLE, '--add-metadata', '--skip-lint', '--dry-run']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('axios');
    expect(result.stdout).toContain('img.shields.io/github/stars');
  });

  it('runs in dry-run mode without modifying files', async () => {
    const originalContent = await fs.readFile(TEST_SAMPLE, 'utf-8');

    const result = await runCli([TEST_SAMPLE, '--add-metadata', '--skip-lint', '--dry-run']);

    expect(result.code).toBe(0);
    const afterContent = await fs.readFile(TEST_SAMPLE, 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  it('supports skip-lint option', async () => {
    const result = await runCli([TEST_SAMPLE, '--add-metadata', '--skip-lint', '--dry-run']);

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('awesome-lint');
  });
});

describe('E2E: Help and CLI Interface', () => {
  it('shows help when no arguments provided', async () => {
    const result = await runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  it('shows version', async () => {
    const result = await runCli(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('awesome-enhance');
  });
});
