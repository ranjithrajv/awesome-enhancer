import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'bin/http-server.ts'),
      formats: ['esm'],
    },
    outDir: 'dist/bin',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
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
        'effect',
        'zod',
        'zod-to-json-schema',
        '@modelcontextprotocol/sdk',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
});
