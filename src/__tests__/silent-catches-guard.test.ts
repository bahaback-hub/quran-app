/**
 * Guard: `scripts/check-silent-catches.mjs` must catch catch-blocks that hide a
 * failure behind a "success-looking" fallback value.
 *
 * QUA-02: the guard originally treated `void e;` / `return;` / `return null`
 * as the only silent shapes, so a swallowed error returned as `false`, `''`,
 * `[]` or `{}` slipped through — the caller proceeds as if the operation
 * succeeded. These tests scan a throwaway tree with the guard's own AST rules
 * and prove each falsy shape is now reported, while a real log/no-op catch is
 * still allowed.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const GUARD = join(ROOT, 'scripts', 'check-silent-catches.mjs');

interface RunResult {
  status: number;
  output: string;
}

/** Builds the allowlist from the guarded file's ROOT-relative path. */
function runGuard(source: string, makeAllowlist: (file: string) => unknown): RunResult {
  const dir = mkdtempSync(join(tmpdir(), 'silent-catch-'));
  try {
    const scanDir = join(dir, 'src');
    mkdirSync(scanDir);
    writeFileSync(join(scanDir, 'sample.ts'), source, 'utf8');
    const file = relative(ROOT, join(scanDir, 'sample.ts')).replace(/\\/g, '/');
    const allowlistPath = join(dir, 'allowlist.json');
    writeFileSync(allowlistPath, JSON.stringify(makeAllowlist(file)), 'utf8');

    try {
      const stdout = execFileSync(process.execPath, [GUARD], {
        encoding: 'utf8',
        env: { ...process.env, SILENT_SCAN_DIR: scanDir, SILENT_ALLOWLIST_PATH: allowlistPath },
      });
      return { status: 0, output: stdout };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { status: e.status ?? 1, output: `${e.stdout ?? ''}\n${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FALSY_SOURCE = `
function a(): boolean { try { return x(); } catch { return false; } }
function b(): string { try { return x(); } catch { return ''; } }
function c(): number[] { try { return x(); } catch { return []; } }
function d(): object { try { return x(); } catch { return {}; } }
function e(): void { try { x(); } catch { console.warn('boom'); } }
`;

describe('silent-catches guard (QUA-02)', () => {
  it('flags each degraded falsy fallback as an undocumented silent catch', () => {
    const { status, output } = runGuard(FALSY_SOURCE, () => ({ entries: [] }));
    expect(status).toBe(1);
    expect(output).toContain('catch-return-false');
    expect(output).toContain('catch-return-empty-string');
    expect(output).toContain('catch-return-empty-array');
    expect(output).toContain('catch-return-empty-object');
    // The catch that gives feedback (console.warn) must NOT be reported.
    expect(output).not.toMatch(/in e \(catch-/);
  });

  it('passes once every falsy fallback is documented in the allowlist', () => {
    const { status, output } = runGuard(FALSY_SOURCE, (file) => ({
      entries: [
        { file, fn: 'a', anchor: '#1', kind: 'catch-return-false', reason: 'probe' },
        { file, fn: 'b', anchor: '#1', kind: 'catch-return-empty-string', reason: 'probe' },
        { file, fn: 'c', anchor: '#1', kind: 'catch-return-empty-array', reason: 'probe' },
        { file, fn: 'd', anchor: '#1', kind: 'catch-return-empty-object', reason: 'probe' },
      ],
    }));
    expect(status).toBe(0);
    expect(output).toContain('Passed');
  });

  it('reports a kind mismatch when a documented site changes shape', () => {
    const { status, output } = runGuard(FALSY_SOURCE, (file) => ({
      entries: [{ file, fn: 'a', anchor: '#1', kind: 'catch-empty-block', reason: 'old' }],
    }));
    expect(status).toBe(1);
    expect(output).toContain('Kind mismatch');
  });
});
