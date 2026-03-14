// tests/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import { createEngine, buildAppLayer, SilentLive, EnhanceOptionsSchema } from '../src/index.js';
import { CacheService } from '../src/services/cache.js';
import { Layer, Option } from 'effect';

describe('core exports', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'enhance-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('exports createEngine', () => {
    expect(typeof createEngine).toBe('function');
  });

  it('exports buildAppLayer', () => {
    expect(typeof buildAppLayer).toBe('function');
  });

  it('creates engine and processes content', async () => {
    const engine = createEngine({
      addMetadata: false,
      updateDescriptions: false,
      detectStale: false,
      detectRedirects: false,
    });
    const content = '# Title\n\n- [Link](https://example.com) - Desc\n';
    const NoCacheLayer = Layer.succeed(CacheService, {
      get: () => Effect.succeed(Option.none()),
      set: () => Effect.void,
    });
    const TestLayer = Layer.mergeAll(SilentLive, NoCacheLayer);
    const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(TestLayer)));
    expect(result.content).toContain('Link');
    expect(result.content).toContain('https://example.com');
  });

  it('validates options schema', () => {
    expect(() => EnhanceOptionsSchema.parse({ cacheTTL: 'bad' })).toThrow();
  });
});
