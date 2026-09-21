/**
 * Client-side CSP violation reporting.
 *
 * GitHub Pages is a static host: there is no way to add a `Report-To` HTTP
 * header or a server-side collector here. The CSP's `securitypolicyviolation`
 * events are the authoritative signal on every Chromium/Firefox/WebKit build,
 * so every blocked request is recorded into a bounded in-memory ring buffer
 * (surfaced for debugging and E2E assertions) and, when a
 * `VITE_CSP_REPORT_ENDPOINT` is configured at build time, the batch is shipped
 * to that collector via `navigator.sendBeacon` (never a blocking fetch).
 */

import { CONFIG } from './config.js';

/** A normalized, serializable snapshot of one CSP violation. */
export interface CspViolation {
  blockedURI: string;
  effectiveDirective: string;
  violatedDirective: string;
  originalPolicy: string;
  disposition: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  sample: string;
  statusCode: number;
  timestamp: number;
}

/** Upper bound of the in-memory ring buffer (prevents unbounded growth). */
export const MAX_CSP_VIOLATIONS = 50;

const buffer: CspViolation[] = [];
let listenerAttached = false;

/** Read-only view of the recorded violations (newest first). */
export function getCspViolations(): ReadonlyArray<CspViolation> {
  return buffer;
}

/** Test-only: drop all recorded violations. @knip-ignore */
export function resetCspReportingForTests(): void {
  buffer.length = 0;
}

/** Read every standard field off a violation event, tolerating jsdom gaps. */
function toViolation(event: Event): CspViolation {
  const e = event as Partial<SecurityPolicyViolationEvent>;
  const asNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    blockedURI: asString(e.blockedURI),
    effectiveDirective: asString(e.effectiveDirective),
    violatedDirective: asString(e.violatedDirective),
    originalPolicy: asString(e.originalPolicy),
    disposition: asString(e.disposition) || 'enforce',
    sourceFile: asString(e.sourceFile),
    lineNumber: asNumber(e.lineNumber),
    columnNumber: asNumber(e.columnNumber),
    sample: asString(e.sample),
    statusCode: asNumber(e.statusCode),
    // `timestamp` is not a standard SecurityPolicyViolationEvent field, but we
    // respect it when present so tests can inject deterministic ordering.
    timestamp:
      typeof (e as Partial<{ timestamp: number }>).timestamp === 'number'
        ? ((e as Partial<{ timestamp: number }>).timestamp as number)
        : Date.now(),
  };
}

/** Ship the stored violations to the configured collector, if any. */
function flush(endpoint: string): void {
  if (!endpoint || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return;
  }
  const payload = JSON.stringify({ violations: buffer });
  try {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/reports+json' }));
  } catch {
    // Telemetry must never take down the reader.
  }
}

/**
 * Attach the violation listener once. Safe to call repeatedly (idempotent).
 */
export function initCspReporting(): void {
  if (listenerAttached || typeof window === 'undefined') {
    return;
  }
  listenerAttached = true;
  window.addEventListener('securitypolicyviolation', (event) => {
    buffer.push(toViolation(event));
    if (buffer.length > MAX_CSP_VIOLATIONS) {
      buffer.splice(0, buffer.length - MAX_CSP_VIOLATIONS);
    }
    flush(CONFIG.CSP_REPORT_ENDPOINT);
  });
}
