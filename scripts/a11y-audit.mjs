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

/**
 * Open a UI state with a small retry budget: on a cold, slow CI runner the
 * feature modules load lazily, so the first click can be swallowed silently
 * before its handler is bound. Escape clears any partially-opened overlay
 * before the next attempt.
 */
async function openState(page, state) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await state.open(page);
      return;
    } catch (err) {
      lastError = err;
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  throw lastError;
}

async function injectAxe(page) {
  // Read axe-core source from local node_modules and inject via evaluate
  // (avoids CSP script-src violation from addScriptTag with external URL)
  const axeSource = readFileSync(AXE_PATH, 'utf-8');
  await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    eval(src);
  }, axeSource);
}

/**
 * UXS-side manual-review registry for axe `incomplete` color-contrast nodes.
 * axe marks elements "incomplete" when it cannot MEASURE them — for us that is
 * always one of: (a) text over decorative background images / glass surfaces,
 * (b) lone decorative glyphs, (c) mid-animation panels. Each such node is
 * documented in config/a11y-contrast-review.json (owner decision 2026-11-06)
 * and is FILTERED from the incomplete summary here — while still being
 * printed, so every audit output shows exactly what was exempted.
 */
const REVIEW_PATH = resolve(__dirname, '..', 'config', 'a11y-contrast-review.json');

function loadContrastReview() {
  const raw = JSON.parse(readFileSync(REVIEW_PATH, 'utf-8'));
  return {
    entries: raw.entries || [],
    decisionDate: raw.decisionDate || 'n/a',
  };
}

/** True when a node's last CSS target matches a documented selector. */
function nodeMatchesReview(node, entries) {
  const targets = node.target || [];
  return entries.some((entry) =>
    targets.some(
      (t) => t === entry.selector || t.endsWith(` > ${entry.selector}`) || t.startsWith(`${entry.selector}`),
    ),
  );
}

/** True when the reason is one axe attributes to decorative lone glyphs. */
function isDecorativeGlyphReason(node, entry) {
  return (
    entry.category === 'decorative-glyph' &&
    /non-text characters/.test(node.failureSummary || '') &&
    node.html.includes('aria-hidden')
  );
}

function filterDocumentedContrasts(perState, review) {
  let exempted = 0;
  let withheld = 0;
  const exemptedSelectors = new Set();
  const belowAaSelectors = new Set();
  const keptPerState = perState.map(({ state, results }) => {
    const incomplete = (results.incomplete || []).map((item) => {
      if (item.id !== 'color-contrast') {
        return item;
      }
      const kept = [];
      for (const node of item.nodes || []) {
        const matched = nodeMatchesReview(node, review.entries);
        if (!matched) {
          kept.push(node);
          continue;
        }
        const entry = review.entries.find((e) => (node.target || []).includes(e.selector));
        const withhold = (entry && entry.category) === 'decorative-glyph' && !isDecorativeGlyphReason(node, entry);
        if (withhold) {
          // Documented as glyph, but the reason says otherwise (e.g. real text
          // now lives under that selector) — keep it visible, do not exempt.
          kept.push(node);
          withheld++;
          continue;
        }
        exempted++;
        exemptedSelectors.add(entry?.selector ?? node.target.join(' '));
        if (entry?.belowAA === true) {
          belowAaSelectors.add(entry.selector);
        }
        console.log(`   · exempted (documented ${review.decisionDate}): [${state}] ${node.target.join(' ')}`);
      }
      return { ...item, nodes: kept };
    });
    return { state, results: { ...results, incomplete } };
  });
  console.log(`   · color-contrast review: ${exempted} documented exemption(s), ${withheld} withheld`);
  return { keptPerState, exempted, exemptedSelectors, belowAaSelectors };
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
      await openState(page, state);
    }
    const results = await runAxe(page);
    perState.push({ state: state.name, results });
    console.log(`   ✓ scanned: ${state.name}`);
  }

  // Apply the documented manual-review exemptions (config/a11y-contrast-review.json)
  // to the axe "incomplete" list, keeping raw results intact on disk.
  const review = loadContrastReview();
  const { keptPerState, exemptedSelectors, belowAaSelectors } = filterDocumentedContrasts(perState, review);
  const reportStates = keptPerState;

  // Write full results
  const fs = await import('fs');
  fs.writeFileSync(
    'a11y-results.json',
    JSON.stringify({ baseUrl: BASE_URL, scannedAt: new Date().toISOString(), states: perState }, null, 2),
  );

  // Summary
  let totalViolations = 0;
  let totalIncomplete = 0;
  const criticalSerious = [];
  for (const { state, results } of reportStates) {
    const violations = results.violations || [];
    const incomplete = results.incomplete || [];
    totalViolations += violations.length;
    totalIncomplete += incomplete.filter((i) => i.nodes.length > 0).length;

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
    console.log('\n✅ No WCAG 2.1 AA violations found in any scanned state.');
    // Never present the tracked incompletes as a clean pass: say out loud how
    // many nodes the audit could not measure and how many of those are
    // documented as below the 4.5:1 text threshold.
    if (exemptedSelectors.size > 0) {
      console.log(
        `   Exempted by the documented manual review (${review.decisionDate}): ${exemptedSelectors.size} selector(s) — see config/a11y-contrast-review.json.`,
      );
    }
    if (belowAaSelectors.size > 0) {
      console.log(
        `   Of those, ${belowAaSelectors.size} selector(s) measure below 4.5:1 (${[...belowAaSelectors].join(', ')}) and are accepted by that owner decision.`,
      );
    }
  }

  if (totalIncomplete > 0) {
    console.log('\n⚠️ Incomplete checks (manual review needed):');
    const first = (reportStates[0]?.results.incomplete || []).filter((i) => i.nodes.length > 0);
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
