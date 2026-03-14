import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cache } from '../../src/core/cache.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Cache', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns null for missing keys', async () => {
    const cache = new Cache('.test-cache', 3600);
    expect(await cache.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves values', async () => {
    const cache = new Cache('.test-cache', 3600);
    await cache.set('key1', { foo: 'bar' });

    const result = await cache.get<{ foo: string }>('key1');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns null for expired entries', async () => {
    const cache = new Cache('.test-cache', 1); // 1 second TTL

    await cache.set('key1', 'value');

    // Mock Date.now to simulate expiry
    const originalNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 2000);

    expect(await cache.get('key1')).toBeNull();

    vi.restoreAllMocks();
  });

  it('handles different data types', async () => {
    const cache = new Cache('.test-cache', 3600);

    await cache.set('string', 'hello');
    await cache.set('number', 42);
    await cache.set('array', [1, 2, 3]);
    await cache.set('object', { nested: { deep: true } });

    expect(await cache.get('string')).toBe('hello');
    expect(await cache.get('number')).toBe(42);
    expect(await cache.get('array')).toEqual([1, 2, 3]);
    expect(await cache.get('object')).toEqual({ nested: { deep: true } });
  });

  it('overwrites existing entries', async () => {
    const cache = new Cache('.test-cache', 3600);

    await cache.set('key', 'old');
    await cache.set('key', 'new');

    expect(await cache.get('key')).toBe('new');
  });

  it('returns null on corrupted cache file', async () => {
    const cache = new Cache('.test-cache', 3600);
    await cache.set('key', 'value');

    // Corrupt the cache file by writing invalid JSON
    const { join } = await import('path');
    const { writeFile } = await import('fs/promises');
    const filePath = join(process.cwd(), '.test-cache', Buffer.from('key').toString('base64') + '.json');
    await writeFile(filePath, 'invalid json content', 'utf-8');

    expect(await cache.get('key')).toBeNull();
  });
});
