const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const files = [
  'src/config.js',
  'src/storage.js',
  'src/dom.js',
  'src/ui.js',
  'src/utils.js',
  'src/translations/ar.js',
  'src/translations/en.js',
  'src/i18n.js',
  'src/adhkar-data.js',
  'src/app.js',
  'src/main.js'
];

let output = '';
for (const f of files) {
  let content = fs.readFileSync(path.join(ROOT, f), 'utf8');

  // Remove all import statements (multiline)
  content = content.replace(/^import\s[\s\S]*?from\s['"][^'"]+['"];\s*\n/gm, '');

  // Remove export default and export keywords
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/^export\s+/gm, '');

  output += content + '\n';
}

fs.writeFileSync(path.join(ROOT, 'app.bundle.js'), output);
console.log('Wrote app.bundle.js (' + output.length + ' bytes)');
