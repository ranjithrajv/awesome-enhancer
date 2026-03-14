import { Data } from 'effect';

export class NetworkError extends Data.TaggedError('NetworkError')<{
  url: string;
  statusCode?: number;
  message: string;
}> {}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  message: string;
}> {}

export class EnhanceError extends Data.TaggedError('EnhanceError')<{
  message: string;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  message: string;
}> {}

export type AppError = NetworkError | ConfigError | EnhanceError | ValidationError;
