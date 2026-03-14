import { describe, it, expect, vi } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { ProcessorEngine, type Processor, type LinkNode } from '../../src/lib/processor-engine.js';
import { SilentLive } from '../../src/services/logger.js';
import { GitHubService } from '../../src/services/github.js';
import { ScraperService } from '../../src/services/scraper.js';
import { CacheService } from '../../src/services/cache.js';
import { NetworkError } from '../../src/core/errors.js';

// Minimal stub layers for services the processors don't use
const StubGitHubLayer = Layer.succeed(GitHubService, {
  fetchRepoMetadata: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
  fetchRepoReadme: () => Effect.fail(new NetworkError({ url: '', message: 'stub' })),
  getRateLimitStatus: () => Effect.succeed(Option.none()),
});

const StubScraperLayer = Layer.succeed(ScraperService, {
  fetchGitHubDescription: () => Effect.succeed(Option.none()),
  fetchWebsiteDescription: () => Effect.succeed(Option.none()),
});

const StubCacheLayer = Layer.succeed(CacheService, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
});

const TestLayer = Layer.mergeAll(SilentLive, StubGitHubLayer, StubScraperLayer, StubCacheLayer);

function runEngine(engine: ProcessorEngine, content: string) {
  return Effect.runPromise(engine.process(content).pipe(Effect.provide(TestLayer)));
}

describe('ProcessorEngine', () => {
  it('processes markdown with no processors (passthrough)', async () => {
    const engine = new ProcessorEngine();
    const input = '# Title\n\n- [Link](https://example.com) - Description\n';
    const output = await runEngine(engine, input);
    expect(output.content).toContain('Link');
    expect(output.content).toContain('https://example.com');
  });

  it('calls registered processors for each link', async () => {
    const engine = new ProcessorEngine();
    const mockProcessor: Processor = {
      execute: vi.fn().mockReturnValue(Effect.succeed({ modified: false })),
    };
    engine.register(mockProcessor);

    const input = '- [Link1](https://example.com) - Desc1\n- [Link2](https://other.com) - Desc2\n';
    await runEngine(engine, input);

    expect(mockProcessor.execute).toHaveBeenCalledTimes(2);
  });

  it('runs multiple processors in sequence per link', async () => {
    const engine = new ProcessorEngine();
    const order: string[] = [];

    const proc1: Processor = {
      execute: vi.fn().mockImplementation(() =>
        Effect.sync(() => {
          order.push('proc1');
          return { modified: false };
        }),
      ),
    };
    const proc2: Processor = {
      execute: vi.fn().mockImplementation(() =>
        Effect.sync(() => {
          order.push('proc2');
          return { modified: false };
        }),
      ),
    };

    engine.register(proc1);
    engine.register(proc2);

    await runEngine(engine, '- [Link](https://example.com)\n');

    expect(order).toEqual(['proc1', 'proc2']);
  });

  it('passes link node to processors', async () => {
    const engine = new ProcessorEngine();
    let capturedUrl = '';

    const proc: Processor = {
      execute: vi.fn().mockImplementation((linkNode: LinkNode) =>
        Effect.sync(() => {
          capturedUrl = linkNode.url;
          return { modified: false };
        }),
      ),
    };

    engine.register(proc);
    await runEngine(engine, '- [My Link](https://github.com/user/repo)\n');

    expect(capturedUrl).toBe('https://github.com/user/repo');
  });

  it('collects stale entries from processors', async () => {
    const engine = new ProcessorEngine();
    const staleEntry = { url: 'https://github.com/old/repo', reason: 'archived' };

    const proc: Processor = {
      execute: vi.fn().mockReturnValue(Effect.succeed({ modified: false, staleEntry })),
    };

    engine.register(proc);
    const result = await runEngine(engine, '- [Link](https://github.com/old/repo)\n');

    expect(result.staleEntries).toContainEqual(staleEntry);
  });

  it('collects redirect entries from processors', async () => {
    const engine = new ProcessorEngine();
    const redirectEntry = { oldUrl: 'https://old.com', newUrl: 'https://new.com' };

    const proc: Processor = {
      execute: vi.fn().mockReturnValue(Effect.succeed({ modified: false, redirectEntry })),
    };

    engine.register(proc);
    const result = await runEngine(engine, '- [Link](https://old.com)\n');

    expect(result.redirectEntries).toContainEqual(redirectEntry);
  });

  it('logs progress when a processor modifies a link', async () => {
    const engine = new ProcessorEngine();
    const proc: Processor = {
      execute: vi.fn().mockReturnValue(Effect.succeed({ modified: true })),
    };

    engine.register(proc);
    const result = await runEngine(engine, '- [Link](https://github.com/user/repo)\n');

    expect(result.content).toContain('Link');
  });
});
