#!/usr/bin/env node
/**
 * Accessibility audit script using Playwright + axe-core.
 * Runs automated WCAG 2.1 AA checks on the built app.
 *
 * UXS-10: audits more than the first page — the settings panel and the help
 * panel (which auto-opens for first-time users) are opened before axe runs,
 * because most of the app's UI lives in injected panels.
 *
 * axe-core is bundled locally (npm devDependency) and injected via
 * page.evaluate() — this avoids Content Security Policy violations
 * that would occur if we loaded axe from a CDN via addScriptTag.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

// Path to the locally-installed axe-core minified build
const AXE_PATH = resolve(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');

/**
 * UI states to audit. Each state is opened from a fresh page load so panels
 * do not leak state into each other. `open` runs after axe is injected and
 * before the scan; `close` is not needed thanks to the reload.
 */
const STATES = [
  {
    name: 'main',
    open: null,
  },
  {
    name: 'settings-panel',
    open: async (page) => {
      await page.click('#settingsToggleBtn');
      await page.waitForSelector('.settings-panel.open', { timeout: 5000 });
    },
  },
  {
    name: 'help-panel',
    open: async (page) => {
      await page.click('#settingsToggleBtn');
      await page.waitForSelector('.settings-panel.open', { timeout: 5000 });
      await page.click('.settings-tab[data-tab="tools"]');
      await page.waitForSelector('#helpFromSettingsBtn:visible', { timeout: 5000 });
      await page.click('#helpFromSettingsBtn');
      await page.waitForSelector('.help-panel.open', { timeout: 5000 });
    },
  },
];

async function injectAxe(page) {
  // Read axe-core source from local node_modules and inject via evaluate
  // (avoids CSP script-src violation from addScriptTag with external URL)
  const axeSource = readFileSync(AXE_PATH, 'utf-8');
  await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    eval(src);
  }, axeSource);
}

async function runAxe(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      // @ts-expect-error axe is injected dynamically
      window.axe.run(
        document,
        {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
          resultTypes: ['violations', 'incomplete'],
        },
        (err, results) => {
          if (err) throw err;
          resolve(results);
        },
      );
    });
  });
}

async function runAudit() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Bypass the app's strict CSP for the audit by intercepting script loads.
  // This lets us inject axe-core without violating the production CSP.
  await page.route('**/*', (route) => route.continue());

  console.log(`🔍 Running accessibility audit on ${BASE_URL}...`);

  const perState = [];
  for (const state of STATES) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    await injectAxe(page);
    if (state.open) {
      await state.open(page);
    }
    const results = await runAxe(page);
    perState.push({ state: state.name, results });
    console.log(`   ✓ scanned: ${state.name}`);
  }

  // Write full results
  const fs = await import('fs');
  fs.writeFileSync(
    'a11y-results.json',
    JSON.stringify(
      { baseUrl: BASE_URL, scannedAt: new Date().toISOString(), states: perState },
      null,
      2,
    ),
  );

  // Summary
  let totalViolations = 0;
  let totalIncomplete = 0;
  const criticalSerious = [];
  for (const { state, results } of perState) {
    const violations = results.violations || [];
    const incomplete = results.incomplete || [];
    totalViolations += violations.length;
    totalIncomplete += incomplete.length;

    if (violations.length > 0) {
      console.log(`\n❌ Violations in "${state}":`);
      for (const v of violations) {
        console.log(`   • [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} elements)`);
        if (v.impact === 'critical' || v.impact === 'serious') {
          criticalSerious.push({ state, id: v.id });
        }
      }
    }
  }

  console.log('\n📊 Accessibility Audit Results:');
  console.log(`   States scanned: ${perState.length}`);
  console.log(`   Violations: ${totalViolations}`);
  console.log(`   Incomplete: ${totalIncomplete}`);

  if (totalViolations === 0) {
    console.log('\n✅ No WCAG 2.1 AA violations found in any scanned state!');
  }

  if (totalIncomplete > 0) {
    console.log('\n⚠️ Incomplete checks (manual review needed):');
    const first = perState[0]?.results.incomplete || [];
    for (const i of first.slice(0, 5)) {
      console.log(`   • ${i.id}: ${i.description} (${i.nodes.length} elements)`);
    }
    if (totalIncomplete > 5) {
      console.log(`   ... and ${totalIncomplete - 5} more across all states`);
    }
  }

  await browser.close();

  // Exit with error if critical/serious violations found
  if (criticalSerious.length > 0) {
    console.error(`\n🚨 ${criticalSerious.length} critical/serious violations found!`);
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
