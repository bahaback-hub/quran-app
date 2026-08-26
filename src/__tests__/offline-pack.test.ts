/**
 * Tests for offline-pack module.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getOfflinePackStatus, clearOfflinePackStatus, formatBytes, estimateOfflinePackSize } from '../offline-pack.js';

describe('offline-pack', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOfflinePackStatus', () => {
    it('returns default status when nothing is stored', () => {
      const status = getOfflinePackStatus();
      expect(status.installed).toBe(false);
      expect(status.installedAt).toBeNull();
      expect(status.itemCount).toBe(0);
      expect(status.sizeBytes).toBe(0);
      expect(status.reciterId).toBeNull();
    });

    it('returns stored status when present', () => {
      const stored = {
        installed: true,
        installedAt: '2026-01-01T00:00:00.000Z',
        itemCount: 42,
        sizeBytes: 50_000_000,
        reciterId: 'ar.alafasy',
      };
      localStorage.setItem('offline_pack_status', JSON.stringify(stored));

      const status = getOfflinePackStatus();
      expect(status.installed).toBe(true);
      expect(status.installedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(status.itemCount).toBe(42);
      expect(status.sizeBytes).toBe(50_000_000);
      expect(status.reciterId).toBe('ar.alafasy');
    });

    it('returns default on corrupted JSON', () => {
      localStorage.setItem('offline_pack_status', '{invalid json');
      const status = getOfflinePackStatus();
      expect(status.installed).toBe(false);
    });
  });

  describe('clearOfflinePackStatus', () => {
    it('removes the status from localStorage', () => {
      localStorage.setItem('offline_pack_status', '{"installed":true}');
      clearOfflinePackStatus();
      expect(localStorage.getItem('offline_pack_status')).toBeNull();
    });

    it('is safe to call when nothing is stored', () => {
      expect(() => clearOfflinePackStatus()).not.toThrow();
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('estimateOfflinePackSize', () => {
    it('estimates size without audio', () => {
      const size = estimateOfflinePackSize(false, 0);
      expect(size).toBe(1_700_000 + 3_000_000 + 500_000);
    });

    it('estimates size with audio', () => {
      const size = estimateOfflinePackSize(true, 30);
      expect(size).toBe(1_700_000 + 3_000_000 + 500_000 + 30 * 8_000_000);
    });

    it('audio estimate scales linearly', () => {
      const size1 = estimateOfflinePackSize(true, 10);
      const size2 = estimateOfflinePackSize(true, 20);
      expect(size2 - size1).toBe(10 * 8_000_000);
    });
  });
});
