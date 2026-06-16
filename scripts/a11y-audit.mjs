#!/usr/bin/env node
/**
 * Accessibility audit script using Playwright + axe-core.
 * Runs automated WCAG 2.1 AA checks on the built app.
 *
 * axe-core is bundled locally (npm devDependency) and injected via
 * page.evaluate() — this avoids Content Security Policy violations
 * that would occur if we loaded axe from a CDN via addScriptTag.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

// Path to the locally-installed axe-core minified build
const AXE_PATH = resolve(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');

async function runAudit() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Bypass the app's strict CSP for the audit by intercepting script loads.
  // This lets us inject axe-core without violating the production CSP.
  await page.route('**/*', (route) => route.continue());

  console.log(`🔍 Running accessibility audit on ${BASE_URL}...`);

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.surah-content', { timeout: 15000 });

  // Read axe-core source from local node_modules and inject via evaluate
  // (avoids CSP script-src violation from addScriptTag with external URL)
  const axeSource = readFileSync(AXE_PATH, 'utf-8');
  await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    eval(src);
  }, axeSource);

  // Run axe audit
  const results = await page.evaluate(() => {
    return new Promise((resolve) => {
      // @ts-expect-error axe is injected dynamically
      window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
        resultTypes: ['violations', 'incomplete'],
      }, (err, results) => {
        if (err) throw err;
        resolve(results);
      });
    });
  });

  // Write full results
  const fs = await import('fs');
  fs.writeFileSync('a11y-results.json', JSON.stringify(results, null, 2));

  // Summary
  const violations = results.violations || [];
  const incomplete = results.incomplete || [];

  console.log('\n📊 Accessibility Audit Results:');
  console.log(`   Violations: ${violations.length}`);
  console.log(`   Incomplete: ${incomplete.length}`);

  if (violations.length > 0) {
    console.log('\n❌ Violations found:');
    for (const v of violations) {
      console.log(`   • [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} elements)`);
    }
  } else {
    console.log('\n✅ No WCAG 2.1 AA violations found!');
  }

  if (incomplete.length > 0) {
    console.log('\n⚠️ Incomplete checks (manual review needed):');
    for (const i of incomplete.slice(0, 5)) {
      console.log(`   • ${i.id}: ${i.description} (${i.nodes.length} elements)`);
    }
    if (incomplete.length > 5) {
      console.log(`   ... and ${incomplete.length - 5} more`);
    }
  }

  await browser.close();

  // Exit with error if critical/serious violations found
  const criticalSerious = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  if (criticalSerious.length > 0) {
    console.error(`\n🚨 ${criticalSerious.length} critical/serious violations found!`);
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
