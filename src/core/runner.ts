import { readFile, writeFile } from 'fs/promises';
import { Effect } from 'effect';
import { createEngine } from './engine-factory.js';
import { buildAppLayer } from './app-layer.js';
import { EnhanceOptionsSchema, type HttpEnhanceLocalArgs, type HttpEnhanceGithubArgs } from './schemas.js';
import { parseGitHubUrl } from './utils.js';
import { GitHubService } from '../services/github.js';

export interface EnhanceResult {
  success: boolean;
  output_file?: string;
  enhanced_content?: string;
  dry_run?: boolean;
  preview?: string;
}

export async function runEnhanceLocal(args: HttpEnhanceLocalArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
  });

  const content = await readFile(args.file_path, 'utf-8');
  const engine = createEngine(options);
  const layer = buildAppLayer(options);

  const enhanced = await Effect.runPromise(
    engine.process(content).pipe(Effect.provide(layer)),
  );

  const outputPath = args.output_path || args.file_path;

  if (args.dry_run) {
    return { success: true, dry_run: true, preview: enhanced };
  }

  await writeFile(outputPath, enhanced, 'utf-8');
  return { success: true, output_file: outputPath, enhanced_content: enhanced };
}

export async function runEnhanceGithub(args: HttpEnhanceGithubArgs): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: args.add_metadata,
    updateDescriptions: args.update_descriptions,
  });

  const outputPath = args.output_path || 'enhanced-readme.md';
  const githubInfo = parseGitHubUrl(args.github_url);
  if (!githubInfo) throw new Error('Invalid GitHub URL');

  const layer = buildAppLayer(options);

  const content = await Effect.runPromise(
    Effect.flatMap(GitHubService, (s) =>
      s.fetchRepoReadme(githubInfo.owner, githubInfo.repo),
    ).pipe(Effect.provide(layer)),
  );

  const engine = createEngine(options);
  const enhanced = await Effect.runPromise(
    engine.process(content).pipe(Effect.provide(layer)),
  );

  if (args.dry_run) {
    return { success: true, dry_run: true, preview: enhanced };
  }

  await writeFile(outputPath, enhanced, 'utf-8');
  return { success: true, output_file: outputPath, enhanced_content: enhanced };
}
