import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import awesomeLint from 'awesome-lint';
import { Effect, Layer } from 'effect';
import {
  loadConfig,
  createEngine,
  buildAppLayer,
  EnhanceOptionsSchema,
  ConsoleLive,
  isValidUrl,
  parseGitHubUrl,
  parseGitLabUrl,
  GitHubService,
  GitLabService,
} from '@awesome-enhancer/core';
import { GitService } from '../services/git.js';
import type { StaleEntry, RedirectEntry, AppError } from '@awesome-enhancer/core';

function printEnhancementResults(result: {
  staleEntries: StaleEntry[];
  redirectEntries: RedirectEntry[];
}): void {
  if (result.staleEntries.length > 0) {
    console.log('\n⚠️  Stale entries detected:');
    for (const entry of result.staleEntries) {
      console.log(`   • ${entry.name}  [${entry.reason}]   ${entry.url}`);
    }
  }

  if (result.redirectEntries.length > 0) {
    console.log('\n🔀 Redirects detected:');
    for (const entry of result.redirectEntries) {
      console.log(`   • ${entry.name}  → ${entry.newUrl}  [${entry.reason}]`);
    }
  }
}

export interface EnhanceCommandOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  detectStale?: boolean;
  detectRedirects?: boolean;
  output?: string;
  dryRun?: boolean;
  githubToken?: string;
  gitlabToken?: string;
  skipLint?: boolean;
}

export async function enhanceCommand(
  fileOrUrl: string | undefined,
  options: EnhanceCommandOptions,
) {
  const program = Effect.gen(function* () {
    console.log('🚀 Starting awesome-enhancer...\n');

    let resolvedFileOrUrl = fileOrUrl;

    if (!resolvedFileOrUrl) {
      if (GitService.isGitRepo()) {
        const localReadme = GitService.findLocalReadme();
        if (localReadme) {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = yield* Effect.promise(() =>
            rl.question(
              `🧐 I see you're in a Git repository. Would you like to enhance ${localReadme}? (y/n) `,
            ),
          );
          rl.close();
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '') {
            resolvedFileOrUrl = localReadme;
          } else {
            throw new Error('No file or URL provided.');
          }
        } else {
          throw new Error('No file or URL provided and no local README found.');
        }
      } else {
        throw new Error('Please provide a file path or GitHub URL.');
      }
    }

    if (
      !options.addMetadata &&
      !options.updateDescriptions &&
      !options.detectStale &&
      !options.detectRedirects
    ) {
      throw new Error(
        'Please specify at least one enhancement option: --add-metadata, --update-descriptions, --detect-stale, or --detect-redirects',
      );
    }

    const config = yield* Effect.promise(() => loadConfig());
    const githubToken = options.githubToken || config.githubToken || null;
    const gitlabToken = options.gitlabToken || config.gitlabToken || null;
    const cacheTTL = config.cacheTTL;

    const isUrl = isValidUrl(resolvedFileOrUrl!);
    let content: string;

    if (isUrl) {
      const githubInfo = parseGitHubUrl(resolvedFileOrUrl!);
      const gitlabInfo = parseGitLabUrl(resolvedFileOrUrl!);

      if (githubInfo) {
        console.log(`🌐 Fetching README from ${resolvedFileOrUrl}...`);
        const github = yield* GitHubService;
        content = yield* github.fetchRepoReadme(githubInfo.owner, githubInfo.repo);
      } else if (gitlabInfo) {
        console.log(`🌐 Fetching README from ${resolvedFileOrUrl}...`);
        const gitlab = yield* GitLabService;
        content = yield* gitlab.fetchRepoReadme(gitlabInfo.owner, gitlabInfo.repo);
      } else {
        throw new Error('Currently only GitHub and GitLab repository URLs are supported.');
      }
    } else {
      console.log(`📖 Reading ${resolvedFileOrUrl}...`);
      content = yield* Effect.promise(() => readFile(resolvedFileOrUrl!, 'utf-8'));
    }

    if (!options.skipLint) {
      console.log('\n🔍 Running initial awesome-lint check...');
      try {
        yield* Effect.promise(() => (awesomeLint as any).report({ filename: resolvedFileOrUrl }));
      } catch {
        // ignore
      }
    }

    const parsed = EnhanceOptionsSchema.parse({
      addMetadata: options.addMetadata,
      updateDescriptions: options.updateDescriptions,
      detectStale: options.detectStale ?? false,
      detectRedirects: options.detectRedirects ?? false,
      githubToken,
      gitlabToken,
      cacheTTL,
    });

    console.log('\n✨ Enhancing awesome list...\n');
    const engine = createEngine(parsed);
    const result = yield* engine.process(content);
    const enhanced = result.content;

    const defaultOutputFile = isUrl ? 'enhanced-readme.md' : resolvedFileOrUrl!;
    const outputFile = options.output || defaultOutputFile;

    if (options.dryRun) {
      console.log('\n📋 Preview (dry-run mode):\n');
      console.log('─'.repeat(80));
      console.log(enhanced);
      console.log('─'.repeat(80));

      // Print results
      printEnhancementResults(result);

      console.log('\n✅ Dry-run complete. No files were modified.');
    } else {
      yield* Effect.promise(() => writeFile(outputFile, enhanced, 'utf-8'));
      console.log(`\n✅ Successfully enhanced! Output written to: ${outputFile}`);

      // Print results
      printEnhancementResults(result);
    }

    if (!options.skipLint && !options.dryRun) {
      console.log('\n🔍 Running awesome-lint to check for further improvements...');
      try {
        yield* Effect.promise(() => (awesomeLint as any).report({ filename: outputFile }));
        console.log('\n✅ Thank you for maintaining an awesome list!');
      } catch {
        console.warn('\n⚠️ Note: awesome-lint found some issues.');
      }
    }
  });

  const config = await loadConfig();
  const appLayer = buildAppLayer(
    EnhanceOptionsSchema.parse({
      addMetadata: options.addMetadata,
      updateDescriptions: options.updateDescriptions,
      detectStale: options.detectStale ?? false,
      detectRedirects: options.detectRedirects ?? false,
      githubToken: options.githubToken || config.githubToken || null,
      gitlabToken: options.gitlabToken || config.gitlabToken || null,
      cacheTTL: config.cacheTTL,
    }),
  );

  const cliLayer = Layer.merge(appLayer, ConsoleLive);

  await Effect.runPromise(program.pipe(Effect.provide(cliLayer))).catch(
    (error: AppError | Error) => {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      if (process.env.DEBUG) console.error((error as Error).stack);
      process.exit(1);
    },
  );
}
