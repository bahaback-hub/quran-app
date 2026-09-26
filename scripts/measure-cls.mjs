import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const watchdog = setTimeout(() => {
  console.error('TIMEOUT: measurement did not complete');
  process.exit(1);
}, 120000);
watchdog.unref();

const PORT = Number(process.env.CLS_PORT) || 4175;
const THRESHOLD = 0.25;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

let serverErr = '';
const server = spawn(
  process.execPath,
  [VITE_BIN, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] }
);
server.stderr.on('data', (d) => {
  serverErr += d.toString();
});
server.on('exit', (code) => {
  if (code) console.error(`preview exited early (code ${code}): ${serverErr}`);
});

await new Promise((resolve, reject) => {
  const timer = setInterval(async () => {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        clearInterval(timer);
        resolve();
      }
    } catch {
      /* not up yet */
    }
  }, 500);
  setTimeout(() => {
    clearInterval(timer);
    reject(new Error(`preview server did not start on :${PORT} - ${serverErr}`));
  }, 60000);
});

const browser = await chromium.launch({ timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 1350, height: 940 } });

await page.addInitScript(() => {
  let value = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        value += entry.value;
        if (entry.sources.length) {
          window.__clsElements = (window.__clsElements || []).concat(
            entry.sources.map((s) => s.node?.className || s.node?.id || 'unknown')
          );
        }
      }
    }
    window.__clsLast = value;
  }).observe({ type: 'layout-shift', buffered: true });
  window.__clsElements = [];
});

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(4000);

const cls = (await page.evaluate(() => window.__clsLast)) || 0;
const elements = (await page.evaluate(() => window.__clsElements)) || [];

console.log(`CLS measured: ${cls.toFixed(4)} (threshold ${THRESHOLD})`);
if (elements.length) {
  console.log(`Shifting elements: ${[...new Set(elements)].join(', ')}`);
}

await browser.close();
server.kill();
clearTimeout(watchdog);

if (cls > THRESHOLD) {
  console.error(`FAIL: CLS ${cls.toFixed(4)} exceeds threshold ${THRESHOLD}`);
  process.exit(1);
}
console.log('PASS: no significant layout shift');
