import { describe, it, expect } from 'vitest';
import { NetworkError, ConfigError, EnhanceError, ValidationError } from '../../src/core/errors.js';

describe('NetworkError', () => {
  it('has correct _tag', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'failed' });
    expect(e._tag).toBe('NetworkError');
  });

  it('is an instance of Error', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'failed' });
    expect(e).toBeInstanceOf(Error);
  });

  it('includes statusCode when provided', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'not found', statusCode: 404 });
    expect(e.statusCode).toBe(404);
  });

  it('exposes url and message', () => {
    const e = new NetworkError({ url: 'https://example.com', message: 'oops' });
    expect(e.url).toBe('https://example.com');
    expect(e.message).toBe('oops');
  });
});

describe('ConfigError', () => {
  it('has correct _tag', () => {
    const e = new ConfigError({ message: 'bad config' });
    expect(e._tag).toBe('ConfigError');
  });

  it('is an instance of Error', () => {
    expect(new ConfigError({ message: 'x' })).toBeInstanceOf(Error);
  });
});

describe('EnhanceError', () => {
  it('has correct _tag', () => {
    expect(new EnhanceError({ message: 'x' })._tag).toBe('EnhanceError');
  });
});

describe('ValidationError', () => {
  it('has correct _tag', () => {
    expect(new ValidationError({ message: 'x' })._tag).toBe('ValidationError');
  });
});
