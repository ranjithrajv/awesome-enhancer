import { z } from 'zod';
import { DEFAULT_CACHE_TTL, DEFAULT_CACHE_DIR, DEFAULT_BADGE_STYLE } from './constants.js';

export const ConfigSchema = z.object({
  githubToken: z.string().optional(),
  gitlabToken: z.string().optional(),
  cacheTTL: z.number().default(DEFAULT_CACHE_TTL),
});

export const EnhanceOptionsSchema = z.object({
  addMetadata: z.boolean().default(false),
  updateDescriptions: z.boolean().default(false),
  detectStale: z.boolean().default(false),
  githubToken: z.string().nullable().default(null),
  gitlabToken: z.string().nullable().default(null),
  cacheTTL: z.number().default(DEFAULT_CACHE_TTL),
  badgeStyle: z.string().default(DEFAULT_BADGE_STYLE),
  cacheDir: z.string().default(DEFAULT_CACHE_DIR),
});

export const HttpEnhanceLocalSchema = z.object({
  file_path: z.string(),
  add_metadata: z.boolean().default(true),
  update_descriptions: z.boolean().default(false),
  detect_stale: z.boolean().default(false),
  output_path: z.string().optional(),
  dry_run: z.boolean().default(false),
});

export const HttpEnhanceGithubSchema = z.object({
  github_url: z.string().url(),
  add_metadata: z.boolean().default(true),
  update_descriptions: z.boolean().default(false),
  detect_stale: z.boolean().default(false),
  output_path: z.string().default('enhanced-readme.md'),
  dry_run: z.boolean().default(false),
});

export const HttpEnhanceGitLabSchema = z.object({
  gitlab_url: z.string().url(),
  add_metadata: z.boolean().default(true),
  update_descriptions: z.boolean().default(false),
  detect_stale: z.boolean().default(false),
  output_path: z.string().default('enhanced-readme.md'),
  dry_run: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;
export type EnhanceOptions = z.infer<typeof EnhanceOptionsSchema>;
export type HttpEnhanceLocalArgs = z.infer<typeof HttpEnhanceLocalSchema>;
export type HttpEnhanceGithubArgs = z.infer<typeof HttpEnhanceGithubSchema>;
export type HttpEnhanceGitLabArgs = z.infer<typeof HttpEnhanceGitLabSchema>;
