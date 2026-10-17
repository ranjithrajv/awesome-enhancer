/**
 * audit-gate logic - pure functions, so they can be unit tested.
 *
 * `bun audit` alone is all-or-nothing: one unfixable advisory in the tree
 * would force the threshold down to `critical`, where the gate stops catching
 * anything useful. The gate raises it to `high` and fails only on findings
 * that are not explicitly allowlisted in .github/audit-allowlist.json, so
 * every tolerated advisory carries a reason.
 */
export const SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface Advisory {
  id?: number | string;
  url?: string;
  severity?: string;
  title?: string;
  vulnerable_versions?: string;
}

export interface AllowlistEntry {
  id: string;
  package?: string;
  reason?: string;
}

export interface Finding {
  package: string;
  id: string;
  severity: string;
  title: string;
  versions: string;
}

export interface GateResult {
  findings: Finding[];
  tolerated: Finding[];
  stale: AllowlistEntry[];
}

export function findingId(advisory: Advisory): string {
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
export function evaluate(
  audit: Record<string, Advisory[]> = {},
  allowlist: AllowlistEntry[] = [],
  level: string = 'high',
): GateResult {
  const threshold = SEVERITIES.indexOf(level as Severity);
  if (threshold < 0) throw new Error(`unknown level "${level}"`);

  const allowed = new Set(allowlist.map((entry) => entry.id));
  const findings: Finding[] = [];
  const tolerated: Finding[] = [];
  const reported = new Set<string>();

  for (const [pkg, advisories] of Object.entries(audit)) {
    for (const advisory of advisories ?? []) {
      const severity = advisory.severity ?? 'unknown';
      if (SEVERITIES.indexOf(severity as Severity) < threshold) continue;
      const id = findingId(advisory);
      reported.add(id);
      const item: Finding = {
        package: pkg,
        id,
        severity,
        title: advisory.title ?? '',
        versions: advisory.vulnerable_versions ?? '',
      };
      (allowed.has(id) ? tolerated : findings).push(item);
    }
  }

  const stale = allowlist.filter((entry) => !reported.has(entry.id));
  return { findings, tolerated, stale };
}

export function render(result: GateResult, level: string): string {
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
