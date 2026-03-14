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
      external: [/^node:/, 'ink', 'react', '@awesome-enhancer/core', 'awesome-lint', 'effect'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
