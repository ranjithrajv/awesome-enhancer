import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/bundle.ts'),
      name: 'AE',
      formats: ['iife'],
    },
    outDir: 'dist',
    copyPublicDir: false,
    rollupOptions: {
      output: { entryFileNames: 'bundle.js' },
    },
  },
  define: {
    // dotenv.config() is called at module level in config.ts — stub process so it doesn't throw
    'process.env.NODE_ENV': '"production"',
    'process.env': '({})',
    'process.cwd': '(() => "/")',
  },
  resolve: {
    alias: {
      dotenv: resolve(__dirname, 'src/shims/empty.js'),
      'fs/promises': resolve(__dirname, 'src/shims/empty.js'),
      fs: resolve(__dirname, 'src/shims/empty.js'),
      path: resolve(__dirname, 'src/shims/empty.js'),
      os: resolve(__dirname, 'src/shims/empty.js'),
      crypto: resolve(__dirname, 'src/shims/empty.js'),
      'node:fs/promises': resolve(__dirname, 'src/shims/empty.js'),
      'node:fs': resolve(__dirname, 'src/shims/empty.js'),
      'node:path': resolve(__dirname, 'src/shims/empty.js'),
      'node:os': resolve(__dirname, 'src/shims/empty.js'),
      'node:crypto': resolve(__dirname, 'src/shims/empty.js'),
    },
  },
  plugins: [
    {
      name: 'copy-index-html',
      closeBundle() {
        copyFileSync(resolve(__dirname, 'index.html'), resolve(__dirname, 'dist/index.html'));
      },
    },
  ],
});
