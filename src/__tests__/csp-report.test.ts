import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initCspReporting, getCspViolations, MAX_CSP_VIOLATIONS, resetCspReportingForTests } from '../csp-report.js';
import { CONFIG } from '../config.js';

/** Build a synthetic securitypolicyviolation event that jsdom can dispatch. */
function makeViolationEvent(overrides: Record<string, unknown> = {}): Event {
  const event = new Event('securitypolicyviolation', { bubbles: true, cancelable: true });
  Object.assign(event, {
    blockedURI: 'https://evil.example/script.js',
    effectiveDirective: 'script-src-elem',
    violatedDirective: 'script-src-elem',
    originalPolicy: "default-src 'self'",
    disposition: 'enforce',
    sourceFile: 'https://app.example/main.js',
    lineNumber: 12,
    columnNumber: 3,
    sample: "console.log('x')",
    statusCode: 200,
    ...overrides,
  });
  return event;
}

describe('csp-report', () => {
  const originalBeacon = navigator.sendBeacon;

  beforeEach(() => {
    CONFIG.CSP_REPORT_ENDPOINT = '';
    resetCspReportingForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', { value: originalBeacon, configurable: true });
  });

  it('records dispatchable violations into the ring buffer', () => {
    initCspReporting();

    window.dispatchEvent(makeViolationEvent());
    window.dispatchEvent(makeViolationEvent({ blockedURI: 'https://other.example/x.png' }));

    const violations = getCspViolations();
    expect(violations).toHaveLength(2);
    expect(violations[1]).toMatchObject({
      blockedURI: 'https://other.example/x.png',
      violatedDirective: 'script-src-elem',
    });
  });

  it('tolerates jsdom events that lack the standard fields', () => {
    initCspReporting();

    // No fields assigned: every getter must fall back to a safe default.
    const bare = new Event('securitypolicyviolation', { bubbles: false });
    window.dispatchEvent(bare);

    expect(getCspViolations()).toHaveLength(1);
    expect(getCspViolations()[0]).toMatchObject({
      blockedURI: '',
      effectiveDirective: '',
      lineNumber: 0,
      disposition: 'enforce',
    });
  });

  it('is idempotent — repeated init never double-buffers a single event', () => {
    initCspReporting();
    initCspReporting();
    initCspReporting();

    window.dispatchEvent(makeViolationEvent());

    expect(getCspViolations()).toHaveLength(1);
  });

  it('caps the buffer at MAX_CSP_VIOLATIONS', () => {
    initCspReporting();

    for (let i = 0; i < MAX_CSP_VIOLATIONS + 25; i += 1) {
      window.dispatchEvent(makeViolationEvent({ timestamp: i }));
    }

    const violations = getCspViolations();
    expect(violations).toHaveLength(MAX_CSP_VIOLATIONS);
    // Ring removes the oldest entries first.
    expect((violations[0] as { timestamp?: number })?.timestamp).toBe(25);
  });

  it('ships the batch to the configured endpoint via sendBeacon', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    CONFIG.CSP_REPORT_ENDPOINT = 'https://collector.example/reports';

    initCspReporting();
    window.dispatchEvent(makeViolationEvent({ blockedURI: 'https://evil.example/script.js' }));

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, body] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('https://collector.example/reports');
    expect(body.type).toBe('application/reports+json');
    void body;
  });

  it('stays silent when no endpoint is configured', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    initCspReporting();
    window.dispatchEvent(makeViolationEvent());

    expect(beacon).not.toHaveBeenCalled();
  });
});
