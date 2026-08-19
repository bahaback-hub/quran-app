#!/usr/bin/env node
/**
 * Performance Budget Checker.
 *
 * Reads the production build's asset sizes from `dist/` and compares them
 * against the budgets defined in `performance-budget.json`. Fails (exit 1)
 * if any budget is exceeded.
 *
 * Usage: node scripts/check-performance-budget.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BUDGET_PATH = path.join(ROOT, 'performance-budget.json');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

if (!fs.existsSync(DIST)) {
  console.error(`${RED}[budget] dist/ not found — run \`npm run build\` first${RESET}`);
  process.exit(1);
}

if (!fs.existsSync(BUDGET_PATH)) {
  console.error(`${RED}[budget] performance-budget.json not found${RESET}`);
  process.exit(1);
}

const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
const resourceBudgets = budget.budgets?.[0]?.resourceSizes ?? [];

const TYPE_EXTENSIONS = {
  script: ['.js', '.mjs'],
  stylesheet: ['.css'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif'],
  font: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
  media: ['.mp3', '.mp4', '.webm', '.ogg', '.opus', '.wav'],
  document: ['.html'],
  other: ['.json', '.map', '.txt'],
};

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function getResourceType(filePath) {
  if (filePath.split(path.sep).includes('data')) return 'data';
  const ext = path.extname(filePath).toLowerCase();
  for (const [type, exts] of Object.entries(TYPE_EXTENSIONS)) {
    if (exts.includes(ext)) return type;
  }
  return 'other';
}

function getSizeSync(filePath) {
  const content = fs.readFileSync(filePath);
  return { raw: content.length, gzip: gzipSync(content).length };
}

const sizesByType = {};
const fileCountByType = {};
const allFiles = [];

for (const filePath of walk(DIST)) {
  const type = getResourceType(filePath);
  const { raw, gzip } = getSizeSync(filePath);
  sizesByType[type] = (sizesByType[type] || 0) + gzip;
  fileCountByType[type] = (fileCountByType[type] || 0) + 1;
  allFiles.push({ path: path.relative(DIST, filePath), type, gzipSize: gzip });
}

sizesByType.total = Object.values(sizesByType).reduce((a, b) => a + b, 0);
fileCountByType.total = Object.values(fileCountByType).reduce((a, b) => a + b, 0);

console.log(`\n${BOLD}${CYAN}📊 Performance Budget Report${RESET}\n`);
console.log(`${'Type'.padEnd(14)} ${'Used (KB)'.padStart(12)} ${'Budget (KB)'.padStart(14)} ${'Status'.padStart(10)}`);
console.log('─'.repeat(54));

let allPassed = true;
const KB = 1024;

for (const { resourceType, budget: budgetKB } of resourceBudgets) {
  const usedBytes = sizesByType[resourceType] || 0;
  const budgetBytes = budgetKB * KB;
  const usedKB = (usedBytes / KB).toFixed(1);
  const status = usedBytes <= budgetBytes ? `${GREEN}✓ pass${RESET}` : `${RED}✗ FAIL${RESET}`;
  if (usedBytes > budgetBytes) allPassed = false;
  console.log(`${resourceType.padEnd(14)} ${usedKB.padStart(10)}KB ${String(budgetKB).padStart(12)}KB ${status}`);
}

console.log('─'.repeat(54));

console.log(`\n${BOLD}${CYAN}📦 Top 10 Largest Files (gzip)${RESET}\n`);
const sorted = [...allFiles].sort((a, b) => b.gzipSize - a.gzipSize).slice(0, 10);
for (const f of sorted) {
  const kb = (f.gzipSize / KB).toFixed(1);
  console.log(`  ${kb.padStart(8)}KB  ${f.path}`);
}

console.log(`\n${BOLD}${CYAN}📈 Resource Counts${RESET}\n`);
const countBudgets = budget.budgets?.[0]?.resourceCounts ?? [];
for (const { resourceType, budget: countBudget } of countBudgets) {
  const used = fileCountByType[resourceType] || 0;
  const status = used <= countBudget ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  if (used > countBudget) allPassed = false;
  console.log(`  ${resourceType.padEnd(14)} ${String(used).padStart(4)} / ${countBudget}  ${status}`);
}

console.log();
if (allPassed) {
  console.log(`${GREEN}${BOLD}✓ All performance budgets passed${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}✗ Some performance budgets exceeded — see above${RESET}\n`);
  process.exit(1);
}
