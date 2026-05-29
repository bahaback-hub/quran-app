import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  
  const dom = new JSDOM(html, {
    url: 'http://localhost/quran-app/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });

  const window = dom.window;
  const document = window.document;

  // Capture console messages
  const errors = [];
  window.addEventListener('error', e => {
    errors.push({ type: 'error', message: e.message, filename: e.filename, lineno: e.lineno });
  });
  const origConsole = window.console;
  window.console.error = (...args) => {
    errors.push({ type: 'console.error', args: args.map(a => String(a)).join(' ') });
    origConsole.error(...args);
  };
  window.console.warn = (...args) => {
    errors.push({ type: 'console.warn', args: args.map(a => String(a)).join(' ') });
    origConsole.warn(...args);
  };

  // Wait for scripts to load and execute
  await new Promise(resolve => setTimeout(resolve, 5000));

  const surahContent = document.getElementById('surahContent');
  const surahSelect = document.getElementById('surahSelect');

  console.log('--- RESULTS ---');
  console.log('Errors found:', errors.length);
  for (const e of errors) {
    console.log(`  [${e.type}] ${e.message || e.args}`);
  }

  console.log('surahContent innerHTML:', surahContent?.innerHTML?.substring(0, 200));
  console.log('surahSelect options:', surahSelect?.options?.length);
  console.log('surahSelect value:', surahSelect?.value);

  if (surahContent && surahContent.innerHTML.includes('اختر سورة')) {
    console.log('❌ Placeholder text still showing - loadSurah did NOT run');
  } else if (surahContent && surahContent.innerHTML.includes('skeleton')) {
    console.log('❌ Skeleton still showing - API call in progress or stuck');
  } else if (surahContent && surahContent.innerHTML.includes('error-msg')) {
    console.log('❌ Error message showing');
  } else if (surahContent && surahContent.innerHTML.includes('surah-title')) {
    console.log('✅ Surah content is rendered!');
  } else {
    console.log('❓ Unknown state:', surahContent?.innerHTML?.substring(0, 500));
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
