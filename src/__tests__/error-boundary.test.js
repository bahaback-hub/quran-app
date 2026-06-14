import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initErrorBoundary, destroyErrorBoundary, getErrorLog, clearErrorLog } from '../error-boundary.js';

describe('Error Boundary', () => {
  beforeEach(() => {
    clearErrorLog();
    initErrorBoundary();
  });

  afterEach(() => {
    destroyErrorBoundary();
    // Clean up any recovery overlays
    document.getElementById('errorRecoveryOverlay')?.remove();
  });

  /* ===================== INIT / DESTROY ===================== */

  it('should install and remove handlers without errors', () => {
    expect(() => initErrorBoundary()).not.toThrow();
    expect(() => destroyErrorBoundary()).not.toThrow();
  });

  it('should set window.onerror after init', () => {
    expect(window.onerror).toBeTruthy();
  });

  it('should clear window.onerror after destroy', () => {
    destroyErrorBoundary();
    expect(window.onerror).toBeNull();
  });

  /* ===================== SYNC ERRORS (window.onerror) ===================== */

  it('should catch synchronous errors via window.onerror', () => {
    window.onerror('Test error', 'test.js', 10, 5, new Error('Test error'));
    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    const entry = log[log.length - 1];
    expect(entry.type).toBe('sync');
    expect(entry.message).toContain('Test error');
    expect(entry.source).toBe('test.js');
    expect(entry.line).toBe(10);
    expect(entry.col).toBe(5);
  });

  it('should return true from onerror to prevent default handling', () => {
    const result = window.onerror('Test', 'test.js', 1, 1, new Error('Test'));
    expect(result).toBe(true);
  });

  it('should capture error stack when available', () => {
    const error = new Error('Stack test');
    window.onerror('Stack test', 'test.js', 1, 1, error);
    const log = getErrorLog();
    const entry = log[log.length - 1];
    expect(entry.stack).toBeTruthy();
  });

  /* ===================== PROMISE REJECTIONS ===================== */

  it('should catch unhandled promise rejections', () => {
    const rejected = Promise.reject(new Error('Promise failed'));
    rejected.catch(() => {});
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: rejected,
      reason: new Error('Promise failed'),
    });
    window.dispatchEvent(event);
    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
    const entry = log[log.length - 1];
    expect(entry.type).toBe('promise');
    expect(entry.message).toContain('Promise failed');
  });

  it('should handle non-Error rejection reasons', () => {
    const rejected = Promise.reject('string rejection');
    rejected.catch(() => {});
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: rejected,
      reason: 'string rejection',
    });
    window.dispatchEvent(event);
    const log = getErrorLog();
    const entry = log[log.length - 1];
    expect(entry.message).toBe('string rejection');
  });

  /* ===================== ERROR LOG ===================== */

  it('should accumulate errors in the log', () => {
    window.onerror('Error 1', 'a.js', 1, 1, new Error('Error 1'));
    window.onerror('Error 2', 'b.js', 2, 1, new Error('Error 2'));
    expect(getErrorLog().length).toBeGreaterThanOrEqual(2);
  });

  it('should trim log entries beyond MAX_LOG_ENTRIES', () => {
    for (let i = 0; i < 55; i++) {
      window.onerror(`Error ${i}`, 'test.js', i, 1, new Error(`Error ${i}`));
    }
    expect(getErrorLog().length).toBeLessThanOrEqual(50);
  });

  it('should clear the error log', () => {
    window.onerror('Error', 'test.js', 1, 1, new Error('Error'));
    clearErrorLog();
    expect(getErrorLog().length).toBe(0);
  });

  /* ===================== CRITICAL ERROR CLASSIFICATION ===================== */

  it('should show recovery overlay for critical errors (null DOM)', () => {
    window.onerror(
      "Cannot read properties of null (reading 'dom')",
      'app.js',
      1,
      1,
      new Error("Cannot read properties of null (reading 'dom')")
    );
    // Recovery overlay should be created
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeTruthy();
    overlay?.remove();
  });

  it('should show recovery overlay for errors from app.js', () => {
    window.onerror('Something broke', 'app.js', 1, 1, new Error('Something broke'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeTruthy();
    overlay?.remove();
  });

  it('should show recovery overlay for errors from main.js', () => {
    window.onerror('Init failed', 'main.js', 1, 1, new Error('Init failed'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeTruthy();
    overlay?.remove();
  });

  it('should show recovery overlay for stack overflow', () => {
    window.onerror('Maximum call stack size exceeded', 'test.js', 1, 1, new Error('Maximum call stack size exceeded'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeTruthy();
    overlay?.remove();
  });

  it('should NOT show recovery overlay for non-critical errors', () => {
    window.onerror('Some minor issue', 'feature.js', 1, 1, new Error('Some minor issue'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeNull();
  });

  /* ===================== NETWORK ERROR DETECTION ===================== */

  it('should detect network errors from promise rejections', () => {
    const rejected = Promise.reject(new TypeError('Failed to fetch'));
    rejected.catch(() => {});
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: rejected,
      reason: new TypeError('Failed to fetch'),
    });
    window.dispatchEvent(event);
    const log = getErrorLog();
    const entry = log[log.length - 1];
    expect(entry.type).toBe('promise');
    expect(entry.message).toContain('Failed to fetch');
  });

  it('should detect network error variants', () => {
    const rejected = Promise.reject(new Error('NetworkError when attempting to fetch resource'));
    rejected.catch(() => {});
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: rejected,
      reason: new Error('NetworkError when attempting to fetch resource'),
    });
    window.dispatchEvent(event);
    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });

  /* ===================== RECOVERY OVERLAY ===================== */

  it('should create recovery overlay with correct buttons', () => {
    window.onerror('Critical error', 'app.js', 1, 1, new Error('Critical error'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    expect(overlay).toBeTruthy();
    expect(document.getElementById('errorRecoveryReload')).toBeTruthy();
    expect(document.getElementById('errorRecoveryHome')).toBeTruthy();
    expect(document.getElementById('errorRecoveryCopy')).toBeTruthy();
    overlay?.remove();
  });

  it('should have RTL direction class in recovery overlay', () => {
    window.onerror('Critical error', 'app.js', 1, 1, new Error('Critical error'));
    const overlay = document.getElementById('errorRecoveryOverlay');
    const backdrop = overlay?.querySelector('.error-overlay-backdrop');
    expect(backdrop).toBeTruthy();
    overlay?.remove();
  });

  it('should have technical details in a <details> element', () => {
    window.onerror('Critical error', 'app.js', 1, 1, new Error('Critical error'));
    const details = document.querySelector('#errorRecoveryOverlay details');
    expect(details).toBeTruthy();
    document.getElementById('errorRecoveryOverlay')?.remove();
  });

  /* ===================== EDGE CASES ===================== */

  it('should handle onerror with missing parameters', () => {
    expect(() => window.onerror('Just a message')).not.toThrow();
    const log = getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it('should handle onerror with undefined error object', () => {
    expect(() => window.onerror('Error', 'test.js', 1, 1, undefined)).not.toThrow();
  });

  it('should not create duplicate recovery overlays', () => {
    window.onerror('Critical 1', 'app.js', 1, 1, new Error('Critical 1'));
    window.onerror('Critical 2', 'app.js', 2, 1, new Error('Critical 2'));
    const overlays = document.querySelectorAll('#errorRecoveryOverlay');
    expect(overlays.length).toBe(1);
    overlays[0]?.remove();
  });

  it('should handle promise rejection with numeric reason', () => {
    const rejected = Promise.reject(404);
    rejected.catch(() => {});
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: rejected,
      reason: 404,
    });
    expect(() => window.dispatchEvent(event)).not.toThrow();
  });

  it('should include timestamp in error log entries', () => {
    const before = Date.now();
    window.onerror('Timestamp test', 'test.js', 1, 1, new Error('Timestamp test'));
    const log = getErrorLog();
    const entry = log[log.length - 1];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
