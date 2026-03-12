import { describe, it, expect, vi } from 'vitest';
import { Effect } from 'effect';
import { LoggerService, ConsoleLive, SilentLive } from '../../src/services/logger.js';

describe('SilentLive', () => {
  it('log does not call console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.log('hello');
      }).pipe(Effect.provide(SilentLive)),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warn does not call console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.warn('oops');
      }).pipe(Effect.provide(SilentLive)),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ConsoleLive', () => {
  it('log calls console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.log('hello');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('warn calls console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.warn('warning');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('warning');
    spy.mockRestore();
  });

  it('error calls console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await Effect.runPromise(
      Effect.gen(function* () {
        const logger = yield* LoggerService;
        yield* logger.error('err');
      }).pipe(Effect.provide(ConsoleLive)),
    );
    expect(spy).toHaveBeenCalledWith('err');
    spy.mockRestore();
  });
});
