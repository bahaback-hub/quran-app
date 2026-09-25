/**
 * Store screenshot capture — renders the real app at phone size and saves the
 * portrait PNGs app stores require (the existing public/screenshots/*.webp are
 * landscape web banners, not store assets).
 *
 * Usage: npm run shots:store
 * Output: store/xiaomi/screenshots/01..07.png (1080x1920)
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const ROOT = process.cwd();
const OUT = join(ROOT, 'store', 'xiaomi', 'screenshots');
const PORT = Number(process.env.STORE_SHOT_PORT) || 4188;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const SCALE = 3; // 360x640 CSS px * 3 = 1080x1920

mkdirSync(OUT, { recursive: true });

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

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not start on ${PORT}: ${serverErr}`);
}

const browser = await chromium.launch();
try {
  await waitForServer();

  const context = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: SCALE,
    locale: 'ar',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  async function shot(name) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`[shot] ${name}.png`);
  }

  async function openApp() {
    await page.goto(`${BASE_URL}#surah=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
      // Injected panels (help/player/settings) can overlay the first screen and
      // swallow clicks; close anything open before driving the UI.
      for (const id of ['helpPanel', 'helpOverlay', 'settingsPanel', 'favoritesPanel']) {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('open', 'visible');
          el.style.display = 'none';
        }
      }
      document.body.classList.remove('modal-open', 'no-scroll');
    });
    await page.waitForSelector('.ayah[data-surah="1"]', { timeout: 30000 });
    await page.waitForTimeout(1500);
  }

  await openApp();
  await shot('01-reading-mode');

  // Ayah detail with tafsir
  await page.locator('.ayah[data-surah="1"]').first().click({ force: true });
  await page.waitForTimeout(1500);
  await shot('02-ayah-tafsir');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // Mushaf page mode
  await page.locator('#viewMushafBtn').evaluate((el) => el.click());
  await page.waitForTimeout(4000);
  await shot('03-mushaf-mode');

  // Presentation mode
  await page.locator('#viewPresBtn').evaluate((el) => el.focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await shot('04-presentation-mode');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // Prayer times
  const prayerToggle = page.locator('#prayerBarToggle, #prayerToggleBtn, [id*="prayer"][id*="toggle" i]').first();
  if (await prayerToggle.count()) {
    await prayerToggle.evaluate((el) => el.click()).catch(() => {});
    await page.waitForTimeout(1800);
    await shot('05-prayer-times');
  }

  // Hifz room
  const hifzToggle = page.locator('#hifzRoomToggle');
  if (await hifzToggle.count()) {
    await hifzToggle.evaluate((el) => el.click()).catch(() => {});
    await page.waitForTimeout(1800);
    await shot('06-hifz-room');
  }

  // Adhkar
  const adhkarToggle = page.locator('#adhkarToggle, [id*="adhkar"][id*="toggle" i]').first();
  if (await adhkarToggle.count()) {
    await adhkarToggle.evaluate((el) => el.click()).catch(() => {});
    await page.waitForTimeout(1500);
    await shot('07-adhkar');
  }

  console.log(`Done → ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
