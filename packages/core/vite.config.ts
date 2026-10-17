import { defineConfig } from 'vite-plus';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    ssr: true,
    rollupOptions: {
      external: [/^node:/, 'axios', 'cheerio', 'dotenv', 'awesome-lint', 'fs', 'fs/promises'],
      output: {
        preserveModules: true,
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
