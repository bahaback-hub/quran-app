const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('./app.bundle.js', 'utf8');

let setTimeoutCalls = [];
let setIntervalCalls = [];

const noop = () => {};
const mockWindow = {
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  setTimeout: (fn, ms) => { setTimeoutCalls.push(fn); return setTimeoutCalls.length; },
  setInterval: (fn, ms) => { setIntervalCalls.push(fn); return setIntervalCalls.length; },
  clearTimeout: noop,
  clearInterval: noop,
};

const mock = {
  window: mockWindow,
  self: mockWindow,
  globalThis: mockWindow,
  document: {
    getElementById: () => null,
    createElement: () => ({
      className: '', textContent: '', addEventListener: () => {},
      appendChild: () => {}, prepend: () => {}, setAttribute: () => {},
      style: {}, classList: { add: () => {}, remove: () => {}, contains: () => false },
      replaceChildren: () => {}, remove: () => {}, focus: () => {}, select: () => {},
    }),
    createDocumentFragment: () => ({ appendChild: () => {} }),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    head: { appendChild: () => {} },
    body: {
      appendChild: () => {}, prepend: () => {}, removeChild: () => {}, style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    },
    documentElement: { lang: '', dir: '' },
    createTextNode: () => ({}),
  },
  navigator: {
    language: 'ar',
    userLanguage: '',
    clipboard: { writeText: () => Promise.resolve() },
    serviceWorker: { register: () => Promise.resolve() },
  },
  location: { href: '' },
  console: { log: () => {}, warn: () => {}, error: () => {} },
  confirm: () => false,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
  Audio: function() {},
  Image: function() {},
  CustomEvent: function() {},
  indexedDB: {
    open: () => ({
      onupgradeneeded: null, onsuccess: null, onerror: null,
      result: {
        transaction: () => ({
          objectStore: () => ({
            get: () => ({ onsuccess: null, onerror: null }),
            put: () => {},
          }),
        }),
        objectStoreNames: { contains: () => false },
      },
    }),
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  dispatchEvent: () => {},
  setTimeout: (fn, ms) => { setTimeoutCalls.push(fn); return setTimeoutCalls.length; },
  setInterval: (fn, ms) => { setIntervalCalls.push(fn); return setIntervalCalls.length; },
  clearTimeout: () => {},
  clearInterval: () => {},
  performance: { now: () => 0 },
};

try {
  vm.runInNewContext(code, mock, { timeout: 5000 });
  console.log('OK - bundle initialized without errors');
  console.log('setTimeout calls:', setTimeoutCalls.length);
  console.log('setInterval calls:', setIntervalCalls.length);
} catch (e) {
  console.log('ERROR:', e.message);
}
