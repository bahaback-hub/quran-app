/**
 * Tests for safeLoad and safeAsync retry mechanisms.
 *
 * Verifies:
 *   - Success on first try
 *   - Retry on failure with exponential backoff
 *   - Final failure returns structured result
 *   - Cache prevents infinite retries across calls
 *   - safeAsync returns fallback on failure
 *   - resetFailedModulesCache clears the cache
 *   - Options (maxRetries, baseDelay, showToast, label) work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock i18n
vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

// Mock ui — use importOriginal to preserve other exports if needed
vi.mock('../ui.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    showToast: vi.fn(),
    loadingBar: { show: vi.fn(), hide: vi.fn() },
  };
});

// Mock templates (errorRecoveryOverlay)
vi.mock('../templates.js', () => ({
  errorRecoveryOverlay: '<div>overlay</div>',
}));

// Mock storage
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock config
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    TAFSIR_API: '',
    PRAYER_API: '',
    AZAN_FILE: '',
    SURAH_COUNT: 114,
    STORAGE_PREFIX: '',
    DEFAULT_RECITER: '',
    DEFAULT_TAFSIR: '',
    DEFAULT_METHOD: '4',
    DEFAULT_CITY: '',
    DEFAULT_COUNTRY: '',
    CACHE_LIMIT: 20,
  },
}));

import { safeLoad, safeAsync, resetFailedModulesCache } from '../error-boundary.js';

describe('safeLoad — retry mechanism', () => {
  beforeEach(() => {
    resetFailedModulesCache();
    vi.clearAllMocks();
  });

  it('should succeed on first try', async () => {
    const loader = vi.fn().mockResolvedValue({ init: vi.fn() });
    const result = await safeLoad(loader, { label: 'test-module', showToast: false });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.module).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure with exponential backoff', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network 1'))
      .mockRejectedValueOnce(new Error('Network 2'))
      .mockResolvedValueOnce({ init: vi.fn() });

    const result = await safeLoad(loader, {
      label: 'retry-test',
      maxRetries: 3,
      baseDelay: 10, // Fast for tests
      showToast: false,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('should fail after exhausting retries', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('Always fails'));
    const result = await safeLoad(loader, {
      label: 'always-fail',
      maxRetries: 2,
      baseDelay: 10,
      showToast: false,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // initial + 2 retries
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Always fails');
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('should cache failures across calls (skip after maxRetries)', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('Persistent fail'));

    // First call: exhausts retries (3 attempts: initial + 2 retries)
    const result1 = await safeLoad(loader, {
      label: 'cached-fail',
      maxRetries: 2,
      baseDelay: 10,
      showToast: false,
    });
    expect(result1.success).toBe(false);
    expect(result1.attempts).toBe(3);

    // Second call: should skip (0 attempts)
    const result2 = await safeLoad(loader, {
      label: 'cached-fail',
      maxRetries: 2,
      baseDelay: 10,
      showToast: false,
    });
    expect(result2.success).toBe(false);
    expect(result2.attempts).toBe(0);
    // loader not called again
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('should reset failure count on success', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Once'))
      .mockResolvedValueOnce({ init: vi.fn() });

    // First call: 1 failure + 1 success = success after retry
    const result1 = await safeLoad(loader, {
      label: 'reset-test',
      maxRetries: 3,
      baseDelay: 10,
      showToast: false,
    });
    expect(result1.success).toBe(true);

    // Cache should be cleared, so next call starts fresh
    loader.mockResolvedValueOnce({ init: vi.fn() });
    const result2 = await safeLoad(loader, {
      label: 'reset-test',
      maxRetries: 3,
      baseDelay: 10,
      showToast: false,
    });
    expect(result2.success).toBe(true);
    expect(result2.attempts).toBe(1);
  });

  it('should call showToast on retry when showToast=true', async () => {
    const { showToast } = await import('../ui.js');
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Once'))
      .mockResolvedValueOnce({});

    await safeLoad(loader, {
      label: 'toast-test',
      maxRetries: 1,
      baseDelay: 10,
      showToast: true,
    });

    // Should have called showToast with warning message
    expect(showToast).toHaveBeenCalled();
    const calls = vi.mocked(showToast).mock.calls;
    expect(calls.some((call) => call[0].includes('فشل تحميل'))).toBe(true);
  });

  it('should NOT call showToast when showToast=false', async () => {
    const { showToast } = await import('../ui.js');
    vi.mocked(showToast).mockClear();

    const loader = vi.fn().mockResolvedValue({});
    await safeLoad(loader, {
      label: 'no-toast',
      showToast: false,
    });

    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('safeAsync — wrap with retry', () => {
  beforeEach(() => {
    resetFailedModulesCache();
    vi.clearAllMocks();
  });

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    const result = await safeAsync(fn, {
      fallback: 'fallback',
      label: 'test-async',
      showToast: false,
    });

    expect(result).toBe('hello');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Retry me'))
      .mockResolvedValueOnce('success');

    const result = await safeAsync(fn, {
      fallback: 'fallback',
      maxRetries: 2,
      baseDelay: 10,
      label: 'retry-async',
      showToast: false,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should return fallback after all retries fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
    const result = await safeAsync(fn, {
      fallback: 'safe-default',
      maxRetries: 2,
      baseDelay: 10,
      label: 'fallback-test',
      showToast: false,
    });

    expect(result).toBe('safe-default');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should handle null fallback', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'));
    const result = await safeAsync(fn, {
      fallback: null,
      maxRetries: 0,
      baseDelay: 10,
      label: 'null-fallback',
      showToast: false,
    });

    expect(result).toBeNull();
  });

  it('should handle object fallback', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'));
    const fallbackObj = { items: [], total: 0 };
    const result = await safeAsync(fn, {
      fallback: fallbackObj,
      maxRetries: 0,
      label: 'obj-fallback',
      showToast: false,
    });

    expect(result).toBe(fallbackObj);
  });
});

describe('resetFailedModulesCache', () => {
  it('should allow retrying previously failed modules', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('Always fails'));

    // Exhaust retries
    await safeLoad(loader, {
      label: 'reset-cache-test',
      maxRetries: 1,
      baseDelay: 10,
      showToast: false,
    });
    expect(loader).toHaveBeenCalledTimes(2);

    // Should skip now
    await safeLoad(loader, {
      label: 'reset-cache-test',
      maxRetries: 1,
      baseDelay: 10,
      showToast: false,
    });
    expect(loader).toHaveBeenCalledTimes(2); // still 2

    // Reset cache
    resetFailedModulesCache();

    // Should try again
    await safeLoad(loader, {
      label: 'reset-cache-test',
      maxRetries: 1,
      baseDelay: 10,
      showToast: false,
    });
    expect(loader).toHaveBeenCalledTimes(4); // 2 more attempts
  });
});

describe('safeLoad — option defaults', () => {
  beforeEach(() => {
    resetFailedModulesCache();
    vi.clearAllMocks();
  });

  it('should default maxRetries to 2', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('Fail'));
    const result = await safeLoad(loader, {
      label: 'defaults-test',
      baseDelay: 10,
      showToast: false,
    });

    expect(result.attempts).toBe(3); // initial + 2 default retries
  });

  it('should use custom label in error messages', async () => {
    const { showToast } = await import('../ui.js');
    vi.mocked(showToast).mockClear();

    const loader = vi.fn().mockRejectedValue(new Error('Fail'));
    await safeLoad(loader, {
      label: 'ميزة خاصة',
      maxRetries: 0,
      baseDelay: 10,
      showToast: true,
    });

    const calls = vi.mocked(showToast).mock.calls;
    // Should mention the label in the final error toast
    expect(calls.some((call) => call[0].includes('ميزة خاصة'))).toBe(true);
  });
});
