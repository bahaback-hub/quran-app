/**
 * Zero Inline Styles Checker
 *
 * Enforces the Zero Inline Styles architectural standard that keeps
 * `style-src` free of 'unsafe-inline' in the Content Security Policy:
 *   - no `style="..."` attributes in HTML/templates (use CSS classes or
 *     apply values through the CSSOM, e.g. hydrateProgressFills in ui.ts)
 *   - no runtime-injected style elements via createElement('style'), and no
 *     literal <style> blocks inside template strings (use static
 *     stylesheets linked from styles.css or public/)
 *
 * Programmatic CSSOM writes (el.style.width, style.cssText, setProperty)
 * are NOT flagged: CSP style-src-attr only governs markup parsing, so the
 * CSSOM path stays allowed without 'unsafe-inline'.
 *
 * Scans index.html plus every production .ts file (tests excluded).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const filesToCheck = ['index.html', ...walk(resolve(ROOT, 'src')).map((f) => f.replace(`${ROOT}/`, ''))];

let hasErrors = false;

for (const file of filesToCheck) {
  const fullPath = resolve(ROOT, file);
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    console.error(`❌ [ZeroStyle] Cannot read ${file}.`);
    hasErrors = true;
    continue;
  }

  // Check for <style> tags in index.html
  if (file === 'index.html' && /<style[\s>]/i.test(content)) {
    console.error(`❌ [ZeroStyle] <style> tag found in ${file}. Move styles to external CSS.`);
    hasErrors = true;
  }

  // Check for inline style="..." attributes (in markup or template strings).
  // The negative lookbehind skips canvas APIs (fillStyle/strokeStyle), which
  // are unaffected by CSP style-src.
  const attrMatches = content.match(/(?<![\w$])style\s*=\s*["'][^"']*["']/gi);
  if (attrMatches) {
    console.error(`❌ [ZeroStyle] Inline style attribute(s) found in ${file}:`);
    for (const m of attrMatches.slice(0, 5)) {
      console.error(`    ${m.slice(0, 100)}`);
    }
    hasErrors = true;
  }

  // Check for runtime-injected <style> elements
  if (/createElement\(\s*['"]style['"]\)/.test(content)) {
    console.error(
      `❌ [ZeroStyle] Runtime <style> injection (createElement('style')) found in ${file}. Use a static stylesheet.`,
    );
    hasErrors = true;
  }

  // Check for literal <style> blocks inside TS template strings (they would
  // inject a style element through innerHTML just the same)
  if (file !== 'index.html' && /<style[\s>]/.test(content)) {
    console.error(`❌ [ZeroStyle] Literal <style> block found in ${file}. Use a static stylesheet.`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`✅ [ZeroStyle] Passed: Zero inline styles detected in ${filesToCheck.length} audited files.`);
}
