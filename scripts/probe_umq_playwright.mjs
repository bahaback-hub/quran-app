import { chromium } from 'playwright';

const URL = 'https://www.ummulqura.org.sa/en/prayer-times';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/prayer|salat|adhan|times|api|service|handler/i.test(u)) {
      logs.push(`${r.status()} ${u}`);
    }
  });
  console.log('Navigating...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => console.log('goto err', e.message));
  // wait for app to render
  await page.waitForTimeout(3000);
  const html = await page.content();
  console.log('HTML length:', html.length);
  // look for prayer time values in the DOM
  const hasTable = html.includes('<table');
  console.log('hasTable:', hasTable);
  // capture network requests that returned JSON with prayer data
  const jsonHits = logs.filter((l) => l.includes('200'));
  console.log('--- Prayer/API responses ---');
  console.log(jsonHits.slice(0, 30).join('\n'));
  await browser.close();
})();
