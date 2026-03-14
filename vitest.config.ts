import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/core/tests/**/*.test.ts'],
    exclude: ['packages/core/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: [
        'packages/core/src/types/**',
        'packages/core/src/index.ts',
        'packages/core/src/commands/**',
        'packages/core/src/services/git.ts',
        'packages/core/src/services/base-service.ts',
        'packages/core/src/ui/**',
        'packages/core/src/lib/stale-processor.ts',
        'packages/core/src/lib/redirect-processor.ts',
        'packages/core/src/services/gitlab.ts',
        'packages/core/src/core/runner.ts',
        'packages/core/src/core/engine-factory.ts',
        'packages/core/src/core/config.ts',
        'packages/core/src/core/errors.ts',
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
