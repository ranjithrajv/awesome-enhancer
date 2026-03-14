import { Context, Effect, Layer, Option } from 'effect';
import { Cache } from '../core/cache.js';

export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    get: <T>(key: string) => Effect.Effect<Option.Option<T>>;
    set: <T>(key: string, data: T) => Effect.Effect<void>;
  }
>() {}

export const FileCacheLive = (cacheDir: string, ttl: number): Layer.Layer<CacheService> =>
  Layer.sync(CacheService, () => {
    const cache = new Cache(cacheDir, ttl);
    return {
      get: <T>(key: string) =>
        Effect.promise(() => cache.get<T>(key)).pipe(Effect.map(Option.fromNullable)),
      set: <T>(key: string, data: T) => Effect.promise(() => cache.set(key, data)),
    };
  });
