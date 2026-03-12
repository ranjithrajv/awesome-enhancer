import { Context, Effect, Layer } from 'effect';

export class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    log: (msg: string) => Effect.Effect<void>;
    warn: (msg: string) => Effect.Effect<void>;
    error: (msg: string) => Effect.Effect<void>;
  }
>() {}

export const ConsoleLive: Layer.Layer<LoggerService> = Layer.succeed(LoggerService, {
  log: (msg) => Effect.sync(() => console.log(msg)),
  warn: (msg) => Effect.sync(() => console.warn(msg)),
  error: (msg) => Effect.sync(() => console.error(msg)),
});

export const SilentLive: Layer.Layer<LoggerService> = Layer.succeed(LoggerService, {
  log: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
});
