/**
 * Home Launcher Module.
 *
 * Renders a first-visit launcher inside the reader surface when the visitor
 * has no saved reading position (genuinely new reader). It offers quick access
 * to the main tools and a 114-surah grid. Loading any surah (or clicking a
 * quick action) replaces the launcher — `renderSurah` overwrites the content
 * of `#surahContent`, so no explicit teardown is needed.
 */

import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { loadSurah } from './surah-loader.js';
import { toArabicNumeral, escapeHtml } from './utils.js';
import type { SurahInfo } from './state.js';

/** DOM id of the launcher root element. */
const HOME_ID = 'homeScreen';

/** Whether the launcher is currently rendered. */
export function isHomeVisible(): boolean {
  return document.getElementById(HOME_ID) !== null;
}

/**
 * Render the home launcher into `#surahContent`.
 * No-op if the launcher is already visible or the reader surface is missing.
 * Callers decide when to show it (first visit, no deep link, no resume).
 */
export function showHome(): void {
  if (!dom.surahContent || isHomeVisible()) {
    return;
  }

  const grid = state.surahList.length > 0 ? renderSurahGrid(state.surahList) : renderEmptyGrid();

  dom.surahContent.innerHTML = `
    <section class="home-screen" id="${HOME_ID}" role="region" aria-label="${escapeHtml(__('home_welcome'))}">
      <div class="home-hero">
        <div class="home-bismillah" aria-hidden="true">بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <p class="home-welcome" data-i18n="home_welcome">${escapeHtml(__('home_welcome'))}</p>
      </div>
      <div class="home-primary-actions" role="group" aria-label="${escapeHtml(__('home_quick'))}">
        <button type="button" class="home-action-btn home-primary" data-action="read" data-i18n="home_read"><span class="home-action-icon" aria-hidden="true">📖</span><span data-i18n="home_read">${escapeHtml(__('home_read'))}</span></button>
        <button type="button" class="home-action-btn home-primary" data-action="mushaf" data-i18n="reading_mode_mushaf"><span class="home-action-icon" aria-hidden="true">📗</span><span data-i18n="reading_mode_mushaf">${escapeHtml(__('reading_mode_mushaf'))}</span></button>
        <button type="button" class="home-action-btn home-primary" data-action="listen" data-i18n="home_listen"><span class="home-action-icon" aria-hidden="true">🎧</span><span data-i18n="home_listen">${escapeHtml(__('home_listen'))}</span></button>
        <button type="button" class="home-action-btn home-primary" data-action="search" data-i18n="search"><span class="home-action-icon" aria-hidden="true">🔍</span><span data-i18n="search">${escapeHtml(__('search'))}</span></button>
      </div>
      <div class="home-more">
        <button type="button" class="home-action-btn home-more-toggle" id="homeMoreToggle" data-action="more" aria-expanded="false" aria-controls="homeMoreActions" data-i18n="home_more"><span class="home-action-icon" aria-hidden="true">⋯</span><span data-i18n="home_more">${escapeHtml(__('home_more'))}</span></button>
        <div class="home-more-actions" id="homeMoreActions" role="group" aria-label="${escapeHtml(__('home_more'))}" hidden>
          <button type="button" class="home-action-btn" data-action="adhkar" data-i18n="adhkar"><span class="home-action-icon" aria-hidden="true">📿</span><span data-i18n="adhkar">${escapeHtml(__('adhkar'))}</span></button>
          <button type="button" class="home-action-btn" data-action="prayer" data-i18n="prayer_times"><span class="home-action-icon" aria-hidden="true">🕌</span><span data-i18n="prayer_times">${escapeHtml(__('prayer_times'))}</span></button>
          <button type="button" class="home-action-btn" data-action="qibla" data-i18n="qibla"><span class="home-action-icon" aria-hidden="true">🧭</span><span data-i18n="qibla">${escapeHtml(__('qibla'))}</span></button>
          <button type="button" class="home-action-btn" data-action="favorites" data-i18n="favorites"><span class="home-action-icon" aria-hidden="true">❤️</span><span data-i18n="favorites">${escapeHtml(__('favorites'))}</span></button>
          <button type="button" class="home-action-btn" data-action="settings" data-i18n="settings"><span class="home-action-icon" aria-hidden="true">⚙️</span><span data-i18n="settings">${escapeHtml(__('settings'))}</span></button>
        </div>
      </div>
      <h2 class="home-browse-title" data-i18n="home_browse">${escapeHtml(__('home_browse'))}</h2>
      <ul class="home-surah-grid">${grid}</ul>
    </section>`;

  dom.surahContent.querySelectorAll<HTMLElement>('.home-surah-card').forEach((card) => {
    card.addEventListener('click', () => {
      const number = parseInt(card.dataset['surah'] || '0', 10);
      if (number > 0 && number <= 114) {
        void loadSurah(number);
      }
    });
  });

  dom.surahContent.querySelectorAll<HTMLElement>('.home-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleQuickAction(btn.dataset['action']));
  });
}

/** Build the 114-surah grid markup from the loaded surah list. */
function renderSurahGrid(surahs: SurahInfo[]): string {
  return surahs
    .map(
      (s: SurahInfo) => `<li>
        <button type="button" class="home-surah-card" data-surah="${s.number}" aria-label="${escapeHtml(`${toArabicNumeral(s.number)} ${s.name}`)}">
          <span class="home-surah-num" aria-hidden="true">${toArabicNumeral(s.number)}</span>
          <span class="home-surah-name">${escapeHtml(s.name)}</span>
          <span class="home-surah-meta">${toArabicNumeral(s.numberOfAyahs)} ${escapeHtml(__('home_ayahs'))}</span>
        </button>
      </li>`,
    )
    .join('');
}

/** Fallback when the surah list is unavailable (e.g. storage cleared offline). */
function renderEmptyGrid(): string {
  return `<li class="home-surah-empty" data-i18n="select_hint">${escapeHtml(__('select_hint'))}</li>`;
}

/** Map the launcher quick buttons onto the existing controls. */
function handleQuickAction(action: string | undefined): void {
  switch (action) {
    case 'read':
      void loadSurah(1);
      break;
    case 'listen':
      void loadSurah(state.surahList[0]?.number ?? 1, { autoPlay: true });
      break;
    case 'mushaf':
      dom.viewMushafBtn?.click();
      break;
    case 'search':
      dom.searchToggleBtn?.click();
      window.setTimeout(() => dom.searchInput?.focus(), 60);
      break;
    case 'prayer':
      dom.expandBarBtn?.click();
      break;
    case 'adhkar':
      dom.adhkarBtn?.click();
      break;
    case 'qibla':
      dom.qiblaBtn?.click();
      break;
    case 'favorites':
      dom.favoritesOpenBtn?.click();
      break;
    case 'settings':
      dom.settingsToggleBtn?.click();
      break;
    case 'more': {
      const toggle = document.getElementById('homeMoreToggle');
      const actions = document.getElementById('homeMoreActions');
      if (actions && toggle) {
        const willShow = actions.hidden;
        actions.hidden = !willShow;
        toggle.setAttribute('aria-expanded', String(willShow));
      }
      break;
    }
    default:
      break;
  }
}
