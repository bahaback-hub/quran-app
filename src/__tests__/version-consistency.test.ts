/**
 * Guard: the version the app reports must match the version Android ships.
 *
 * `package.json` feeds `__APP_VERSION__` (vite.config.js), which the settings
 * panel renders as "إصدار التطبيق". `android/app/build.gradle` `versionName` is
 * what the installed package actually is. Both files are individually valid, so
 * nothing failed when they drifted to 3.1.20 vs 3.1.26 — the app simply told
 * users the wrong build number.
 *
 * The AI discovery manifests repeat the version too, so an agent reading
 * `/.well-known/ai-catalog.json` learns which build it is looking at, and
 * `ard.json` must stay byte-identical to its predecessor-named twin.
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

interface CatalogOptions {
  /** null omits the entry's version field entirely. */
  version?: string | null;
  /** Replaces the whole manifest body, for parse/divergence failures. */
  raw?: string;
}

function gradleFixture({ versionName = '3.1.26', versionCode = '34' }: GradleOptions = {}): string {
  const lines = ['android {', '    defaultConfig {'];
  if (versionCode !== null) lines.push(`        versionCode ${versionCode}`);
  if (versionName !== null) lines.push(`        versionName "${versionName}"`);
  lines.push('    }', '}');
  return lines.join('\n');
}

function catalogFixture({ version = '3.1.26', raw }: CatalogOptions = {}): string {
  if (raw !== undefined) return raw;
  const entry: Record<string, unknown> = {
    identifier: 'urn:air:example.com:quran-app:web-app',
    displayName: 'Example Quran App',
    type: 'application/manifest+json',
    url: 'https://example.com/manifest.json',
  };
  if (version !== null) entry.version = version;
  return JSON.stringify({ specVersion: '1.0', host: { displayName: 'Example' }, entries: [entry] }, null, 2);
}

function runGuard(
  pkgVersion: string,
  gradle: string,
  { catalog = catalogFixture(), ard = catalog }: { catalog?: string; ard?: string } = {},
): { status: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'version-guard-'));
  try {
    mkdirSync(join(dir, 'android', 'app'), { recursive: true });
    mkdirSync(join(dir, 'public', '.well-known'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'quran-app', version: pkgVersion }));
    writeFileSync(join(dir, 'android', 'app', 'build.gradle'), gradle);
    writeFileSync(join(dir, 'public', '.well-known', 'ai-catalog.json'), catalog);
    writeFileSync(join(dir, 'public', '.well-known', 'ard.json'), ard);
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

  it('keeps the shipped AI discovery manifests in step with package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };
    const catalog = JSON.parse(readFileSync(resolve(ROOT, 'public', '.well-known', 'ai-catalog.json'), 'utf8')) as {
      specVersion: string;
      entries: { identifier: string; version: string }[];
    };

    expect(catalog.specVersion, 'ARD specVersion is pinned to "1.0"').toBe('1.0');
    expect(catalog.entries.length, 'a catalog with no entries advertises nothing').toBeGreaterThan(0);
    for (const entry of catalog.entries) {
      expect(entry.identifier, 'ARD identifiers must be domain-anchored urn:air: URNs').toMatch(
        /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/,
      );
      expect(entry.version, `stale build in ${entry.identifier}`).toBe(pkg.version);
    }

    const ard = readFileSync(resolve(ROOT, 'public', '.well-known', 'ard.json'), 'utf8');
    const aiCatalog = readFileSync(resolve(ROOT, 'public', '.well-known', 'ai-catalog.json'), 'utf8');
    expect(ard.trim(), 'ard.json and ai-catalog.json are both advertised, so they must not diverge').toBe(
      aiCatalog.trim(),
    );
  });

  it('guard passes when every file agrees', () => {
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

  it('guard fails when an AI discovery entry reports a stale version', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture(), {
      catalog: catalogFixture({ version: '3.1.20' }),
    });
    expect(status).toBe(1);
    expect(output).toContain('AI discovery manifest version drift');
  });

  it('guard fails when an AI discovery entry drops its version', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture(), {
      catalog: catalogFixture({ version: null }),
    });
    expect(status).toBe(1);
    expect(output).toContain('AI discovery manifest version drift');
  });

  it('guard fails when an AI discovery identifier is not a urn:air URN', () => {
    const bad = JSON.stringify({
      specVersion: '1.0',
      entries: [{ identifier: 'quran-app', displayName: 'x', type: 'application/json', url: 'https://e.com/a' }],
    });
    const { status, output } = runGuard('3.1.26', gradleFixture(), { catalog: bad, ard: bad });
    expect(status).toBe(1);
    expect(output).toContain('urn:air');
  });

  it('guard fails when ard.json diverges from ai-catalog.json', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture(), {
      ard: catalogFixture({ version: '3.1.20' }),
    });
    expect(status).toBe(1);
    expect(output).toContain('differ');
  });

  it('guard fails when an AI discovery manifest is unparseable', () => {
    const { status, output } = runGuard('3.1.26', gradleFixture(), {
      catalog: '{ not json',
      ard: '{ not json',
    });
    expect(status).toBe(1);
    expect(output).toContain('AI discovery manifests');
  });
});
