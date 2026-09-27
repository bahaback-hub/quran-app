/**
 * Per-File Coverage Gate
 *
 * Total coverage can look healthy while a single module sits untested, so every
 * source file must clear the per-file line threshold on its own.
 *
 * Two exclusions exist, and both are explicit lists on purpose:
 *
 *   BARREL_FILES   re-export shims. `state.ts` has real statements; it is
 *                  listed because it re-exports rather than because it is
 *                  unmeasurable.
 *   DATA_ONLY_FILES pure re-exports of imported JSON, so the v8 instrumenter
 *                  observes no executable statements and reports 0/0. Requiring
 *                  65% of nothing is not a useful gate, but silently exempting
 *                  *every* 0-statement module would let a new module with real
 *                  untested logic hide behind a re-export. So anything reporting
 *                  zero statements and absent from this list FAILS, which turns
 *                  "add another data-only module" into a deliberate, reviewable
 *                  edit — and the contract is then pinned by a real test (see
 *                  src/__tests__/surahs-data-static.test.ts).
 *
 * Run: node scripts/check-per-file-coverage.mjs
 * Env: COVERAGE_SUMMARY (default coverage/coverage-summary.json)
 *      COVERAGE_PER_FILE_THRESHOLD (default 65)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const SUMMARY_PATH = resolve(ROOT, process.env.COVERAGE_SUMMARY || 'coverage/coverage-summary.json');
const THRESHOLD = Number(process.env.COVERAGE_PER_FILE_THRESHOLD || 65);

/** Re-export shims: covered by testing what they re-export, not themselves. */
const BARREL_FILES = ['src/state.ts', 'src/templates/index.ts', 'src/templates-panels.ts'];

/** Data-only re-exports: no executable statements for the instrumenter to see. */
const DATA_ONLY_FILES = ['src/surahs-data.ts'];

/** Normalise a coverage-summary key (absolute path) to a repo-relative src path. */
function toSrcPath(key) {
  const normalized = key.replace(/\\/g, '/');
  const idx = normalized.indexOf('/src/');
  if (idx < 0 || normalized.includes('__tests__')) {
    return null;
  }
  return 'src/' + (normalized.slice(idx + 5) || '');
}

function listOf(list, srcPath) {
  return list.some((entry) => srcPath.endsWith(entry));
}

/**
 * Split a coverage summary into per-file violations.
 *
 * @returns {{low: string[], unlisted: string[], checked: number}}
 */
export function findViolations(summary, threshold = THRESHOLD) {
  const low = [];
  const unlisted = [];
  let checked = 0;

  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total') {
      continue;
    }
    const srcPath = toSrcPath(file);
    if (srcPath === null) {
      continue;
    }
    if (listOf(BARREL_FILES, srcPath) || listOf(DATA_ONLY_FILES, srcPath)) {
      continue;
    }
    checked++;
    if (typeof data.statements?.total === 'number' && data.statements.total === 0) {
      unlisted.push(`  ${srcPath}: 0 executable statements, not on the data-only allowlist`);
      continue;
    }
    const pct = data.lines?.pct;
    if (typeof pct === 'number' && pct < threshold) {
      low.push(`  ${srcPath}: ${pct}% (lines)`);
    }
  }

  return { low, unlisted, checked };
}

let summary;
try {
  summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
} catch (err) {
  console.error(`❌ [PerFileCoverage] Could not read ${SUMMARY_PATH}`);
  console.error(`   ${err.message}`);
  console.error('   Ensure vitest coverage.reporter includes "json-summary".');
  process.exit(1);
}

const result = findViolations(summary);

if (result.unlisted.length > 0) {
  console.error(`\n❌ [PerFileCoverage] ${result.unlisted.length} file(s) report no executable statements:`);
  for (const line of result.unlisted) {
    console.error(line);
  }
  console.error(
    '\nIf a file is a genuine data-only re-export, add it to DATA_ONLY_FILES in\n' +
      'scripts/check-per-file-coverage.mjs and pin its contract with a real test.\n' +
      'If it contains logic, write tests for it.',
  );
  process.exit(1);
}

if (result.low.length > 0) {
  console.error(`\n❌ [PerFileCoverage] ${result.low.length} source file(s) below ${THRESHOLD}% line coverage:`);
  for (const line of result.low) {
    console.error(line);
  }
  console.error('\nWrite real behavioral tests — do not add "coverage-booster" tests.');
  process.exit(1);
}

console.log(`✅ [PerFileCoverage] Passed: ${result.checked} source file(s) at or above ${THRESHOLD}% line coverage.`);
