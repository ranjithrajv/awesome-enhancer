import { describe, expect, it } from 'vitest';

import { evaluate, findingId, render } from '../../tools/security/audit-gate.mjs';

const audit = {
  braces: [
    {
      severity: 'high',
      title: 'braces stack exhaustion',
      vulnerable_versions: '<=3.0.3',
      url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
    },
  ],
  undici: [
    {
      severity: 'high',
      title: 'undici websocket DoS',
      vulnerable_versions: '>=7.0.0 <7.29.1',
      url: 'https://github.com/advisories/GHSA-rfgv-xxqx-mfg5',
    },
  ],
  'sprintf-js': [
    {
      severity: 'moderate',
      title: 'sprintf-js ReDoS',
      vulnerable_versions: '<1.1.3',
      url: 'https://github.com/advisories/GHSA-hp3w-g68c-fv3c',
    },
  ],
};

const bracesAllowlist = [
  { id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', reason: 'no fix published' },
];

describe('findingId', () => {
  it('uses the advisory id from the url, falling back to the numeric id', () => {
    expect(findingId(audit.braces[0])).toBe('GHSA-vfj7-8cjw-p6xm');
    expect(findingId({ id: 1234 })).toBe('1234');
  });
});

describe('audit gate', () => {
  it('tolerates an allowlisted advisory and fails on the rest', () => {
    const result = evaluate(audit, bracesAllowlist, 'high');
    expect(result.tolerated.map((f) => f.id)).toEqual(['GHSA-vfj7-8cjw-p6xm']);
    expect(result.findings.map((f) => f.id)).toEqual(['GHSA-rfgv-xxqx-mfg5']);
  });

  it('passes once everything is allowlisted', () => {
    const allowlist = [
      ...bracesAllowlist,
      { id: 'GHSA-rfgv-xxqx-mfg5', package: 'undici', reason: 'websocket only' },
    ];
    expect(evaluate(audit, allowlist, 'high').findings).toEqual([]);
  });

  it('ignores findings below the level', () => {
    const result = evaluate(audit, [], 'critical');
    expect(result.findings).toEqual([]);
    expect(result.tolerated).toEqual([]);
  });

  it('reports allowlist entries that are no longer needed', () => {
    const result = evaluate({}, bracesAllowlist, 'high');
    expect(result.stale.map((entry) => entry.id)).toEqual(['GHSA-vfj7-8cjw-p6xm']);
  });

  it('rejects an unknown level', () => {
    expect(() => evaluate(audit, [], 'nope')).toThrow(/unknown level/);
  });

  it('renders a passing report and a failing one', () => {
    expect(render(evaluate(audit, [], 'high'), 'high')).toContain('need attention');
    const passing = render(evaluate({}, [], 'high'), 'high');
    expect(passing).toContain('No unallowlisted advisories');
  });
});
