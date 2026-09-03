/**
 * Header Language Switcher.
 *
 * Adds a flag button in the header actions row (next to the settings button)
 * that mirrors the language stored in the shared i18n module. Clicking it
 * opens a lightweight dropdown listing all available languages (flag + native
 * name). Selecting a language calls setLang() so the header button, the
 * settings-panel <select> and the app stay in sync through the same state.
 */

import { AVAILABLE_LANGUAGES, getLang, setLang, type LangCode } from './i18n.js';

/** Flag emoji per language code. */
const FLAGS: Record<LangCode, string> = {
  ar: '🇸🇦',
  en: '🇬🇧',
  tr: '🇹🇷',
  ms: '🇲🇾',
  id: '🇮🇩',
  fr: '🇫🇷',
  de: '🇩🇪',
  ru: '🇷🇺',
};

let dropdownOpen = false;

/** Update the flag shown on the header button from the current i18n state. */
function updateButtonState(): void {
  const flag = document.getElementById('langCurrentFlag');
  const current = getLang();
  if (flag) {
    flag.textContent = FLAGS[current] ?? '🌐';
  }
}

/** Mark the active item inside the dropdown. */
function updateDropdownSelection(): void {
  const current = getLang();
  document.querySelectorAll('#langDropdown .lang-option').forEach((btn) => {
    const active = (btn as HTMLElement).dataset['lang'] === current;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

function openDropdown(): void {
  const dropdown = document.getElementById('langDropdown');
  const btn = document.getElementById('langToggleBtn');
  if (!dropdown || !btn) {
    return;
  }
  dropdown.classList.remove('hidden');
  btn.setAttribute('aria-expanded', 'true');
  dropdownOpen = true;
  updateDropdownSelection();
}

function closeDropdown(): void {
  const dropdown = document.getElementById('langDropdown');
  const btn = document.getElementById('langToggleBtn');
  if (!dropdown || !btn) {
    return;
  }
  dropdown.classList.add('hidden');
  btn.setAttribute('aria-expanded', 'false');
  dropdownOpen = false;
}

/** Build the dropdown items from AVAILABLE_LANGUAGES. */
function buildDropdown(): void {
  const dropdown = document.getElementById('langDropdown');
  if (!dropdown || dropdown.childElementCount > 0) {
    return;
  }
  for (const lang of AVAILABLE_LANGUAGES) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'lang-option';
    item.dataset['lang'] = lang.code;
    item.setAttribute('role', 'option');
    item.innerHTML = `<span class="lang-option-flag" aria-hidden="true">${FLAGS[lang.code]}</span><span class="lang-option-name">${lang.nativeName}</span>`;
    item.addEventListener('click', () => {
      closeDropdown();
      if (lang.code !== getLang()) {
        void setLang(lang.code);
      }
    });
    dropdown.appendChild(item);
  }
}

/** Initialize the header language switcher. Safe to call once at app init. */
export function initLangSwitcher(): void {
  const btn = document.getElementById('langToggleBtn');
  const dropdown = document.getElementById('langDropdown');
  if (!btn || !dropdown) {
    return;
  }

  buildDropdown();
  updateButtonState();

  btn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (dropdownOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Close when clicking anywhere outside the switcher
  document.addEventListener('click', (e: MouseEvent) => {
    if (dropdownOpen && !dropdown.contains(e.target as Node) && e.target !== btn) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && dropdownOpen) {
      closeDropdown();
      (btn as HTMLElement).focus();
    }
  });

  // Keep the header button and the settings-panel select in sync with i18n state
  window.addEventListener('app:langchange', () => {
    updateButtonState();
    updateDropdownSelection();
    const settingsSelect = document.getElementById('langSelect') as HTMLSelectElement | null;
    if (settingsSelect) {
      settingsSelect.value = getLang();
    }
  });
}
