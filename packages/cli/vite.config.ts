import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['esm'],
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      // /^react(\/|$)/ covers 'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', etc.
      // Without the regex, react/jsx-runtime gets bundled as CJS which calls require('react'),
      // crashing in Node.js strict ESM where require() is not available.
      external: [/^node:/, /^react(\/|$)/, 'ink', '@awesome-enhancer/core', 'awesome-lint', 'effect'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
