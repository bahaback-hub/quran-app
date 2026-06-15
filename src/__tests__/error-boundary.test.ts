/**
 * Tests for error-boundary.ts — global error boundary with logging and recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock i18n
vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

// Mock templates - errorRecoveryOverlay returns HTML string
// NOTE: The inner HTML must NOT have the same id as the outer overlay div
vi.mock('../templates.js', () => ({
  errorRecoveryOverlay: (msg: string, _details: string) =>
    `<div class="error-overlay-inner"><pre>${msg}</pre><button id="errorCopyBtn">Copy</button></div>`,
}));

// Mock ui showToast (dynamic import target)
vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

import { initErrorBoundary, destroyErrorBoundary, getErrorLog, clearErrorLog } from '../error-boundary.js';

/** Helper to clean up recovery overlays from the DOM. */
function cleanupOverlays() {
  document.querySelectorAll('#errorRecoveryOverlay').forEach((el) => el.remove());
}

describe('initErrorBoundary', () => {
  afterEach(() => {
    destroyErrorBoundary();
  });

  it('should install window.onerror handler', () => {
    initErrorBoundary();
    expect(window.onerror).toBeDefined();
    expect(typeof window.onerror).toBe('function');
  });

  it('should install unhandledrejection event listener', () => {
    initErrorBoundary();
    // We can't easily check listeners, but destroying should not throw
    expect(() => destroyErrorBoundary()).not.toThrow();
  });

  it('should log initialization message', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    initErrorBoundary();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[ErrorBoundary]'));
    infoSpy.mockRestore();
  });
});

describe('destroyErrorBoundary', () => {
  it('should remove window.onerror handler', () => {
    initErrorBoundary();
    expect(window.onerror).toBeDefined();

    destroyErrorBoundary();
    expect(window.onerror).toBeNull();
  });

  it('should not throw when called without init', () => {
    expect(() => destroyErrorBoundary()).not.toThrow();
  });

  it('should log removal message', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    destroyErrorBoundary();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[ErrorBoundary]'));
    infoSpy.mockRestore();
  });
});

describe('getErrorLog', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should return empty array initially', () => {
    expect(getErrorLog()).toEqual([]);
  });

  it('should return a copy of the error log', () => {
    initErrorBoundary();
    window.onerror!('Test error', 'test.js', 1, 1, new Error('Test error'));

    const log1 = getErrorLog();
    const log2 = getErrorLog();
    expect(log1).not.toBe(log2); // Different array instances
    expect(log1).toEqual(log2); // Same contents
  });

  it('should record sync errors in the log', () => {
    initErrorBoundary();
    window.onerror!('Sync error message', 'app.js', 10, 5, new Error('Sync error'));

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].type).toBe('sync');
    expect(log[0].message).toContain('Sync error');
    expect(log[0].source).toBe('app.js');
    expect(log[0].line).toBe(10);
    expect(log[0].col).toBe(5);
  });

  it('should record unhandled promise rejections in the log', () => {
    initErrorBoundary();
    // Use a controlled PromiseRejectionEvent with a resolved promise to avoid Vitest unhandled rejection warnings
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('Promise error'),
    });
    window.dispatchEvent(event);

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].type).toBe('promise');
    expect(log[0].message).toContain('Promise error');
  });

  it('should handle non-Error promise rejection reasons', () => {
    initErrorBoundary();
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: 'string reason',
    });
    window.dispatchEvent(event);

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].type).toBe('promise');
    expect(log[0].message).toBe('string reason');
  });

  it('should record resource load errors in the log', () => {
    initErrorBoundary();
    const img = document.createElement('img');
    img.setAttribute('src', 'nonexistent.png');
    document.body.appendChild(img);

    const errorEvent = new Event('error', { bubbles: true });
    Object.defineProperty(errorEvent, 'target', { value: img, writable: false });
    window.dispatchEvent(errorEvent);

    const log = getErrorLog();
    expect(log.some((e) => e.type === 'resource')).toBe(true);

    document.body.removeChild(img);
  });

  it('should ignore resource errors without src or href', () => {
    initErrorBoundary();
    const div = document.createElement('div');
    document.body.appendChild(div);

    const errorEvent = new Event('error', { bubbles: true });
    Object.defineProperty(errorEvent, 'target', { value: div, writable: false });
    window.dispatchEvent(errorEvent);

    const log = getErrorLog();
    expect(log.every((e) => e.type !== 'resource')).toBe(true);

    document.body.removeChild(div);
  });

  it('should ignore error events targeting window', () => {
    initErrorBoundary();
    const errorEvent = new Event('error');
    Object.defineProperty(errorEvent, 'target', { value: window, writable: false });
    window.dispatchEvent(errorEvent);

    const log = getErrorLog();
    expect(log.every((e) => e.type !== 'resource')).toBe(true);
  });

  it('should ignore error events targeting document', () => {
    initErrorBoundary();
    const errorEvent = new Event('error');
    Object.defineProperty(errorEvent, 'target', { value: document, writable: false });
    window.dispatchEvent(errorEvent);

    const log = getErrorLog();
    expect(log.every((e) => e.type !== 'resource')).toBe(true);
  });
});

describe('clearErrorLog', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should clear all entries from the error log', () => {
    initErrorBoundary();
    window.onerror!('Error 1', 'test.js', 1, 1, new Error('Error 1'));
    window.onerror!('Error 2', 'test.js', 2, 1, new Error('Error 2'));

    expect(getErrorLog().length).toBe(2);

    clearErrorLog();

    expect(getErrorLog()).toEqual([]);
  });
});

describe('error log cap', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should cap error log at 50 entries', () => {
    initErrorBoundary();

    // Generate 55 errors (non-critical to avoid overlay)
    for (let i = 0; i < 55; i++) {
      window.onerror!(`Error ${i}`, 'feature.js', i, 1, new Error(`Error ${i}`));
    }

    const log = getErrorLog();
    expect(log.length).toBeLessThanOrEqual(50);
    // The oldest errors should have been trimmed
    expect(log[0].message).not.toBe('Error 0');
  });
});

describe('error classification', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should show recovery overlay for critical errors (DOM null access)', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!(
      'Cannot read properties of null (reading dom element)',
      'test.js',
      1,
      1,
      new Error('Cannot read properties of null'),
    );
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should show recovery overlay for DOM undefined access errors', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!(
      'Cannot read properties of undefined (reading element)',
      'test.js',
      1,
      1,
      new Error('Cannot read properties of undefined'),
    );
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should show recovery overlay for stack overflow errors', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Maximum call stack size exceeded'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should show recovery overlay for out of memory errors', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Out of memory', 'test.js', 1, 1, new Error('Out of memory'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should show recovery overlay for errors from app.js', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Something broke', 'app.js', 1, 1, new Error('Something broke'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should show recovery overlay for errors from main.js', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Init failure', 'main.js', 1, 1, new Error('Init failure'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should NOT show recovery overlay for non-critical errors', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('A minor error occurred', 'feature.js', 1, 1, new Error('A minor error'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeNull();
  });

  it('should NOT classify empty message as critical', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('', 'feature.js', 1, 1, undefined);
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeNull();
  });

  it('should classify network-related promise rejections as non-critical', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Test fetch-related promise rejection
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('Failed to fetch'),
    });
    window.dispatchEvent(event);
    errorSpy.mockRestore();

    // Should not create recovery overlay for network errors
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeNull();
  });
});

describe('handleOnError return value', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should return true to prevent default browser error handling', () => {
    initErrorBoundary();
    const result = window.onerror!('Test', 'feature.js', 1, 1, new Error('Test'));
    expect(result).toBe(true);
  });
});

describe('error log entry structure', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should have timestamp in each log entry', () => {
    initErrorBoundary();
    const before = Date.now();
    window.onerror!('Test', 'feature.js', 1, 1, new Error('Test'));
    const after = Date.now();

    const log = getErrorLog();
    expect(log[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(log[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should include stack trace when available', () => {
    initErrorBoundary();
    const err = new Error('With stack');
    window.onerror!('With stack', 'feature.js', 1, 1, err);

    const log = getErrorLog();
    expect(log[0].stack).toBe(err.stack);
  });

  it('should handle Event message type', () => {
    initErrorBoundary();
    const event = new Event('error');
    window.onerror!(event, 'feature.js', 1, 1);

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].message).toBe(String(event));
  });

  it('should handle undefined source, line, col', () => {
    initErrorBoundary();
    window.onerror!('No details');

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].message).toBe('No details');
  });

  it('should handle error without stack', () => {
    initErrorBoundary();
    window.onerror!('No stack', 'feature.js', 1, 1, undefined);

    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].stack).toBeUndefined();
  });
});

describe('recovery overlay', () => {
  beforeEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  afterEach(() => {
    clearErrorLog();
    destroyErrorBoundary();
    cleanupOverlays();
  });

  it('should not create duplicate overlays', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Trigger two critical errors
    window.onerror!('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Stack overflow'));
    window.onerror!('Maximum call stack size exceeded', 'test.js', 2, 1, new Error('Stack overflow 2'));
    errorSpy.mockRestore();

    const overlays = document.querySelectorAll('#errorRecoveryOverlay');
    expect(overlays.length).toBe(1);
  });

  it('should create overlay with role="alertdialog"', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Stack overflow'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('role')).toBe('alertdialog');
  });

  it('should create overlay with aria-label', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Stack overflow'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('aria-label')).toBe('error_title'); // i18n key returned by mock
  });

  it('should append overlay to document body', () => {
    initErrorBoundary();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.onerror!('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Stack overflow'));
    errorSpy.mockRestore();

    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.parentElement).toBe(document.body);
  });
});
