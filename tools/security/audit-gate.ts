/**
 * audit-gate CLI - run the dependency audit at a level worth catching and fail
 * only on advisories that are not allowlisted.
 *
 *   bun tools/security/audit-gate.ts --level high
 *   bun tools/security/audit-gate.ts --level high --summary "$GITHUB_STEP_SUMMARY"
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

import { evaluate, render, type AllowlistEntry } from './audit-gate-lib';

interface AuditJson {
  [pkg: string]: Parameters<typeof evaluate>[0][string];
}

export function runAudit(): AuditJson {
  const result = spawnSync('bun', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const raw = (result.stdout ?? '').trim();
  if (!raw) {
    throw new Error(
      `bun audit produced no output (${result.stderr || result.error || 'unknown error'})`,
    );
  }
  return JSON.parse(raw) as AuditJson;
}

function loadAllowlist(path: string): AllowlistEntry[] {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')).allow ?? []) as AllowlistEntry[];
  } catch (error) {
    console.error(
      `could not read ${path} (${(error as Error).message}); continuing with an empty allowlist`,
    );
    return [];
  }
}

function main(argv: string[]): number {
  const options = { level: 'high', allowlist: '.github/audit-allowlist.json', summary: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--level') options.level = argv[(i += 1)];
    else if (argv[i] === '--allowlist') options.allowlist = argv[(i += 1)];
    else if (argv[i] === '--summary') options.summary = argv[(i += 1)];
    else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }

  const result = evaluate(runAudit(), loadAllowlist(options.allowlist), options.level);
  const report = render(result, options.level);
  console.log(report);

  if (options.summary) {
    try {
      appendFileSync(options.summary, `${report}\n`);
    } catch (error) {
      console.error(`could not write the summary (${(error as Error).message})`);
    }
  }

  if (result.findings.length) {
    console.error(
      `::error::${result.findings.length} advisor${result.findings.length === 1 ? 'y' : 'ies'} at or above ${options.level} are not allowlisted`,
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
