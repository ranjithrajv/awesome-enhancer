#!/usr/bin/env bun
/**
 * audit-gate - fail on new advisories, tolerate a documented allowlist.
 *
 * `bun audit` alone is all-or-nothing: two unfixable advisories in the tree
 * would force the threshold down to `critical`, where it stops catching
 * anything useful. This runs the audit at a level worth catching (`high` by
 * default) and fails only on findings that are not explicitly allowlisted in
 * .github/audit-allowlist.json, so every tolerated advisory carries a reason.
 *
 *   bun tools/security/audit-gate.mjs --level high
 *   bun tools/security/audit-gate.mjs --level high --summary "$GITHUB_STEP_SUMMARY"
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

export const SEVERITIES = ['low', 'moderate', 'high', 'critical'];

export function findingId(advisory) {
  if (advisory?.url) {
    const parts = advisory.url.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }
  return String(advisory?.id ?? 'unknown');
}

/**
 * Split audit findings into those that must fail the build and those covered
 * by the allowlist. Anything below `level` is ignored entirely.
 */
export function evaluate(audit = {}, allowlist = [], level = 'high') {
  const threshold = SEVERITIES.indexOf(level);
  if (threshold < 0) throw new Error(`unknown level "${level}"`);

  const allowed = new Set(allowlist.map((entry) => entry.id));
  const findings = [];
  const tolerated = [];
  const reported = new Set();

  for (const [pkg, advisories] of Object.entries(audit)) {
    for (const advisory of advisories ?? []) {
      if (SEVERITIES.indexOf(advisory.severity) < threshold) continue;
      const id = findingId(advisory);
      reported.add(id);
      const item = {
        package: pkg,
        id,
        severity: advisory.severity,
        title: advisory.title ?? '',
        versions: advisory.vulnerable_versions ?? '',
      };
      (allowed.has(id) ? tolerated : findings).push(item);
    }
  }

  const stale = allowlist.filter((entry) => !reported.has(entry.id));
  return { findings, tolerated, stale };
}

export function render(result, level) {
  const { findings, tolerated, stale } = result;
  const lines = [`# Dependency audit (level: ${level})`, ''];

  if (findings.length) {
    lines.push(
      `## ${findings.length} advisor${findings.length === 1 ? 'y' : 'ies'} need attention`,
      '',
    );
    lines.push(
      '| Package | Severity | Advisory | Vulnerable versions |',
      '| --- | --- | --- | --- |',
    );
    for (const f of findings)
      lines.push(`| ${f.package} | ${f.severity} | ${f.id} | \`${f.versions}\` |`);
    lines.push('');
  } else {
    lines.push('No unallowlisted advisories at or above the threshold. ok', '');
  }

  if (tolerated.length) {
    lines.push(`<details><summary>${tolerated.length} allowlisted</summary>`, '');
    lines.push('| Package | Severity | Advisory |', '| --- | --- | --- |');
    for (const t of tolerated) lines.push(`| ${t.package} | ${t.severity} | ${t.id} |`);
    lines.push('', '</details>', '');
  }

  if (stale.length) {
    lines.push(
      `> ${stale.length} allowlist entr${stale.length === 1 ? 'y is' : 'ies are'} no longer reported - ` +
        `remove ${stale.length === 1 ? 'it' : 'them'} from .github/audit-allowlist.json.`,
      '',
    );
  }
  return lines.join('\n');
}

function runAudit() {
  const result = spawnSync('bun', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const raw = (result.stdout ?? '').trim();
  if (!raw)
    throw new Error(
      `bun audit produced no output (${result.stderr || result.error || 'unknown error'})`,
    );
  return JSON.parse(raw);
}

function main(argv) {
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

  let allowlist = [];
  try {
    allowlist = JSON.parse(readFileSync(options.allowlist, 'utf8')).allow ?? [];
  } catch (error) {
    console.error(
      `could not read ${options.allowlist} (${error.message}); continuing with an empty allowlist`,
    );
  }

  const result = evaluate(runAudit(), allowlist, options.level);
  const report = render(result, options.level);
  console.log(report);
  if (options.summary) {
    try {
      appendFileSync(options.summary, `${report}\n`);
    } catch (error) {
      console.error(`could not write the summary (${error.message})`);
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
