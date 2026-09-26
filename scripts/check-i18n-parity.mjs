/**
 * i18n Parity Guard
 *
 * The app ships 8 locale bundles (src/translations/*.ts). A key added to the
 * source locale (ar) but forgotten in another locale makes the UI fall back to
 * the raw key (e.g. "mushaf_data_pack") for that language — a silent,
 * user-visible regression that no other check catches.
 *
 * This guard transpiles every locale bundle with the TypeScript compiler API,
 * flattens the key paths, and compares each locale against the source locale.
 * Every known gap must be documented in config/i18n-parity.allowed.json with a
 * reason, otherwise the build fails.
 *
 * Fail conditions:
 *   1. an undocumented missing/extra key in any locale,
 *   2. an allowlist entry that no longer corresponds to a real gap (stale),
 *   3. a locale file that cannot be parsed or has no default export.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const LOCALES_DIR = resolve(ROOT, process.env.I18N_LOCALES_DIR || 'src/translations');
const ALLOWLIST_PATH = resolve(ROOT, 'config/i18n-parity.allowed.json');
const SOURCE_LOCALE = 'ar';

function localeFromFile(name) {
  return name.replace(/\.ts$/, '');
}

function flatten(value, prefix = '', out = new Set()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

async function loadLocale(file) {
  const source = readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText, 'utf8').toString('base64')}`;
  const mod = await import(url);
  const dict = mod.default;
  if (!dict || typeof dict !== 'object') {
    throw new Error(`${file} has no default-exported object`);
  }
  return flatten(dict);
}

function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')).entries || [];
}

const files = readdirSync(LOCALES_DIR)
  .filter((name) => name.endsWith('.ts'))
  .sort();

if (!files.some((name) => localeFromFile(name) === SOURCE_LOCALE)) {
  console.error(`❌ [I18nParity] source locale "${SOURCE_LOCALE}" not found in ${LOCALES_DIR}`);
  process.exit(1);
}

const keySets = new Map();
for (const name of files) {
  const locale = localeFromFile(name);
  try {
    keySets.set(locale, await loadLocale(join(LOCALES_DIR, name)));
  } catch (error) {
    console.error(`❌ [I18nParity] cannot parse ${name}: ${error.message}`);
    process.exit(1);
  }
}

const sourceKeys = keySets.get(SOURCE_LOCALE);
const allowlist = readAllowlist();
const allowed = new Set(allowlist.map((entry) => `${entry.locale}:${entry.key}`));
const realGaps = new Set();
let hasErrors = false;

for (const [locale, keys] of keySets) {
  if (locale === SOURCE_LOCALE) {
    continue;
  }
  const missing = [...sourceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !sourceKeys.has(key));
  for (const key of missing) {
    const id = `${locale}:${key}`;
    realGaps.add(id);
    if (!allowed.has(id)) {
      const entry = allowlist.find((e) => e.locale === locale && e.key === key);
      console.error(
        `❌ [I18nParity] ${locale} is missing key "${key}"${entry ? ' (allowlisted)' : ''} — document it in config/i18n-parity.allowed.json or add the translation`,
      );
      hasErrors = true;
    }
  }
  for (const key of extra) {
    const id = `${locale}:${key}`;
    realGaps.add(id);
    if (!allowed.has(id)) {
      console.error(
        `❌ [I18nParity] ${locale} has extra key "${key}" not present in ${SOURCE_LOCALE} — remove it or document it`,
      );
      hasErrors = true;
    }
  }
}

for (const entry of allowlist) {
  const id = `${entry.locale}:${entry.key}`;
  if (!realGaps.has(id)) {
    console.error(`❌ [I18nParity] Stale allowlist entry ${id} ("${entry.reason}") no longer matches a real key gap`);
    hasErrors = true;
  }
}

const localeCount = keySets.size;
const sourceCount = sourceKeys.size;
if (hasErrors) {
  console.error(
    `\n[I18nParity] ${localeCount} locales checked against ${SOURCE_LOCALE} (${sourceCount} keys) — unresolved gaps.`,
  );
  process.exit(1);
}
console.log(
  `✅ [I18nParity] Passed: ${localeCount} locales share the same key set as ${SOURCE_LOCALE} (${sourceCount} keys${allowlist.length ? `, ${allowlist.length} documented gap(s)` : ''}).`,
);
