import { defineConfig } from 'vite-plus';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [/^node:/, '@awesome-enhancer/core'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
