import { defineConfig } from 'rolldown';

export default defineConfig([
  // Library Build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/src',
      format: 'esm',
      entryFileNames: '[name].js',
    },
    // @ts-expect-error - jsx option not yet in types
    jsx: 'react',
    external: [
      /^node:/,
      'axios',
      'cheerio',
      'commander',
      'dotenv',
      'awesome-lint',
      'fs',
      'fs/promises',
      'path',
      'url',
      'readline/promises',
      'unified',
      'remark-parse',
      'remark-stringify',
      'unist-util-visit',
    ],
  },
  // CLI Build
  {
    input: 'bin/cli.tsx',
    output: {
      dir: 'dist/bin',
      format: 'esm',
      entryFileNames: '[name].js',
      banner: '#!/usr/bin/env node\n',
    },
    // @ts-expect-error - jsx option not yet in types
    jsx: 'react',
    external: [
      'commander',
      'ink',
      'react',
      '../src/commands/enhance.js',
      '../src/index.js',
      /^node:/,
      'fs/promises',
      'path',
      'url',
      'readline/promises',
    ],
  },
  // MCP Server Build
  {
    input: 'bin/mcp-server.ts',
    output: {
      dir: 'dist/bin',
      format: 'esm',
      entryFileNames: '[name].js',
    },
    external: [
      /^node:/,
      'axios',
      'cheerio',
      'dotenv',
      'awesome-lint',
      'fs',
      'fs/promises',
      'path',
      'os',
      'url',
      'readline/promises',
      'unified',
      'remark-parse',
      'remark-stringify',
      'unist-util-visit',
    ],
  },
  // HTTP Server Build
  {
    input: 'bin/http-server.ts',
    output: {
      dir: 'dist/bin',
      format: 'esm',
      entryFileNames: '[name].js',
    },
    external: [
      /^node:/,
      'axios',
      'cheerio',
      'dotenv',
      'awesome-lint',
      'fs',
      'fs/promises',
      'path',
      'os',
      'url',
      'readline/promises',
      'unified',
      'remark-parse',
      'remark-stringify',
      'unist-util-visit',
    ],
  },
]);
