import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import awesomeLint from 'awesome-lint';
import { loadConfig } from '../core/config.js';
import { ProcessorEngine } from '../lib/processor-engine.js';
import { GitHubService } from '../services/github.js';
import { ScraperService } from '../services/scraper.js';
import { BadgeGenerator } from '../lib/badge-generator.js';
import { MetadataProcessor } from '../lib/metadata-processor.js';
import { DescriptionProcessor } from '../lib/description-processor.js';
import { isValidUrl, parseGitHubUrl } from '../core/utils.js';
import { GitService } from '../services/git.js';

export interface EnhanceOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  output?: string;
  dryRun?: boolean;
  githubToken?: string;
  skipLint?: boolean;
}

/**
 * Handle the 'enhance' command
 */
export async function enhanceCommand(fileOrUrl: string | undefined, options: EnhanceOptions) {
  try {
    console.log('🚀 Starting awesome-enhance...\n');

    // Auto-detection logic for DX
    if (!fileOrUrl) {
      if (GitService.isGitRepo()) {
        const localReadme = GitService.findLocalReadme();
        if (localReadme) {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await rl.question(
            `🧐 I see you're in a Git repository. Would you like to enhance ${localReadme}? (y/n) `,
          );
          rl.close();

          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '') {
            fileOrUrl = localReadme;
          } else {
            console.log('❌ Error: No file or URL provided.');
            process.exit(1);
          }
        } else {
          console.error('❌ Error: No file or URL provided and no local README found.');
          process.exit(1);
        }
      } else {
        console.error('❌ Error: Please provide a file path or GitHub URL.');
        process.exit(1);
      }
    }

    // Load configuration
    const config = await loadConfig();
    const githubToken = options.githubToken || config.githubToken;
    const cacheTTL = config.cacheTTL;

    // Validate options
    if (!options.addMetadata && !options.updateDescriptions) {
      console.error('❌ Error: Please specify at least one enhancement option:');
      console.error('  --add-metadata or --update-descriptions');
      process.exit(1);
    }

    let content: string | null = null;
    let isUrl = isValidUrl(fileOrUrl);

    if (isUrl) {
      const githubInfo = parseGitHubUrl(fileOrUrl);
      if (!githubInfo) {
        console.error('❌ Error: Currently only GitHub repository URLs are supported as input.');
        process.exit(1);
      }

      console.log(`🌐 Fetching README from ${fileOrUrl}...`);
      const githubService = new GitHubService(githubToken, cacheTTL);
      content = await githubService.fetchRepoReadme(githubInfo.owner, githubInfo.repo);

      if (!content) {
        console.error(`❌ Error: Failed to fetch README from ${fileOrUrl}.`);
        process.exit(1);
      }
    } else {
      // Read local file
      console.log(`📖 Reading ${fileOrUrl}...`);
      content = await readFile(fileOrUrl, 'utf-8');
    }

    // Run awesome-lint before enhancements
    if (!options.skipLint) {
      console.log('\n🔍 Running initial awesome-lint check...');
      try {
        await (awesomeLint as any).report({ filename: fileOrUrl });
      } catch {
        // Ignore
      }
    }

    // Initialize Engine and Services
    const engine = new ProcessorEngine();

    if (options.addMetadata) {
      const githubService = new GitHubService(githubToken, cacheTTL);
      const badgeGenerator = new BadgeGenerator();
      engine.register(new MetadataProcessor(githubService, badgeGenerator));
    }

    if (options.updateDescriptions) {
      const scraperService = new ScraperService(cacheTTL);
      engine.register(new DescriptionProcessor(scraperService));
    }

    // Process Content
    console.log('\n✨ Enhancing awesome list...\n');
    const enhanced = await engine.process(content);

    // Save Results
    const defaultOutputFile = isUrl ? 'enhanced-readme.md' : fileOrUrl;
    const outputFile = options.output || defaultOutputFile;

    if (options.dryRun) {
      console.log('\n📋 Preview (dry-run mode):\n');
      console.log('─'.repeat(80));
      console.log(enhanced);
      console.log('─'.repeat(80));
      console.log('\n✅ Dry-run complete. No files were modified.');
    } else {
      await writeFile(outputFile, enhanced, 'utf-8');
      console.log(`\n✅ Successfully enhanced! Output written to: ${outputFile}`);
    }

    // Run awesome-lint final report
    if (!options.skipLint && !options.dryRun) {
      console.log('\n🔍 Running awesome-lint to check for further improvements...');
      try {
        await (awesomeLint as any).report({ filename: outputFile });
        console.log('\n✅ Thank you for maintaining an awesome list! Keep up the great work.');
      } catch {
        console.warn(
          '\n⚠️  Note: awesome-lint found some issues. Fixing them will make your list even better!',
        );
      }
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
