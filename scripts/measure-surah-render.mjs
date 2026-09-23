import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const watchdog = setTimeout(() => {
  console.error('TIMEOUT: measurement did not complete');
  process.exit(1);
}, 180000);
watchdog.unref();

const PORT = Number(process.env.SURAH_PORT) || 4176;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

let serverErr = '';
const server = spawn(
  process.execPath,
  [VITE_BIN, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
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
const runs = Number(process.env.RUNS) || 3;
const results = [];

for (let i = 0; i < runs; i++) {
  const page = await browser.newPage({ viewport: { width: 1350, height: 940 } });

  await page.addInitScript(() => {
    window.__lcp = 0;
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          window.__lcp = entry.startTime;
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks.push({ start: entry.startTime, dur: entry.duration });
      }
    }).observe({ type: 'longtask' });
    window.__renderMs = 0;
    window.__ayahCount = 0;
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === 1 && added.classList && added.classList.contains('ayahs-container')) {
            const t0 = performance.now();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                window.__renderMs = performance.now() - t0;
                window.__ayahCount = added.querySelectorAll('.ayah').length;
              });
            });
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  const navStart = performance.now();
  await page.goto(`${BASE_URL}#surah=2`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page
    .waitForFunction(() => document.querySelectorAll('.ayahs-container .ayah').length >= 286, undefined, {
      timeout: 20000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);

  const data = await page.evaluate(() => ({
    lcp: Math.round(window.__lcp),
    renderMs: Math.round(window.__renderMs),
    ayahCount: window.__ayahCount,
    longTasks: window.__longTasks.map((t) => Math.round(t.dur)),
  }));

  results.push({
    run: i + 1,
    wallToReady: Math.round(performance.now() - navStart),
    lcpMs: data.lcp,
    renderMs: data.renderMs,
    longTasks: data.longTasks,
  });
  console.log(
    `run ${i + 1}: nav->ready ${results[i].wallToReady}ms | LCP ${results[i].lcpMs}ms | renderStep ${results[i].renderMs}ms (ayahs ${data.ayahCount}) | longtasks ${results[i].longTasks.length ? results[i].longTasks.join('+') + 'ms' : 'none'}`,
  );
  await page.close();
}

await browser.close();
server.kill();
clearTimeout(watchdog);

const med = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const lcpMed = med(results.map((r) => r.lcpMs));
const renderMed = med(results.map((r) => r.renderMs));
console.log(`\nmedian: LCP ${lcpMed}ms | renderStep ${renderMed}ms`);

// 60fps budget: a render step above ~250ms on a desktop-class headless box
// would justify optimization work; below that the single-shot render is fine.
if (renderMed > 250) {
  console.error(`FAIL: renderStep median ${renderMed}ms exceeds 250ms budget`);
  process.exit(1);
}
console.log('PASS: single-shot render stays within budget');
