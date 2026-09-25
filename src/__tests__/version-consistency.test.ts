/**
 * Guard: the version the app reports must match the version Android ships.
 *
 * `package.json` feeds `__APP_VERSION__` (vite.config.js), which the settings
 * panel renders as "إصدار التطبيق". `android/app/build.gradle` `versionName` is
 * what the installed package actually is. Both files are individually valid, so
 * nothing failed when they drifted to 3.1.20 vs 3.1.26 — the app simply told
 * users the wrong build number.
 *
 * `scripts/check-version-consistency.mjs` is the CI guard. These tests pin the
 * repo to a consistent state AND prove the guard fails on drift, so a guard that
 * silently stopped working cannot ship.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const GUARD = join(ROOT, 'scripts', 'check-version-consistency.mjs');

interface GradleOptions {
  /** null omits the line entirely; undefined keeps the default. */
  versionName?: string | null;
  versionCode?: string | null;
}

function gradleFixture({ versionName = '3.1.26', versionCode = '34' }: GradleOptions = {}): string {
  const lines = ['android {', '    defaultConfig {'];
  if (versionCode !== null) lines.push(`        versionCode ${versionCode}`);
  if (versionName !== null) lines.push(`        versionName "${versionName}"`);
  lines.push('    }', '}');
  return lines.join('\n');
}

function runGuard(pkgVersion: string, gradle: string): { status: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'version-guard-'));
  try {
    mkdirSync(join(dir, 'android', 'app'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'quran-app', version: pkgVersion }));
    writeFileSync(join(dir, 'android', 'app', 'build.gradle'), gradle);
    try {
      const stdout = execFileSync(process.execPath, [GUARD], { cwd: dir, encoding: 'utf8' });
      return { status: 0, output: stdout };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { status: e.status ?? -1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('release version consistency', () => {
  it('ships package.json and build.gradle at the same version', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };
    const gradle = readFileSync(resolve(ROOT, 'android', 'app', 'build.gradle'), 'utf8');
    const versionName = gradle.match(/versionName\s+["']([^"']+)["']/)?.[1];
    expect(versionName, 'build.gradle must declare versionName "x.y.z"').toBeDefined();
    expect(pkg.version, 'in-app label must equal the shipped Android version').toBe(versionName);
  });

  it('guard passes when both files agree', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture());
    expect(output).toContain('3.1.26');
    expect(status).toBe(0);
  });

  it('guard fails when package.json lags behind build.gradle', () => {
    const { status, output } = runGuard('3.1.20', gradleFixture({ versionName: '3.1.26' }));
    expect(status).toBe(1);
    expect(output).toContain('Version drift');
  });

  it('guard fails when build.gradle loses its versionName', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture({ versionName: null }));
    expect(status).toBe(1);
    expect(output).toContain('versionName');
  });

  it('guard fails when build.gradle loses its versionCode', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture({ versionCode: null }));
    expect(status).toBe(1);
    expect(output).toContain('versionCode');
  });

  it('guard fails on a non-positive versionCode', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture({ versionCode: '0' }));
    expect(status).toBe(1);
    expect(output).toContain('versionCode');
  });
});
