import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { Effect, Layer } from 'effect';
import {
  createEngine,
  buildAppLayer,
  EnhanceOptionsSchema,
  SilentLive,
} from '@awesome-enhancer/core';

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function boolEnv(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function log(msg: string) {
  console.log(`[awesome-enhancer] ${msg}`);
}

function section(title: string) {
  // GitLab CI collapsible log sections
  console.log(`\x1b[0Ksection_start:${Math.floor(Date.now() / 1000)}:${title.replace(/\s/g, '_')}\r\x1b[0K${title}`);
}

function sectionEnd(title: string) {
  console.log(`\x1b[0Ksection_end:${Math.floor(Date.now() / 1000)}:${title.replace(/\s/g, '_')}\r\x1b[0K`);
}

async function postMrNote(summary: string) {
  const token = env('GL_TOKEN') || env('GITLAB_TOKEN');
  const projectId = env('CI_PROJECT_ID');
  const mrIid = env('CI_MERGE_REQUEST_IID');

  if (!token || !projectId || !mrIid) return;

  const apiUrl = `${env('CI_API_V4_URL', 'https://gitlab.com/api/v4')}/projects/${projectId}/merge_requests/${mrIid}/notes`;

  await fetch(apiUrl, {
    method: 'POST',
    headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: summary }),
  });
}

async function run(): Promise<void> {
  const file = env('AE_FILE', 'README.md');
  const addMetadata = boolEnv('AE_ADD_METADATA', true);
  const updateDescriptions = boolEnv('AE_UPDATE_DESCRIPTIONS');
  const detectStale = boolEnv('AE_DETECT_STALE');
  const detectRedirects = boolEnv('AE_DETECT_REDIRECTS');
  const output = env('AE_OUTPUT') || file;
  const dryRun = boolEnv('AE_DRY_RUN');
  const commitChanges = boolEnv('AE_COMMIT_CHANGES');
  const commitMessage = env('AE_COMMIT_MESSAGE', 'chore: enhance awesome list');
  const githubToken = env('GITHUB_TOKEN') || null;
  const gitlabToken = env('GL_TOKEN') || env('GITLAB_TOKEN') || null;

  section('Reading input');
  log(`Reading ${file}...`);
  const content = await readFile(file, 'utf-8');
  sectionEnd('Reading input');

  const parsed = EnhanceOptionsSchema.parse({
    addMetadata,
    updateDescriptions,
    detectStale,
    detectRedirects,
    githubToken,
    gitlabToken,
  });

  const engine = createEngine(parsed);
  const layer = Layer.merge(buildAppLayer(parsed), SilentLive);

  section('Enhancing');
  log('Enhancing awesome list...');
  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));
  sectionEnd('Enhancing');

  // Build summary for MR notes
  const lines: string[] = ['## awesome-enhancer results\n'];

  if (result.staleEntries.length > 0) {
    lines.push(`### Stale entries (${result.staleEntries.length})\n`);
    for (const entry of result.staleEntries) {
      console.warn(`WARNING: Stale — ${entry.name} [${entry.reason}] ${entry.url}`);
      lines.push(`- **${entry.name}** — ${entry.reason}`);
    }
  }

  if (result.redirectEntries.length > 0) {
    lines.push(`\n### Redirects (${result.redirectEntries.length})\n`);
    for (const entry of result.redirectEntries) {
      log(`Redirect: ${entry.name} → ${entry.newUrl}`);
      lines.push(`- **${entry.name}** → \`${entry.newUrl}\``);
    }
  }

  if (dryRun) {
    log('Dry run — no files written.');
    return;
  }

  section('Writing output');
  await writeFile(output, result.content, 'utf-8');
  log(`Enhanced output written to ${output}`);
  sectionEnd('Writing output');

  if (commitChanges) {
    section('Committing');
    const glToken = env('GL_TOKEN') || env('GITLAB_TOKEN');
    const serverHost = env('CI_SERVER_HOST', 'gitlab.com');
    const projectPath = env('CI_PROJECT_PATH');
    const branch = env('CI_COMMIT_REF_NAME', 'main');

    execSync('git config user.email "gitlab-ci@users.noreply.gitlab.com"');
    execSync('git config user.name "GitLab CI"');

    if (glToken && projectPath) {
      execSync(
        `git remote set-url origin "https://oauth2:${glToken}@${serverHost}/${projectPath}.git"`,
      );
    }

    execSync(`git add "${output}"`);

    try {
      execSync(`git commit -m "${commitMessage}"`);
      execSync(`git push origin "HEAD:${branch}"`);
      log('Changes committed and pushed.');
      lines.push(`\n_Changes committed to \`${branch}\`._`);
    } catch {
      log('No changes to commit.');
    }
    sectionEnd('Committing');
  }

  // Post summary to MR if running in a merge request pipeline
  if (env('CI_MERGE_REQUEST_IID')) {
    await postMrNote(lines.join('\n'));
  }
}

run().catch((err) => {
  console.error(`[awesome-enhancer] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
