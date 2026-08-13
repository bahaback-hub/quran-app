#!/usr/bin/env node
/**
 * Extract Lighthouse scores from the latest report and update README.md
 * with a real, verifiable performance table.
 *
 * Usage: node scripts/update-lighthouse-badge.mjs [path/to/lighthouse-scores.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const START_MARKER = '<!-- LIGHTHOUSE-SCORES:START -->';
const END_MARKER = '<!-- LIGHTHOUSE-SCORES:END -->';

const scoresPath = process.argv[2] || path.resolve('lighthouse-scores.json');
const readmePath = path.resolve('README.md');

if (!fs.existsSync(scoresPath)) {
  console.error(`[skip] No scores file found at ${scoresPath}`);
  process.exit(0);
}

const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');

const emoji = (s) => (s >= 90 ? '🟢' : s >= 50 ? '🟠' : '🔴');

const table = [
  START_MARKER,
  '',
  `> آخر قياس / Last measurement: \`${scores.fetchTime}\`  `,
  `> المصدر: GitHub Actions Lighthouse CI (desktop preset, 3 runs)`,
  '',
  '| المحور / Category | النتيجة / Score | الحالة / Status |',
  '|:---:|:---:|:---:|',
  `| ⚡ الأداء / Performance | ${scores.performance}/100 | ${emoji(scores.performance)} |`,
  `| ♿ إتاحة الوصول / Accessibility | ${scores.accessibility}/100 | ${emoji(scores.accessibility)} |`,
  `| ✅ أفضل الممارسات / Best Practices | ${scores.bestPractices}/100 | ${emoji(scores.bestPractices)} |`,
  `| 🔍 SEO | ${scores.seo}/100 | ${emoji(scores.seo)} |`,
  `| 📱 PWA | ${scores.pwa}/100 | ${emoji(scores.pwa)} |`,
  '',
  '### Core Web Vitals',
  '',
  '| المؤشر / Metric | القيمة / Value |',
  '|:---|:---:|',
  `| First Contentful Paint | ${scores.metrics.fcp} |`,
  `| Largest Contentful Paint | ${scores.metrics.lcp} |`,
  `| Total Blocking Time | ${scores.metrics.tbt} |`,
  `| Cumulative Layout Shift | ${scores.metrics.cls} |`,
  `| Speed Index | ${scores.metrics.si} |`,
  `| Time to Interactive | ${scores.metrics.tti} |`,
  '',
  END_MARKER,
].join('\n');

const startIdx = readme.indexOf(START_MARKER);
const endIdx = readme.indexOf(END_MARKER);

let newReadme;
if (startIdx !== -1 && endIdx !== -1) {
  newReadme = readme.slice(0, startIdx) + table + readme.slice(endIdx + END_MARKER.length);
} else {
  const qrIdx = readme.indexOf('تقييم الجودة / Quality Rating');
  if (qrIdx !== -1) {
    const nextSep = readme.indexOf('\n---', qrIdx);
    if (nextSep !== -1) {
      newReadme = readme.slice(0, nextSep + 5) + '\n\n' + table + '\n' + readme.slice(nextSep + 5);
    } else {
      newReadme = readme + '\n\n' + table + '\n';
    }
  } else {
    newReadme = readme + '\n\n' + table + '\n';
  }
}

fs.writeFileSync(readmePath, newReadme);
console.log(`[ok] README.md updated with Lighthouse scores from ${scoresPath}`);
