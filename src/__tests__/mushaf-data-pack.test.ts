import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  deleteMushafDataPack,
  downloadMushafDataPack,
  getMushafDataPackStatus,
  getMushafPageLayout,
  verifyMushafDataPack,
} from '../mushaf-data-pack.js';

const SOURCE_COMMIT = 'test-fixed-commit';
const PACK_ID = 'qcf4-hafs-layout-v1';
const JSON_CONTENT = '{"lines":[]}';
const JSON_DIGEST = createHash('sha256').update(JSON_CONTENT).digest('hex');
const FONT_CONTENT = new Uint8Array(10_240);

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function makeManifest() {
  const files = [
    ...Array.from({ length: 604 }, (_, index) => ({
      path: `pages/${String(index + 1).padStart(3, '0')}.json`,
      bytes: JSON_CONTENT.length,
      sha256: JSON_DIGEST,
    })),
    ...['index.json', 'verses.json', 'font-map.json', 'qbsml.json'].map((path) => ({
      path,
      bytes: JSON_CONTENT.length,
      sha256: JSON_DIGEST,
    })),
  ];
  return JSON.stringify({
    schemaVersion: 1,
    packId: PACK_ID,
    version: 'test',
    title: 'Test pack',
    edition: { riwayah: 'حفص عن عاصم', pageCount: 604, fontsIncluded: false, note: 'data only' },
    source: {
      repository: 'https://example.test/qcf4',
      commit: SOURCE_COMMIT,
      rawBaseUrl: 'https://example.test/data',
      dataLicense: 'MIT',
      dataLicenseUrl: 'https://example.test/license',
      attribution: 'MIT',
      fontNotice: 'Fonts excluded',
    },
    files,
    fileCount: files.length,
    totalBytes: files.length * JSON_CONTENT.length,
  });
}

async function resetDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('QuranMushafDataPackDB');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe('mushaf-data-pack', () => {
  let manifestText: string;
  let cachedFonts: Map<string, Response>;

  beforeEach(async () => {
    await resetDatabase();
    manifestText = makeManifest();
    cachedFonts = new Map();
    (globalThis as { __QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__?: Record<string, string> }).__QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__ = {
      manifestUrl: 'https://example.test/manifest.json',
      manifestSha256: sha256(manifestText),
      sourceCommit: SOURCE_COMMIT,
      packId: PACK_ID,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('.woff2')) {
          return Promise.resolve(new Response(FONT_CONTENT));
        }
        return Promise.resolve(new Response(url.includes('manifest.json') ? manifestText : JSON_CONTENT));
      }),
    );
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        put: vi.fn(async (url: string, response: Response) => cachedFonts.set(url, response.clone())),
        match: vi.fn(async (url: string) => cachedFonts.get(url)?.clone()),
        delete: vi.fn(async (url: string) => cachedFonts.delete(url)),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { __QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__?: Record<string, string> })
      .__QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__;
  });

  it('downloads and activates verified page data and QCF4 fonts, then serves a page offline', async () => {
    const progress = vi.fn();
    const status = await downloadMushafDataPack(progress);

    expect(status.installed).toBe(true);
    expect(status.fileCount).toBe(656);
    expect(status.fontsIncluded).toBe(true);
    expect(cachedFonts.size).toBe(48);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 656, total: 656 }));
    await expect(getMushafPageLayout(1)).resolves.toEqual({ lines: [] });
    await expect(verifyMushafDataPack()).resolves.toBe(true);
  }, 30000);

  it('rejects a manifest whose compiled integrity digest does not match', async () => {
    (globalThis as { __QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__?: Record<string, string> }).__QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__!.manifestSha256 =
      '0'.repeat(64);

    await expect(downloadMushafDataPack()).rejects.toThrow('integrity check failed');
    await expect(getMushafDataPackStatus()).resolves.toMatchObject({ installed: false });
  });

  it('does not activate a pack when any downloaded page fails its SHA-256 check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        const content = url.includes('manifest.json') ? manifestText : url.endsWith('pages/010.json') ? '{"lines":["changed"]}' : JSON_CONTENT;
        return Promise.resolve(new Response(content));
      }),
    );

    await expect(downloadMushafDataPack()).rejects.toThrow('Integrity check failed for pages/010.json');
    await expect(getMushafDataPackStatus()).resolves.toMatchObject({ installed: false });
  });

  it('removes the pack and makes its pages unavailable after deletion', async () => {
    await downloadMushafDataPack();
    await deleteMushafDataPack();

    await expect(getMushafDataPackStatus()).resolves.toMatchObject({ installed: false });
    await expect(getMushafPageLayout(1)).resolves.toBeNull();
    await expect(verifyMushafDataPack()).resolves.toBe(false);
    expect(cachedFonts.size).toBe(0);
  }, 30000);
});
