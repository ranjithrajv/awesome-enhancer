import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { readFile, writeFile } from 'fs/promises';
import { Effect, Layer } from 'effect';
import {
  createEngine,
  buildAppLayer,
  EnhanceOptionsSchema,
  SilentLive,
} from '@awesome-enhancer/core';

async function run(): Promise<void> {
  try {
    const file = core.getInput('file') || 'README.md';
    const addMetadata = core.getBooleanInput('add-metadata');
    const updateDescriptions = core.getBooleanInput('update-descriptions');
    const detectStale = core.getBooleanInput('detect-stale');
    const detectRedirects = core.getBooleanInput('detect-redirects');
    const output = core.getInput('output') || file;
    const dryRun = core.getBooleanInput('dry-run');
    const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || null;
    const commitChanges = core.getBooleanInput('commit-changes');
    const commitMessage = core.getInput('commit-message') || 'chore: enhance awesome list';

    core.info(`Reading ${file}...`);
    const content = await readFile(file, 'utf-8');

    const parsed = EnhanceOptionsSchema.parse({
      addMetadata,
      updateDescriptions,
      detectStale,
      detectRedirects,
      githubToken,
    });

    const engine = createEngine(parsed);
    const layer = Layer.merge(buildAppLayer(parsed), SilentLive);

    core.info('Enhancing awesome list...');
    const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

    if (result.staleEntries.length > 0) {
      core.warning(`Found ${result.staleEntries.length} stale entries`);
      for (const entry of result.staleEntries) {
        core.warning(`  • ${entry.name} [${entry.reason}] ${entry.url}`);
      }
    }

    if (result.redirectEntries.length > 0) {
      core.notice(`Found ${result.redirectEntries.length} redirects`);
      for (const entry of result.redirectEntries) {
        core.notice(`  • ${entry.name} → ${entry.newUrl}`);
      }
    }

    if (dryRun) {
      core.info('Dry run — no files written.');
      await core.summary
        .addHeading('awesome-enhancer preview')
        .addCodeBlock(result.content, 'markdown')
        .write();
      return;
    }

    await writeFile(output, result.content, 'utf-8');
    core.setOutput('output-file', output);
    core.info(`Enhanced output written to ${output}`);

    if (commitChanges) {
      await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
      await exec.exec('git', [
        'config',
        'user.email',
        'github-actions[bot]@users.noreply.github.com',
      ]);
      await exec.exec('git', ['add', output]);

      let hasChanges = false;
      await exec
        .exec('git', ['diff', '--staged', '--quiet'], {
          ignoreReturnCode: true,
          listeners: { errline: () => {} },
        })
        .then((code) => {
          hasChanges = code !== 0;
        });

      if (hasChanges) {
        await exec.exec('git', ['commit', '-m', commitMessage]);
        await exec.exec('git', ['push']);
        core.info('Changes committed and pushed.');
      } else {
        core.info('No changes to commit.');
      }
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
