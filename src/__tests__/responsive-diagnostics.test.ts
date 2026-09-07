import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collectResponsiveMetrics,
  media,
  diagnosticsRequested,
  buildDiagnosticsPanel,
  initResponsiveDiagnostics,
} from '../responsive-diagnostics.js';

function stubMatchMedia(matches: Record<string, boolean> = {}): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: matches[q] ?? false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe('media()', () => {
  beforeEach(() => stubMatchMedia({
    '(max-width: 600px)': true,
    '(pointer: coarse)': true,
  }));

  it('returns yes/no for supported queries', () => {
    expect(media('(max-width: 600px)')).toBe('yes');
    expect(media('(pointer: fine)')).toBe('no');
  });

  it('returns n/a when matchMedia is unavailable', () => {
    const orig = window.matchMedia;
    delete (window as unknown as Record<string, unknown>)['matchMedia'];
    expect(media('(max-width: 600px)')).toBe('n/a');
    window.matchMedia = orig;
  });
});

describe('diagnosticsRequested()', () => {
  it('returns true when secret is in search params', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/app?diag=response&foo=bar'),
      writable: true,
      configurable: true,
    });
    expect(diagnosticsRequested()).toBe(true);
  });

  it('returns true when secret is in hash', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/app#diag=response'),
      writable: true,
      configurable: true,
    });
    expect(diagnosticsRequested()).toBe(true);
  });

  it('returns false when secret is absent', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/app'),
      writable: true,
      configurable: true,
    });
    expect(diagnosticsRequested()).toBe(false);
  });
});

describe('collectResponsiveMetrics()', () => {
  beforeEach(() => {
    stubMatchMedia({
      '(pointer: coarse)': true,
      '(hover: none)': true,
      '(orientation: portrait)': false,
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 600px)': false,
      '(max-width: 900px)': false,
      '(min-width: 1440px)': true,
    });
    Object.defineProperty(window, 'innerWidth',  { value: 1920, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126',
      configurable: true,
    });
  });

  it('returns the expected shape', () => {
    const m = collectResponsiveMetrics();
    expect(m).toHaveProperty('viewportWidth', 1920);
    expect(m).toHaveProperty('viewportHeight', 1080);
    expect(m).toHaveProperty('devicePixelRatio', 2);
    expect(m).toHaveProperty('pointer');
    expect(m).toHaveProperty('containerWidth');
  });

  it('reports containerWidth from a supplied element', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 1500, configurable: true });
    const m = collectResponsiveMetrics(el);
    expect(m.containerWidth).toBe(1500);
  });

  it('falls back to .container when no element is supplied', () => {
    const container = document.createElement('div');
    container.className = 'container';
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true });
    document.body.appendChild(container);
    const m = collectResponsiveMetrics();
    expect(m.containerWidth).toBe(1200);
    container.remove();
  });
});

describe('buildDiagnosticsPanel()', () => {
  beforeEach(() => stubMatchMedia({
    '(pointer: coarse)': false,
    '(pointer: fine)': true,
    '(hover: hover)': true,
    '(hover: none)': false,
    '(orientation: portrait)': true,
    '(prefers-reduced-motion: reduce)': false,
    '(max-width: 600px)': true,
    '(max-width: 900px)': true,
    '(min-width: 1440px)': false,
  }));

  it('creates a single DOM node containing key metrics', () => {
    const metrics = collectResponsiveMetrics();
    const [panel] = buildDiagnosticsPanel(metrics);
    expect(panel).toBeInstanceOf(HTMLElement);
    expect(panel.id).toBe('responsive-diag-panel');
    const text = panel.textContent ?? '';
    expect(text).toContain('innerWidth');
    expect(text).toContain(String(metrics.viewportWidth));
    expect(text).toContain('pointer');
    expect(text).toContain('containerW');
  });

  it('includes a close button', () => {
    const [panel] = buildDiagnosticsPanel(collectResponsiveMetrics());
    const btn = panel.querySelector('button');
    expect(btn).not.toBeNull();
  });
});

describe('initResponsiveDiagnostics()', () => {
  it('returns a cleanup function without mounting when param is absent', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/app'),
      writable: true,
      configurable: true,
    });
    const cleanup = initResponsiveDiagnostics();
    expect(typeof cleanup).toBe('function');
    expect(document.getElementById('responsive-diag-panel')).toBeNull();
    cleanup();
  });

  it('mounts the panel when param is present and returns cleanup', () => {
    stubMatchMedia({
      '(pointer: coarse)': false, '(pointer: fine)': true,
      '(hover: hover)': true, '(hover: none)': false,
      '(orientation: portrait)': false,
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 600px)': false, '(max-width: 900px)': false,
      '(min-width: 1440px)': true,
    });
    Object.defineProperty(window, 'innerWidth',  { value: 1920, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1.5, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Chrome/126 Test', configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/app?diag=response'),
      writable: true,
      configurable: true,
    });
    // jsdom needs visualViewport stub
    if (!window.visualViewport) {
      Object.defineProperty(window, 'visualViewport', {
        value: { width: 1920, height: 1080, addEventListener: vi.fn(), removeEventListener: vi.fn() },
        configurable: true,
      });
    }
    document.body.innerHTML = '<div class="container"></div>';

    const cleanup = initResponsiveDiagnostics();
    expect(typeof cleanup).toBe('function');
    const panel = document.getElementById('responsive-diag-panel');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('1920');
    cleanup();
  });
});
