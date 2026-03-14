import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'bin/cli.tsx'),
      formats: ['esm'],
    },
    outDir: 'dist/bin',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: [
        /^node:/,
        'ink',
        'react',
        '../src/**/*.js',
        'axios',
        'cheerio',
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
        'effect',
        'zod',
        'zod-to-json-schema',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
});
