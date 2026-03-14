import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  EnhanceOptionsSchema,
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
} from '../../src/core/schemas.js';

describe('ConfigSchema', () => {
  it('parses valid config with defaults', () => {
    const result = ConfigSchema.parse({});
    expect(result.cacheTTL).toBe(86400);
    expect(result.githubToken).toBeUndefined();
  });

  it('accepts githubToken', () => {
    const result = ConfigSchema.parse({ githubToken: 'tok', cacheTTL: 3600 });
    expect(result.githubToken).toBe('tok');
    expect(result.cacheTTL).toBe(3600);
  });

  it('rejects non-number cacheTTL', () => {
    expect(() => ConfigSchema.parse({ cacheTTL: 'bad' })).toThrow();
  });
});

describe('EnhanceOptionsSchema', () => {
  it('applies all defaults on empty input', () => {
    const result = EnhanceOptionsSchema.parse({});
    expect(result.addMetadata).toBe(false);
    expect(result.updateDescriptions).toBe(false);
    expect(result.githubToken).toBeNull();
    expect(result.cacheTTL).toBe(86400);
    expect(result.badgeStyle).toBe('flat-square');
    expect(result.cacheDir).toBe('.awesome-cache');
  });
});

describe('HttpEnhanceLocalSchema', () => {
  it('requires file_path', () => {
    expect(() => HttpEnhanceLocalSchema.parse({})).toThrow();
  });

  it('parses valid input with defaults', () => {
    const result = HttpEnhanceLocalSchema.parse({ file_path: '/some/file.md' });
    expect(result.file_path).toBe('/some/file.md');
    expect(result.add_metadata).toBe(true);
    expect(result.dry_run).toBe(false);
  });
});

describe('HttpEnhanceGithubSchema', () => {
  it('requires github_url to be a valid URL', () => {
    expect(() => HttpEnhanceGithubSchema.parse({ github_url: 'not-a-url' })).toThrow();
  });

  it('parses valid GitHub URL', () => {
    const result = HttpEnhanceGithubSchema.parse({
      github_url: 'https://github.com/user/repo',
    });
    expect(result.output_path).toBe('enhanced-readme.md');
  });
});
