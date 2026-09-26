/**
 * Guard: the shipped Mushaf manifest must match the digest the app enforces.
 *
 * `getVerifiedManifest()` compares the fetched manifest against a hardcoded
 * SHA-256 and throws on mismatch, which aborts the whole download on the first
 * file. That constant had drifted from the real file, so "تنزيل المصحف للعمل
 * دون إنترنت" failed instantly for every user — and because the catch block
 * swallowed the error and `refresh()` overwrote the status text, the UI just
 * sprang back to "not installed" with no message at all.
 *
 * The unit tests inject their own digest, so they could never catch this. This
 * test hashes the manifest that actually ships and fails CI the moment anyone
 * edits the manifest without updating EXPECTED_MANIFEST_SHA256.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MANIFEST_PATH = resolve(process.cwd(), 'public/data/mushaf-pack/qcf4-hafs-layout-v1.manifest.json');
const SOURCE_PATH = resolve(process.cwd(), 'src/features/mushaf/mushaf-data-pack.ts');

interface MushafManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

interface MushafManifest {
  fileCount: number;
  totalBytes: number;
  files: MushafManifestFile[];
  source: { rawBaseUrl: string; commit: string };
}

describe('mushaf data pack manifest integrity', () => {
  const raw = readFileSync(MANIFEST_PATH);
  const manifest = JSON.parse(raw.toString('utf8')) as MushafManifest;

  it('matches the digest the app enforces at download time', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');
    const enforced = /const EXPECTED_MANIFEST_SHA256 = '([0-9a-f]{64})';/.exec(source)?.[1];
    expect(enforced, 'EXPECTED_MANIFEST_SHA256 must be declared in mushaf-data-pack.ts').toBeDefined();

    const actual = createHash('sha256').update(raw).digest('hex');
    expect(
      actual,
      'public/data/mushaf-pack manifest changed — update EXPECTED_MANIFEST_SHA256 in ' +
        'src/features/mushaf/mushaf-data-pack.ts or every download will abort on the integrity check',
    ).toBe(enforced);
  });

  it('describes a full 604-page pack whose totals match its file list', () => {
    expect(manifest.files.length).toBe(manifest.fileCount);
    expect(manifest.files.length).toBeGreaterThanOrEqual(604);
    const bytes = manifest.files.reduce((sum, f) => sum + f.bytes, 0);
    expect(bytes).toBe(manifest.totalBytes);
  });

  it('pins every file to an immutable source commit', () => {
    expect(manifest.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.source.rawBaseUrl).toContain(manifest.source.commit);
  });

  it('lists no duplicate file paths', () => {
    const paths = manifest.files.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ships the manifest the app fetches at BASE_URL', () => {
    // The runtime fetches `${BASE_URL}data/mushaf-pack/<name>`; a rename here
    // would 404 and abort the download exactly like a stale digest does.
    const runtime = readFileSync(join(process.cwd(), 'src/features/mushaf/mushaf-data-pack.ts'), 'utf8');
    const fetched = /data\/mushaf-pack\/([\w.-]+\.manifest\.json)/.exec(runtime)?.[1];
    expect(fetched).toBe('qcf4-hafs-layout-v1.manifest.json');
  });
});
