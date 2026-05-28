const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const files = [
  'src/surahs-data.js',
  'src/config.js',
  'src/storage.js',
  'src/dom.js',
  'src/ui.js',
  'src/utils.js',
  'src/translations/ar.js',
  'src/translations/en.js',
  'src/i18n.js',
  'src/adhkar-data.js',
  'src/state.js',
  'src/app.js',
  'src/prayer.js',
  'src/tafsir.js',
  'src/favorites.js',
  'src/share.js',
  'src/settings.js',
  'src/adhkar.js',
  'src/audio.js',
  'src/search.js',
  'src/ayah-click.js',
  'src/ayah-modal.js',
  'src/mushaf.js',
  'src/main.js'
];

let missingFiles = [];
let output = '';
for (const f of files) {
  const fullPath = path.join(ROOT, f);
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(f);
    console.error(`⚠️  ملف مفقود: ${f}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');

  // Remove all import statements (multiline)
  content = content.replace(/^import\s[\s\S]*?from\s['"][^'"]+['"];\s*\n/gm, '');

  // Remove export default and export keywords
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/^export\s+/gm, '');

  output += content + '\n';
}

if (missingFiles.length > 0) {
  console.error(`\n❌ فشل: ${missingFiles.length} ملف(ملفات) مفقودة.`);
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, 'app.bundle.js'), output);
console.log('✅ Wrote app.bundle.js (' + output.length + ' bytes)');
