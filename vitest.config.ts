import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'src/index.ts',
        'src/commands/**',
        'src/services/git.ts',
        'src/services/base-service.ts',
        'src/ui/**',
        'src/lib/stale-processor.ts',
        'src/lib/redirect-processor.ts',
        'src/services/gitlab.ts',
        'src/core/runner.ts',
        'src/core/engine-factory.ts',
        'src/core/config.ts',
        'src/core/errors.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    reportOnFailure: true,
  },
});
