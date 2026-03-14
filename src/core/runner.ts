import { readFile, writeFile } from 'fs/promises';
import { Effect } from 'effect';
import { createEngine } from './engine-factory.js';
import { buildAppLayer } from './app-layer.js';
import {
  EnhanceOptionsSchema,
  type HttpEnhanceLocalArgs,
  type HttpEnhanceGithubArgs,
} from './schemas.js';
import { parseGitHubUrl } from './utils.js';
import { GitHubService } from '../services/github.js';

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
}

export async function runEnhanceLocal(args: HttpEnhanceLocalArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
    detectStale: args.detect_stale ?? false,
  });

  const content = await readFile(args.file_path, 'utf-8');
  const engine = createEngine(options);
  const layer = buildAppLayer(options);

  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

  const outputPath = args.output_path || args.file_path;

  if (args.dry_run) {
    return {
      success: true,
      dry_run: true,
      preview: result.content,
      stale_entries: result.staleEntries,
    };
  }

  await writeFile(outputPath, result.content, 'utf-8');
  return {
    success: true,
    output_file: outputPath,
    enhanced_content: result.content,
    stale_entries: result.staleEntries,
  };
}

export async function runEnhanceGithub(args: HttpEnhanceGithubArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
    detectStale: args.detect_stale ?? false,
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

  if (args.dry_run) {
    return {
      success: true,
      dry_run: true,
      preview: result.content,
      stale_entries: result.staleEntries,
    };
  }

  await writeFile(outputPath, result.content, 'utf-8');
  return {
    success: true,
    output_file: outputPath,
    enhanced_content: result.content,
    stale_entries: result.staleEntries,
  };
}
