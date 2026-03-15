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
      // Externalize all Node built-ins (with and without node: prefix)
      // Everything else is bundled so the action works without node_modules
      external: [/^node:/, ...builtinModules],
      output: {
        entryFileNames: 'index.js',
      },
    },
    target: 'node20',
    minify: false,
  },
});
