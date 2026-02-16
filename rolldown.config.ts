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
    input: 'bin/cli.ts',
    output: {
      dir: 'dist/bin',
      format: 'esm',
      entryFileNames: '[name].js',
      banner: '#!/usr/bin/env node\n',
    },
    external: [
      'commander',
      '../src/commands/enhance.js',
      '../src/index.js',
      /^node:/,
      'fs/promises',
      'path',
      'url',
      'readline/promises',
    ],
  },
]);
