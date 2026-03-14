import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.tsx', 'tests/**'],
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['esm'],
    },
    outDir: 'dist/src',
    minify: false,
    sourcemap: false,
    rollupOptions: {
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
        'effect',
        'zod',
        'zod-to-json-schema',
        '@modelcontextprotocol/sdk',
        'react',
        'ink',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
});
