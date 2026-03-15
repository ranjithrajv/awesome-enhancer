import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [/^node:/, ...builtinModules],
      output: {
        entryFileNames: 'index.js',
      },
    },
    target: 'node20',
    minify: false,
  },
});
