/**
 * Zero Inline Styles Checker
 *
 * Verifies that critical template and HTML files do not contain inline styles
 * or embedded <style> tags, enforcing the Zero Inline Styles architectural standard.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filesToCheck = [
  'index.html',
  'src/templates-panels.ts',
  'src/lang-switcher.ts',
  'src/overlays.ts'
];

let hasErrors = false;

for (const file of filesToCheck) {
  const fullPath = resolve(process.cwd(), file);
  const content = readFileSync(fullPath, 'utf8');

  // Check for <style> tags (not allowed in index.html)
  if (file === 'index.html' && /<style[\s>]/i.test(content)) {
    console.error(`❌ [ZeroStyle] <style> tag found in ${file}. Move styles to external CSS.`);
    hasErrors = true;
  }

  // Check for inline style="..." attributes
  const matches = content.match(/style\s*=\s*["'][^"']*["']/gi);
  if (matches) {
    console.error(`❌ [ZeroStyle] Inline style attribute(s) found in ${file}:`);
    for (const m of matches) {
      console.error(`    ${m}`);
    }
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('✅ [ZeroStyle] Passed: Zero inline styles detected in audited files.');
}
