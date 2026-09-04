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

/**
 * Country whose flag represents each language. Real SVG flags are served from
 * /flags/{code}.svg (bundled in public/flags) because Windows browsers do not
 * render country-flag emoji.
 */
const COUNTRY_CODES: Record<LangCode, string> = {
  ar: 'sa',
  en: 'gb',
  tr: 'tr',
  ms: 'my',
  id: 'id',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
};

/** Emoji fallback shown only if the SVG flag image fails to load. */
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

/** Build flag markup: SVG image with emoji fallback on load error. */
function flagMarkup(lang: LangCode): string {
  const src = `flags/${COUNTRY_CODES[lang]}.svg`;
  const emoji = FLAGS[lang] ?? '🌐';
  return `<img class="lang-flag-img" src="${src}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="lang-flag-emoji" style="display:none">${emoji}</span>`;
}

let dropdownOpen = false;

/** Update the flag shown on the header button from the current i18n state. */
function updateButtonState(): void {
  const flag = document.getElementById('langCurrentFlag');
  const current = getLang();
  if (flag) {
    flag.innerHTML = flagMarkup(current);
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
  // Position the dropdown fixed against the viewport, clamped so it never
  // overflows the screen (the absolute right:0 anchor clips it near edges).
  const rect = btn.getBoundingClientRect();
  const width = dropdown.offsetWidth;
  const margin = 8;
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  dropdown.style.left = `${Math.round(left)}px`;
  dropdown.style.right = 'auto';
  dropdown.style.top = `${Math.round(rect.bottom + 8)}px`;
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
    item.innerHTML = `<span class="lang-option-flag" aria-hidden="true">${flagMarkup(lang.code)}</span><span class="lang-option-name">${lang.nativeName}</span>`;
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

  // Fixed-position dropdown does not follow the button — close on scroll/resize
  window.addEventListener('scroll', closeDropdown, { passive: true });
  window.addEventListener('resize', closeDropdown);

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
