import { describe, it, expect, vi } from 'vitest';
import { ProcessorEngine, type Processor, type LinkNode } from '../../src/lib/processor-engine.js';

describe('ProcessorEngine', () => {
  it('processes markdown with no processors (passthrough)', async () => {
    const engine = new ProcessorEngine();
    const input = '# Title\n\n- [Link](https://example.com) - Description\n';

    const output = await engine.process(input);
    expect(output).toContain('Link');
    expect(output).toContain('https://example.com');
  });

  it('calls registered processors for each link', async () => {
    const engine = new ProcessorEngine();
    const mockProcessor: Processor = {
      execute: vi.fn().mockResolvedValue(false),
    };

    engine.register(mockProcessor);

    const input = '- [Link1](https://example.com) - Desc1\n- [Link2](https://other.com) - Desc2\n';
    await engine.process(input);

    expect(mockProcessor.execute).toHaveBeenCalledTimes(2);
  });

  it('runs multiple processors in sequence per link', async () => {
    const engine = new ProcessorEngine();
    const order: string[] = [];

    const proc1: Processor = {
      execute: vi.fn().mockImplementation(async () => {
        order.push('proc1');
        return false;
      }),
    };
    const proc2: Processor = {
      execute: vi.fn().mockImplementation(async () => {
        order.push('proc2');
        return false;
      }),
    };

    engine.register(proc1);
    engine.register(proc2);

    await engine.process('- [Link](https://example.com)\n');

    expect(order).toEqual(['proc1', 'proc2']);
  });

  it('passes link node to processors', async () => {
    const engine = new ProcessorEngine();
    let capturedUrl = '';

    const proc: Processor = {
      execute: vi.fn().mockImplementation(async (linkNode: LinkNode) => {
        capturedUrl = linkNode.url;
        return false;
      }),
    };

    engine.register(proc);
    await engine.process('- [My Link](https://github.com/user/repo)\n');

    expect(capturedUrl).toBe('https://github.com/user/repo');
  });
});
