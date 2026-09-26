/**
 * Source File Size Budget
 *
 * Six source files in this project are large (40-50 KB) and were deliberately
 * left unsplit because their internals are tightly coupled. Without a budget,
 * they keep growing and new giants appear unnoticed.
 *
 * This guard fails the build when any non-test source file exceeds the budget
 * (default 50 KB, override with FILE_SIZE_BUDGET_KB). It also prints the ten
 * largest files so the ratchet-down path stays visible: as the giants get
 * split, lower FILE_SIZE_BUDGET_KB in CI to lock the win in.
 *
 * Excluded: test files, *.d.ts, generated data (src/data/**), translation
 * bundles are NOT excluded on purpose — they must fit the budget too.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = resolve(ROOT, process.env.FILE_SIZE_SCAN_DIR || 'src');
const BUDGET_KB = Number(process.env.FILE_SIZE_BUDGET_KB || 50);
const BUDGET_BYTES = BUDGET_KB * 1024;
const TOP_N = 10;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (st.isFile() && name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC_DIR)
  .filter((f) => !f.split(sep).includes('__tests__'))
  .map((f) => ({ file: f.slice(ROOT.length + 1).replace(/\\/g, '/'), bytes: statSync(f).size }))
  .sort((a, b) => b.bytes - a.bytes);

const over = files.filter((f) => f.bytes > BUDGET_BYTES);

const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(6);
console.log(`[FileSize] ${files.length} non-test source files scanned, budget ${BUDGET_KB} KB each.`);
console.log('[FileSize] largest files:');
for (const f of files.slice(0, TOP_N)) {
  console.log(`  ${kb(f.bytes)} KB  ${f.file}`);
}

if (over.length > 0) {
  console.error(`\n❌ [FileSize] ${over.length} file(s) exceed the ${BUDGET_KB} KB budget:`);
  for (const f of over) {
    console.error(`   ${kb(f.bytes)} KB  ${f.file}`);
  }
  console.error(
    '\nSplit the module (one extraction per commit, full test suite green) or document why it must stay large.',
  );
  process.exit(1);
}

console.log(`✅ [FileSize] Passed: every non-test source file is within the ${BUDGET_KB} KB budget.`);
