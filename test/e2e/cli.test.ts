import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

const CLI_PATH = './bin/cli.ts';
const TEST_SAMPLE = './test/sample-awesome.md';

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
    const result = await runCli([
      'enhance',
      TEST_SAMPLE,
      '--add-metadata',
      '--skip-lint',
      '--dry-run',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('axios');
    expect(result.stdout).toContain('img.shields.io/github/stars');
  });

  it('runs in dry-run mode without modifying files', async () => {
    const originalContent = await fs.readFile(TEST_SAMPLE, 'utf-8');

    const result = await runCli([
      'enhance',
      TEST_SAMPLE,
      '--add-metadata',
      '--skip-lint',
      '--dry-run',
    ]);

    expect(result.code).toBe(0);
    const afterContent = await fs.readFile(TEST_SAMPLE, 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  it('supports skip-lint option', async () => {
    const result = await runCli([
      'enhance',
      TEST_SAMPLE,
      '--add-metadata',
      '--skip-lint',
      '--dry-run',
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('awesome-lint');
  });
});

describe('E2E: GitHub URL Enhancement', () => {
  it('enhances a GitHub repository URL', async () => {
    const result = await runCli([
      'enhance',
      'https://github.com/axios/axios',
      '--add-metadata',
      '--skip-lint',
      '--dry-run',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('axios');
  }, 30000);

  it('fetches real GitHub metadata for repository', async () => {
    const result = await runCli([
      'enhance',
      'https://github.com/cheeriojs/cheerio',
      '--add-metadata',
      '--skip-lint',
      '--dry-run',
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('cheerio');
    expect(result.stdout).toMatch(/stars|forks/i);
  }, 30000);
});

describe('E2E: Validation with Real Awesome Lists', () => {
  const awesomeLists = [
    { url: 'https://github.com/sindresorhus/awesome', name: 'awesome' },
    { url: 'https://github.com/sindresorhus/awesome-nodejs', name: 'awesome-nodejs' },
    { url: 'https://github.com/awesome-selfhosted/awesome-selfhosted', name: 'awesome-selfhosted' },
    { url: 'https://github.com/puppeteer/puppeteer', name: 'puppeteer' },
    { url: 'https://github.com/facebook/react', name: 'react' },
    { url: 'https://github.com/nodejs/node', name: 'node' },
    { url: 'https://github.com/oven-sh/bun', name: 'bun' },
    { url: 'https://github.com/denoland/deno', name: 'deno' },
    { url: 'https://github.com/vercel/next.js', name: 'next.js' },
    { url: 'https://github.com/expressjs/express', name: 'express' },
    { url: 'https://github.com/mrdoob/three.js', name: 'three.js' },
    { url: 'https://github.com/pmndrs/react-three-fiber', name: 'react-three-fiber' },
    { url: 'https://github.com/strapi/strapi', name: 'strapi' },
    { url: 'https://github.com/mui/material-ui', name: 'material-ui' },
    { url: 'https://github.com/tailwindlabs/tailwindcss', name: 'tailwindcss' },
  ];

  for (const list of awesomeLists) {
    it(`validates ${list.name}`, async () => {
      const result = await runCli([
        'enhance',
        list.url,
        '--add-metadata',
        '--skip-lint',
        '--dry-run',
      ]);

      if (
        result.stderr.includes('rate limit') ||
        result.stderr.includes('429') ||
        result.stdout.includes('rate limit') ||
        result.stdout.includes('429')
      ) {
        console.log(`⚠️  GitHub API rate limited for ${list.name}, skipping`);
        return;
      }
      expect(result.code).toBe(0);
    }, 60000);
  }
});

describe('E2E: Help and CLI Interface', () => {
  it('shows help when no arguments provided', async () => {
    const result = await runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('enhance');
  });

  it('shows enhance subcommand help', async () => {
    const result = await runCli(['enhance', '--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--add-metadata');
    expect(result.stdout).toContain('--update-descriptions');
  });
});
