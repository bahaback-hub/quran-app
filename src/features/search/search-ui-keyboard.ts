/**
 * On-screen Arabic keyboard for the search input.
 *
 * Extracted from `search-ui.ts`; behavior and the exported API are unchanged.
 */
import { dom } from '../../dom.js';
import { isTvNavActive } from '../../tv-nav.js';

let _shiftActive = false;

function toggleKeyboard(): void {
  const kbd = document.getElementById('arabicKeyboard');
  if (!kbd) {
    return;
  }
  kbd.classList.toggle('open');
  dom.kbdToggleBtn?.classList.toggle('active');
  // On TV the remote has no pointer: drop focus onto the first key when the
  // keyboard opens so arrows type immediately without hunting for it.
  if (kbd.classList.contains('open') && isTvNavActive()) {
    const firstKey = kbd.querySelector<HTMLElement>('.kbd-key');
    firstKey?.focus({ preventScroll: true });
    firstKey?.scrollIntoView({ block: 'nearest' });
  }
}

function handleKeyClick(e: MouseEvent): void {
  const key = (e.currentTarget as HTMLElement).dataset['key']!;
  const input = dom.searchInput;
  if (!input) {
    return;
  }
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;

  if (key === 'space') {
    input.value = input.value.slice(0, start) + ' ' + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + 1;
  } else if (key === 'backspace') {
    if (start > 0 && start === end) {
      input.value = input.value.slice(0, start - 1) + input.value.slice(start);
      input.selectionStart = input.selectionEnd = start - 1;
    } else if (start !== end) {
      input.value = input.value.slice(0, start) + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start;
    }
  } else if (key === 'clear') {
    input.value = '';
  } else if (key === 'shift') {
    _shiftActive = !_shiftActive;
    const shiftMap: Record<string, string> = {
      ذ: 'ّ',
      '١': '!',
      '٢': '@',
      '٣': '#',
      '٤': '$',
      '٥': '%',
      '٦': '^',
      '٧': '&',
      '٨': '*',
      '٩': '(',
      '٠': ')',
      '-': '_',
      '=': '+',
    };
    const reverseMap: Record<string, string> = {};
    for (const [k2, v] of Object.entries(shiftMap)) {
      reverseMap[v] = k2;
    }
    document.querySelectorAll('.kbd-key[data-key]').forEach((k) => {
      const el = k as HTMLElement;
      const val = el.dataset['key'];
      if (!val || val === 'space' || val === 'backspace' || val === 'clear' || val === 'shift') {
        return;
      }
      if (_shiftActive) {
        const shifted = shiftMap[val];
        if (shifted) {
          el.textContent = shifted;
          el.dataset['key'] = shifted;
        }
      } else {
        const unshifted = reverseMap[val];
        if (unshifted) {
          el.textContent = unshifted;
          el.dataset['key'] = unshifted;
        }
      }
    });
    return;
  } else {
    input.value = input.value.slice(0, start) + key + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + key.length;
  }
  input.focus();
}

/**
 * Idempotency guard: prevents double-binding of keyboard event listeners
 * if initKeyboard() is called more than once. Without this, calling
 * initKeyboard() twice would attach duplicate click handlers to each
 * .kbd-key button, causing each keypress to insert the character twice.
 */
let _keyboardInitialized = false;

/**
 * Reset the keyboard initialization state.
 * Useful for testing: allows re-binding handlers to new DOM elements
 * in isolated test cases. In production, this should not be called.
 *
 * @internal
 */
export function _resetKeyboardForTests(): void {
  _keyboardInitialized = false;
}

/**
 * Initialize the on-screen Arabic keyboard.
 * Binds toggle button click, individual key presses (letters, space,
 * backspace, clear, shift), and an outside-click dismiss handler.
 * Should be called once during app startup.
 *
 * @example
 * initKeyboard(); // call after cacheDom()
 */
export function initKeyboard(): void {
  if (_keyboardInitialized) {
    return;
  }
  _keyboardInitialized = true;
  // kbdToggleBtn is already cached by cacheDom() — the reassignment below is
  // kept as a defensive fallback in case cacheDom() ran before the element
  // was injected into the DOM (race condition with overlays.ts).
  if (!dom.kbdToggleBtn) {
    dom.kbdToggleBtn = document.getElementById('kbdToggleBtn');
  }
  dom.kbdToggleBtn?.addEventListener('click', toggleKeyboard);
  document.querySelectorAll('.kbd-key').forEach((btn: Element) => {
    (btn as HTMLElement).addEventListener('click', handleKeyClick);
  });
  document.addEventListener('click', (e: MouseEvent) => {
    const kbd = document.getElementById('arabicKeyboard');
    const toggle = dom.kbdToggleBtn;
    if (!kbd || !toggle) {
      return;
    }
    const target = e.target as Node;
    if (!kbd.contains(target) && target !== toggle && !toggle.contains(target)) {
      kbd.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}
