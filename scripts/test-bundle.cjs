const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('./app.bundle.js', 'utf8');

const mock = {
  window: global,
  document: {
    getElementById: () => null,
    createElement: () => ({ className: '', textContent: '', addEventListener: () => {}, appendChild: () => {}, prepend: () => {}, setAttribute: () => {}, style: {} }),
    createDocumentFragment: () => ({ appendChild: () => {} }),
    querySelectorAll: () => [],
    querySelector: () => null,
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } },
    documentElement: { lang: '', dir: '' }
  },
  navigator: { language: 'en', userLanguage: '', clipboard: { writeText: () => Promise.resolve() } },
  location: { href: '' },
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  console: console,
  confirm: () => false,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
  Audio: function() {},
  Image: function() {},
  CustomEvent: function() {},
  indexedDB: { open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null, result: { transaction: () => ({ objectStore: () => ({ get: () => ({ onsuccess: null, onerror: null }), put: () => {} }) }) } }) },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  dispatchEvent: () => {},
  performance: { now: () => 0 }
};

try {
  vm.runInNewContext(code, mock, { timeout: 5000 });
  console.log('OK - bundle executed without errors');
} catch (e) {
  console.log('ERROR:', e.message);
  console.log('Stack:', e.stack);
}
