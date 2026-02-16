#!/usr/bin/env node

import { Command } from 'commander';
import { enhanceCommand } from '../src/commands/enhance.js';

/**
 * awesome-enhance CLI Entry Point
 */
const program = new Command();

program
  .name('awesome-enhance')
  .description('CLI tool to enhance awesome lists with metadata and descriptions')
  .version('0.1.0');

program
  .command('enhance')
  .description('Enhance an awesome list')
  .argument('[file-or-url]', 'Path to local markdown file or GitHub repository URL')
  .option('--add-metadata', 'Add GitHub repository metadata (stars, forks, language)')
  .option('--update-descriptions', 'Improve descriptions via web scraping')
  .option('--output <file>', 'Output file (default: overwrites input)')
  .option('--dry-run', 'Preview changes without writing to file')
  .option('--github-token <token>', 'GitHub API token for higher rate limits')
  .option('--skip-lint', 'Skip running awesome-lint')
  .action((fileOrUrl, options) => {
    // Pass to enhanceCommand which will handle the logic
    enhanceCommand(fileOrUrl, options);
  });

program.parse();
