import { readFile, writeFile } from 'fs/promises';
import { Effect } from 'effect';
import { createEngine } from './engine-factory.js';
import { buildAppLayer } from './app-layer.js';
import {
  EnhanceOptionsSchema,
  type HttpEnhanceLocalArgs,
  type HttpEnhanceGithubArgs,
  type HttpEnhanceGitLabArgs,
} from './schemas.js';
import { parseGitHubUrl, parseGitLabUrl } from './utils.js';
import { GitHubService } from '../services/github.js';
import { GitLabService } from '../services/gitlab.js';

export interface EnhanceResult {
  success: boolean;
  output_file?: string;
  enhanced_content?: string;
  preview?: string;
  dry_run?: boolean;
  stale_entries?: Array<{
    name: string;
    url: string;
    reason: 'archived' | 'disabled' | 'not-found';
  }>;
  redirect_entries?: Array<{
    name: string;
    url: string;
    newUrl: string;
    reason: 'transferred' | 'renamed';
  }>;
}

function buildEnhanceResult(
  result: {
    content: string;
    staleEntries: EnhanceResult['stale_entries'];
    redirectEntries: EnhanceResult['redirect_entries'];
  },
  outputPath: string,
  dryRun: boolean,
): EnhanceResult {
  const base = {
    success: true,
    stale_entries: result.staleEntries,
    redirect_entries: result.redirectEntries,
  };

  if (dryRun) {
    return { ...base, dry_run: true, preview: result.content };
  }

  return { ...base, output_file: outputPath, enhanced_content: result.content };
}

export async function runEnhanceLocal(args: HttpEnhanceLocalArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
    detectStale: args.detect_stale ?? false,
    detectRedirects: args.detect_redirects ?? false,
  });

  const content = await readFile(args.file_path, 'utf-8');
  const engine = createEngine(options);
  const layer = buildAppLayer(options);

  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

  const outputPath = args.output_path || args.file_path;

  return buildEnhanceResult(result, outputPath, args.dry_run ?? false);
}

export async function runEnhanceGithub(args: HttpEnhanceGithubArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
    detectStale: args.detect_stale ?? false,
    detectRedirects: args.detect_redirects ?? false,
  });

  const outputPath = args.output_path || 'enhanced-readme.md';
  const githubInfo = parseGitHubUrl(args.github_url);
  if (!githubInfo) throw new Error('Invalid GitHub URL');

  const layer = buildAppLayer(options);

  const content = await Effect.runPromise(
    Effect.flatMap(GitHubService, (s) => s.fetchRepoReadme(githubInfo.owner, githubInfo.repo)).pipe(
      Effect.provide(layer),
    ),
  );

  const engine = createEngine(options);
  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

  return buildEnhanceResult(result, outputPath, args.dry_run ?? false);
}

export async function runEnhanceGitLab(args: HttpEnhanceGitLabArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
    detectStale: args.detect_stale ?? false,
    detectRedirects: args.detect_redirects ?? false,
  });

  const outputPath = args.output_path || 'enhanced-readme.md';
  const gitlabInfo = parseGitLabUrl(args.gitlab_url);
  if (!gitlabInfo) throw new Error('Invalid GitLab URL');

  const layer = buildAppLayer(options);

  const content = await Effect.runPromise(
    Effect.flatMap(GitLabService, (s) => s.fetchRepoReadme(gitlabInfo.owner, gitlabInfo.repo)).pipe(
      Effect.provide(layer),
    ),
  );

  const engine = createEngine(options);
  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

  if (args.dry_run) {
    return buildEnhanceResult(result, outputPath, true);
  }

  await writeFile(outputPath, result.content, 'utf-8');
  return buildEnhanceResult(result, outputPath, false);
}
