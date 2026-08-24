/**
 * Verified Mushaf Layout Data Pack.
 *
 * This module installs the complete offline Mushaf experience: verified page
 * layout data, indexes, and the locally hosted QCF4 font collection.
 */

import { QCF4_FONT_CACHE_NAME, QCF4_FONT_NAMES, QCF4_FONT_TOTAL_BYTES, qcf4FontUrl } from './qcf4-font-pack.js';

export interface MushafPackFile {
  path: string;
  bytes: number;
  sha256: string;
}

interface MushafDataManifest {
  schemaVersion: number;
  packId: string;
  version: string;
  title: string;
  edition: { riwayah: string; pageCount: number; fontsIncluded: boolean; note: string };
  source: {
    repository: string;
    commit: string;
    rawBaseUrl: string;
    dataLicense: string;
    dataLicenseUrl: string;
    attribution: string;
    fontNotice: string;
  };
  files: MushafPackFile[];
  fileCount: number;
  totalBytes: number;
}

export interface MushafDataPackStatus {
  installed: boolean;
  packId: string | null;
  version: string | null;
  sourceCommit: string | null;
  pageCount: number;
  fileCount: number;
  totalBytes: number;
  installedAt: string | null;
  fontsIncluded: boolean;
}

export interface MushafDataPackProgress {
  completed: number;
  total: number;
  bytesDownloaded: number;
  totalBytes: number;
  currentPath: string;
}

const DB_NAME = 'QuranMushafDataPackDB';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const META_STORE = 'meta';
const ACTIVE_PACK_KEY = 'active-pack';
const MANIFEST_URL = `${import.meta.env.BASE_URL}data/mushaf-pack/qcf4-hafs-layout-v1.manifest.json`;
// This value is deliberately compiled into the app. A manifest that is changed
// after the app release is rejected instead of becoming a new trust anchor.
const EXPECTED_MANIFEST_SHA256 = 'f35eac867c1da0064076dca6676096ada8b1a8de4da363b405e14c7880d82231';
const EXPECTED_SOURCE_COMMIT = '5130511027e769f0a8f4eeb7f00f46bde3788d60';
const MAX_CONCURRENT_DOWNLOADS = 6;

interface MushafDataPackRuntimeConfig {
  manifestUrl: string;
  manifestSha256: string;
  sourceCommit: string;
  packId: string;
}

interface StoredFile {
  key: string;
  packId: string;
  path: string;
  content: string;
  bytes: number;
  sha256: string;
}

interface ActivePackMeta {
  key: typeof ACTIVE_PACK_KEY;
  status: MushafDataPackStatus;
  files: MushafPackFile[];
}

function getRuntimeConfig(): MushafDataPackRuntimeConfig {
  // Test-only configuration permits deterministic integrity tests without
  // weakening the compiled production trust anchor.
  const testConfig =
    import.meta.env.MODE === 'test'
      ? (globalThis as { __QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__?: Partial<MushafDataPackRuntimeConfig> })
          .__QURAN_TEST_MUSHAF_DATA_PACK_CONFIG__
      : undefined;
  return {
    manifestUrl: testConfig?.manifestUrl ?? MANIFEST_URL,
    manifestSha256: testConfig?.manifestSha256 ?? EXPECTED_MANIFEST_SHA256,
    sourceCommit: testConfig?.sourceCommit ?? EXPECTED_SOURCE_COMMIT,
    packId: testConfig?.packId ?? 'qcf4-hafs-layout-v1',
  };
}

function defaultStatus(): MushafDataPackStatus {
  return {
    installed: false,
    packId: null,
    version: null,
    sourceCommit: null,
    pageCount: 0,
    fileCount: 0,
    totalBytes: 0,
    installedAt: null,
    fontsIncluded: false,
  };
}

function fileKey(packId: string, path: string): string {
  return `${packId}:${path}`;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable; cannot verify Mushaf data.');
  }
  // Response.arrayBuffer() can originate from a different JS realm in tests
  // and embedded WebViews. Copy it into a local typed array before passing it
  // to Web Crypto, which accepts the normalized BufferSource reliably.
  const normalized = new Uint8Array(bytes).slice();
  return bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', normalized));
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open Mushaf data storage.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Mushaf data transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Mushaf data transaction aborted.'));
  });
}

async function getRecord<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB();
  try {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    return await new Promise<T | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error('Could not read Mushaf data.'));
    });
  } finally {
    db.close();
  }
}

async function putRecord(storeName: string, record: StoredFile | ActivePackMeta): Promise<void> {
  const db = await openDB();
  try {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

function isSafeDataPath(path: string): boolean {
  return /^(pages\/\d{3}\.json|index\.json|verses\.json|font-map\.json|qbsml\.json)$/.test(path);
}

function validateManifest(manifest: MushafDataManifest, config: MushafDataPackRuntimeConfig): void {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.packId !== config.packId ||
    manifest.source?.commit !== config.sourceCommit ||
    manifest.edition?.fontsIncluded !== false ||
    manifest.edition?.pageCount !== 604 ||
    manifest.source?.dataLicense !== 'MIT' ||
    manifest.files?.length !== 608 ||
    manifest.fileCount !== manifest.files.length
  ) {
    throw new Error('Mushaf data manifest has an unexpected shape or source.');
  }
  const paths = new Set<string>();
  for (const file of manifest.files) {
    if (!isSafeDataPath(file.path) || paths.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || file.bytes < 1) {
      throw new Error('Mushaf data manifest contains an invalid file entry.');
    }
    paths.add(file.path);
  }
}

async function getVerifiedManifest(): Promise<MushafDataManifest> {
  const config = getRuntimeConfig();
  const response = await fetch(config.manifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Mushaf data manifest request failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  const digest = await sha256(new TextEncoder().encode(text).buffer);
  if (digest !== config.manifestSha256) {
    throw new Error('Mushaf data manifest integrity check failed.');
  }
  const manifest = JSON.parse(text) as MushafDataManifest;
  validateManifest(manifest, config);
  return manifest;
}

async function downloadAndStoreFile(
  manifest: MushafDataManifest,
  file: MushafPackFile,
): Promise<void> {
  const response = await fetch(`${manifest.source.rawBaseUrl}/${file.path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not download ${file.path}: HTTP ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.bytes || (await sha256(bytes)) !== file.sha256) {
    throw new Error(`Integrity check failed for ${file.path}.`);
  }
  const content = new TextDecoder().decode(bytes);
  try {
    JSON.parse(content);
  } catch {
    throw new Error(`Downloaded content is not valid JSON: ${file.path}.`);
  }
  await putRecord(FILE_STORE, {
    key: fileKey(manifest.packId, file.path),
    packId: manifest.packId,
    path: file.path,
    content,
    bytes: file.bytes,
    sha256: file.sha256,
  });
}

function fullPackFileCount(manifest: MushafDataManifest): number {
  return manifest.files.length + QCF4_FONT_NAMES.length;
}

function fullPackTotalBytes(manifest: MushafDataManifest): number {
  return manifest.totalBytes + QCF4_FONT_TOTAL_BYTES;
}

async function cacheQcf4Fonts(
  onProgress: ((progress: MushafDataPackProgress) => void) | undefined,
  completedBeforeFonts: number,
  bytesBeforeFonts: number,
  totalFiles: number,
  totalBytes: number,
): Promise<{ completed: number; bytesDownloaded: number }> {
  if (!globalThis.caches) {
    throw new Error('Cache storage is unavailable; cannot save Mushaf fonts offline.');
  }

  const cache = await globalThis.caches.open(QCF4_FONT_CACHE_NAME);
  let cursor = 0;
  let completed = completedBeforeFonts;
  let bytesDownloaded = bytesBeforeFonts;
  let failure: Error | null = null;

  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (failure === null) {
        const index = cursor++;
        if (index >= QCF4_FONT_NAMES.length) {
          return;
        }
        const fontName = QCF4_FONT_NAMES[index]!;
        const url = qcf4FontUrl(fontName);
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`Could not download Mushaf font ${fontName}: HTTP ${response.status}`);
          }
          const fontBytes = await response.arrayBuffer();
          if (fontBytes.byteLength < 10_000) {
            throw new Error(`Downloaded Mushaf font ${fontName} is unexpectedly small.`);
          }
          await cache.put(url, new Response(fontBytes, { headers: { 'Content-Type': 'font/woff2' } }));
          completed++;
          bytesDownloaded += fontBytes.byteLength;
          onProgress?.({
            completed,
            total: totalFiles,
            bytesDownloaded,
            totalBytes,
            currentPath: `fonts/${fontName}.woff2`,
          });
        } catch (error) {
          failure = error instanceof Error ? error : new Error('Mushaf font download failed.');
          return;
        }
      }
    }),
  );

  if (failure) {
    throw failure;
  }

  return { completed, bytesDownloaded };
}

async function verifyQcf4Fonts(
  onProgress: ((progress: MushafDataPackProgress) => void) | undefined,
  completedBeforeFonts: number,
  bytesBeforeFonts: number,
  totalFiles: number,
  totalBytes: number,
): Promise<boolean> {
  if (!globalThis.caches) {
    return false;
  }
  const cache = await globalThis.caches.open(QCF4_FONT_CACHE_NAME);
  let completed = completedBeforeFonts;
  let bytesDownloaded = bytesBeforeFonts;

  for (const fontName of QCF4_FONT_NAMES) {
    const response = await cache.match(qcf4FontUrl(fontName));
    if (!response) {
      return false;
    }
    const fontBytes = await response.arrayBuffer();
    if (fontBytes.byteLength < 10_000) {
      return false;
    }
    completed++;
    bytesDownloaded += fontBytes.byteLength;
    onProgress?.({
      completed,
      total: totalFiles,
      bytesDownloaded,
      totalBytes,
      currentPath: `fonts/${fontName}.woff2`,
    });
  }

  return true;
}

export async function getMushafDataPackStatus(): Promise<MushafDataPackStatus> {
  try {
    return (await getRecord<ActivePackMeta>(META_STORE, ACTIVE_PACK_KEY))?.status ?? defaultStatus();
  } catch {
    return defaultStatus();
  }
}

/** Download the full offline Mushaf package in one user action. */
export async function downloadMushafDataPack(
  onProgress?: (progress: MushafDataPackProgress) => void,
): Promise<MushafDataPackStatus> {
  const manifest = await getVerifiedManifest();
  const totalFiles = fullPackFileCount(manifest);
  const totalBytes = fullPackTotalBytes(manifest);
  let cursor = 0;
  let completed = 0;
  let bytesDownloaded = 0;
  let failure: Error | null = null;

  onProgress?.({
    completed,
    total: totalFiles,
    bytesDownloaded,
    totalBytes,
    currentPath: '',
  });

  await Promise.all(
    Array.from({ length: MAX_CONCURRENT_DOWNLOADS }, async () => {
      while (failure === null) {
        const index = cursor++;
        if (index >= manifest.files.length) {
          return;
        }
        const file = manifest.files[index]!;
        try {
          await downloadAndStoreFile(manifest, file);
          completed++;
          bytesDownloaded += file.bytes;
          onProgress?.({
            completed,
            total: totalFiles,
            bytesDownloaded,
            totalBytes,
            currentPath: file.path,
          });
        } catch (error) {
          failure = error instanceof Error ? error : new Error('Mushaf data download failed.');
          return;
        }
      }
    }),
  );

  if (failure) {
    throw failure;
  }

  await cacheQcf4Fonts(
    onProgress,
    completed,
    bytesDownloaded,
    totalFiles,
    totalBytes,
  );

  const status: MushafDataPackStatus = {
    installed: true,
    packId: manifest.packId,
    version: manifest.version,
    sourceCommit: manifest.source.commit,
    pageCount: manifest.edition.pageCount,
    fileCount: totalFiles,
    totalBytes,
    installedAt: new Date().toISOString(),
    fontsIncluded: true,
  };
  await putRecord(META_STORE, { key: ACTIVE_PACK_KEY, status, files: manifest.files });
  return status;
}

export async function verifyMushafDataPack(
  onProgress?: (progress: MushafDataPackProgress) => void,
): Promise<boolean> {
  const active = await getRecord<ActivePackMeta>(META_STORE, ACTIVE_PACK_KEY);
  if (!active?.status.installed || !active.status.packId) {
    return false;
  }
  const totalFiles = active.files.length + QCF4_FONT_NAMES.length;
  const totalBytes = active.status.totalBytes;
  let bytesVerified = 0;
  for (const [index, file] of active.files.entries()) {
    const stored = await getRecord<StoredFile>(FILE_STORE, fileKey(active.status.packId, file.path));
    if (!stored || stored.bytes !== file.bytes || stored.sha256 !== file.sha256) {
      return false;
    }
    const bytes = new TextEncoder().encode(stored.content).buffer;
    if (bytes.byteLength !== file.bytes || (await sha256(bytes)) !== file.sha256) {
      return false;
    }
    bytesVerified += file.bytes;
    onProgress?.({
      completed: index + 1,
      total: totalFiles,
      bytesDownloaded: bytesVerified,
      totalBytes,
      currentPath: file.path,
    });
  }
  return verifyQcf4Fonts(onProgress, active.files.length, bytesVerified, totalFiles, totalBytes);
}

export async function getMushafPageLayout(pageNum: number): Promise<unknown | null> {
  if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 604) {
    return null;
  }
  try {
    const active = await getRecord<ActivePackMeta>(META_STORE, ACTIVE_PACK_KEY);
    if (!active?.status.installed || !active.status.packId) {
      return null;
    }
    const path = `pages/${String(pageNum).padStart(3, '0')}.json`;
    const stored = await getRecord<StoredFile>(FILE_STORE, fileKey(active.status.packId, path));
    if (!stored) {
      return null;
    }
    return JSON.parse(stored.content) as unknown;
  } catch {
    return null;
  }
}

export async function deleteMushafDataPack(): Promise<void> {
  const active = await getRecord<ActivePackMeta>(META_STORE, ACTIVE_PACK_KEY);
  if (!active?.status.packId) {
    return;
  }
  const db = await openDB();
  try {
    const transaction = db.transaction([FILE_STORE, META_STORE], 'readwrite');
    const fileStore = transaction.objectStore(FILE_STORE);
    for (const file of active.files) {
      fileStore.delete(fileKey(active.status.packId, file.path));
    }
    transaction.objectStore(META_STORE).delete(ACTIVE_PACK_KEY);
    await transactionDone(transaction);
  } finally {
    db.close();
  }

  if (globalThis.caches) {
    const cache = await globalThis.caches.open(QCF4_FONT_CACHE_NAME);
    await Promise.all(QCF4_FONT_NAMES.map((fontName) => cache.delete(qcf4FontUrl(fontName))));
  }
}

export function formatMushafDataBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
