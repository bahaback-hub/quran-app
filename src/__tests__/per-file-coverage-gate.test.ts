/**
 * Guard: the per-file coverage gate must actually gate.
 *
 * The gate previously skipped *any* file reporting zero executable statements.
 * That reads as harmless — a file with no statements has nothing to cover — but
 * it silently exempts a brand-new module whose logic happens to sit behind
 * re-exports, which is the exact hole a per-file gate exists to close. The skip
 * is now two explicit lists, and an unlisted 0-statement file has to fail.
 *
 * This also moves the logic out of an inline `node -e` in ci.yml, so it can be
 * exercised here instead of only being trusted.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = resolve(process.cwd(), 'scripts/check-per-file-coverage.mjs');

function file(linesPct: number, statementsTotal = 10) {
  return {
    lines: { pct: linesPct, total: 100, covered: Math.round(linesPct) },
    statements: { pct: linesPct, total: statementsTotal, covered: statementsTotal },
    branches: { pct: 80, total: 4, covered: 3 },
    functions: { pct: 90, total: 5, covered: 4 },
  };
}

function runGate(entries: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'covgate-'));
  const summary: Record<string, unknown> = { total: file(86) };
  for (const [k, v] of Object.entries(entries)) {
    summary[`/repo/${k}`] = v;
  }
  const path = join(dir, 'coverage-summary.json');
  writeFileSync(path, JSON.stringify(summary));
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, COVERAGE_SUMMARY: path },
    });
    return { status: 0, output: stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('per-file coverage gate', () => {
  it('passes when every file clears the threshold', () => {
    const { status, output } = runGate({
      'src/app.ts': file(92),
      'src/dom.ts': file(88),
      // the one file on the data-only allowlist
      'src/surahs-data.ts': file(0, 0),
      // barrel shims stay excluded whatever their numbers look like
      'src/state.ts': file(100),
      'src/templates-panels.ts': file(0, 0),
    });
    expect(output).toContain('Passed');
    expect(status).toBe(0);
  });

  it('fails a file that is under the threshold', () => {
    const { status, output } = runGate({ 'src/undertested.ts': file(42) });
    expect(output).toContain('below 65% line coverage');
    expect(output).toContain('src/undertested.ts');
    expect(status).toBe(1);
  });

  it('fails a NEW 0-statement module that is not on the allowlist', () => {
    // The regression this guards: a blanket 0-statements skip would pass this.
    const { status, output } = runGate({
      'src/surahs-data.ts': file(0, 0),
      'src/sneaky.ts': file(0, 0),
    });
    expect(output).toContain('no executable statements');
    expect(output).toContain('src/sneaky.ts');
    expect(output).toContain('DATA_ONLY_FILES');
    expect(status).toBe(1);
  });

  it('ignores test files and the total row', () => {
    const { status } = runGate({
      'src/app.ts': file(95),
      'src/__tests__/whatever.test.ts': file(0, 0),
    });
    expect(status).toBe(0);
  });

  it('honours a custom threshold', () => {
    const dir = mkdtempSync(join(tmpdir(), 'covgate-threshold-'));
    const path = join(dir, 'coverage-summary.json');
    writeFileSync(path, JSON.stringify({ '/repo/src/app.ts': file(80), total: file(86) }));
    const run = (threshold: string) => {
      try {
        execFileSync(process.execPath, [SCRIPT], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, COVERAGE_SUMMARY: path, COVERAGE_PER_FILE_THRESHOLD: threshold },
        });
        return 0;
      } catch (err) {
        return (err as { status?: number }).status ?? -1;
      }
    };
    expect(run('80')).toBe(0);
    expect(run('90')).toBe(1);
  });
});
