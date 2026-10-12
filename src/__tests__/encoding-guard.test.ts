/**
 * Guard: source files must not contain double-encoded text.
 *
 * A bad encoding round-trip once turned three user-visible Arabic labels in
 * src/app.ts into mojibake (and eight em dashes into â€”), which then shipped:
 * the corrupted labels surface in error toasts exactly when the network fails.
 * Nothing caught it because no test looks at the bytes. This test does:
 * it pins the three correct labels and forbids the mojibake sequence
 * repo-wide. The bare character â alone is NOT forbidden — it is legitimate
 * French (e.g. «grâce» in src/translations/fr.ts).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!/node_modules|dist|\.git/.test(p)) sourceFiles(p, out);
    } else if (/\.(ts|js)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('source encoding guard', () => {
  it('keeps the three user-visible Arabic labels intact in src/app.ts', () => {
    const app = readFileSync(resolve(root, 'src/app.ts'), 'utf8');
    // These labels name the failing module in error toasts; a corrupted one
    // renders as mojibake in an Arabic UI at the worst possible moment.
    for (const label of ['نافذة الآية', 'وضع العرض', 'وضع المصحف']) {
      expect(app, `missing label "${label}"`).toContain(`label: '${label}'`);
    }
  });

  it('contains no double-encoded em-dash sequence anywhere under src/', () => {
    // fromCodePoint on purpose: writing the sequence literally would make this
    // very file trip the guard it implements.
    const seq = String.fromCodePoint(0xe2, 0x2014);
    const bad: string[] = [];
    for (const file of sourceFiles(resolve(root, 'src'))) {
      if (readFileSync(file, 'utf8').includes(seq)) bad.push(file);
    }
    expect(bad, `mojibake found in: ${bad.join(', ')}`).toEqual([]);
  });
});
