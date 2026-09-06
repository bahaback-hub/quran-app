/**
 * Tests for src/templates/escape.ts — XSS-safe HTML and URL escaping helpers.
 */

import { describe, expect, it } from 'vitest';
import { escapeHtml, escapeAttr, escapeUriParam } from '../templates/escape.js';

describe('escapeHtml', () => {
  it('escapes ampersands, angle brackets and both quote styles', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('one > two')).toBe('one &gt; two');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml('it\'s')).toBe('it&#39;s');
  });

  it('escapes every metacharacter in a single pass', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('keeps plain text untouched', () => {
    expect(escapeHtml('بِسْمِ ٱللَّهِ')).toBe('بِسْمِ ٱللَّهِ');
  });

  it('handles empty strings and non-string truthy values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('escapeAttr', () => {
  it('escapes values for HTML attribute contexts', () => {
    expect(escapeAttr('"><img src=x onerror=alert(1)>')).toBe(
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeAttr('plain value')).toBe('plain value');
  });

  it('returns an empty string for null and undefined attributes', () => {
    expect(escapeAttr(null)).toBe('');
    expect(escapeAttr(undefined)).toBe('');
  });
});

describe('escapeUriParam', () => {
  it('percent-encodes a query parameter value', () => {
    expect(escapeUriParam('a b&c=d')).toBe('a%20b%26c%3Dd');
  });

  it('encodes Arabic text for a URL context', () => {
    expect(escapeUriParam('سُورَة')).not.toContain('س');
    expect(decodeURIComponent(escapeUriParam('سُورَة'))).toBe('سُورَة');
  });

  it('keeps unreserved characters like letters, digits and -._~', () => {
    expect(escapeUriParam('alpha_123-4.5~')).toBe('alpha_123-4.5~');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeUriParam(null)).toBe('');
    expect(escapeUriParam(undefined)).toBe('');
  });
});