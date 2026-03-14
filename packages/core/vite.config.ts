import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.tsx'],
      tsconfigPath: './tsconfig.json',
    }),
  ],
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
