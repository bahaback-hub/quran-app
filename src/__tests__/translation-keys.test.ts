/**
 * Guard: every translation key referenced in the UI must exist in the source
 * locale bundle.
 *
 * A missing key is not a crash — `__()` returns the key itself — so it renders
 * as raw English snake_case in the Arabic UI. The i18n parity guard only
 * compares locales against each other, so it cannot catch a key that is missing
 * from ALL of them. This test closes that gap.
 *
 * Two reference styles are checked, because they fail the same way:
 *   - `__('key')` / `__n('key')` call sites in TypeScript
 *   - `data-i18n`, `data-i18n-aria-label`, `data-i18n-title` and
 *     `data-i18n-placeholder` attributes in the HTML and template strings
 *
 * The attribute form was the blind spot: `mushaf_juz` shipped as a raw key
 * through `__()`, then `azan_enable`, `azan_fajr` and `tafsir_no_ayah` shipped
 * the same way through `data-i18n` because only call sites were being scanned.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'translations' || name === 'data') continue;
      collectFiles(full, out);
    } else if (name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const arSource = readFileSync(join(SRC, 'translations', 'ar.ts'), 'utf8');
const definedKeys = new Set([...arSource.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]));

// Static __('key') / __n('key') call sites only — dynamic keys cannot be checked
// statically and are covered by the parity guard instead.
const usedKeys = new Map<string, string>();
for (const file of collectFiles(SRC)) {
  const source = readFileSync(file, 'utf8');
  const rel = file.slice(process.cwd().length + 1).replace(/\\/g, '/');
  for (const m of source.matchAll(/\b__n?\(\s*'([A-Za-z0-9_]+)'/g)) {
    if (!usedKeys.has(m[1] as string)) usedKeys.set(m[1] as string, rel);
  }
}

// Declarative references: data-i18n / data-i18n-aria-label / data-i18n-title /
// data-i18n-placeholder. These live in index.html and inside the template
// strings under src/templates, and are applied by applyTranslations() rather
// than by __(), so a call-site scan cannot see them.
const declarativeKeys = new Map<string, string>();
for (const file of [...collectFiles(SRC), join(process.cwd(), 'index.html')]) {
  const source = readFileSync(file, 'utf8');
  const rel = file.slice(process.cwd().length + 1).replace(/\\/g, '/');
  for (const m of source.matchAll(/data-i18n(?:-[a-z]+)?="([A-Za-z0-9_]+)"/g)) {
    const key = m[1] as string;
    if (!declarativeKeys.has(key)) declarativeKeys.set(key, rel);
  }
}

const allUsed = new Map<string, string>([...usedKeys, ...declarativeKeys]);

describe('translation keys used in the UI', () => {
  it('parses a non-trivial number of static keys', () => {
    expect(usedKeys.size).toBeGreaterThan(100);
  });

  it('parses a non-trivial number of declarative data-i18n keys', () => {
    // If this drops, the attribute scan broke and the guard is silently blind
    // to the whole template layer again.
    expect(declarativeKeys.size).toBeGreaterThan(50);
  });

  it('has a definition in the Arabic bundle for every statically used key', () => {
    const missing = [...allUsed.entries()]
      .filter(([key]) => !definedKeys.has(key))
      .map(([key, file]) => `  ${key}  (used in ${file})`);
    expect(missing, `Missing Arabic translations:\n${missing.join('\n')}`).toEqual([]);
  });
});
