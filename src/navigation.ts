/**
 * @module navigation
 * @description Navigation controller for the Quran app. Initializes all navigation
 * event listeners including surah navigation buttons, player controls, view mode
 * toggles (surah/mushaf/presentation), page selectors, and the bottom navigation
 * tab bar. Also restores persisted mushaf mode on startup.
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import {
  prevAyah,
  nextAyah,
  prevSurah,
  nextSurah,
  toggleHifdh,
  toggleRepeat,
  expandPlayer,
  collapsePlayer,
  togglePlayPause,
  updatePlayPauseBtn,
} from './audio.js';
import { toggleAdhkarPanel } from './adhkar.js';

/**
 * Initialize all navigation event listeners for the app.
 * Binds surah navigation, player controls, view mode toggles, page selectors,
 * and bottom navigation tab handling. Should be called once during app startup.
 *
 * @example
 * initNavigation(); // call after cacheDom()
 */
export function initNavigation(): void {
  /* ========== SURAH NAV BUTTONS ========== */
  dom.prevAyahBtn?.addEventListener('click', prevAyah);
  dom.nextAyahBtn?.addEventListener('click', () => nextAyah(false));
  dom.prevSurahBtn?.addEventListener('click', prevSurah);
  dom.nextSurahBtn?.addEventListener('click', nextSurah);
  dom.hifdhBtn?.addEventListener('click', toggleHifdh);
  dom.repeatBtn?.addEventListener('click', toggleRepeat);

  /* ========== PLAYER CONTROLS ========== */
  dom.collapsePlayerBtn?.addEventListener('click', () => {
    collapsePlayer();
  });
  dom.collapsedContent?.addEventListener('click', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('#collapsedPlayBtn')) {
      return;
    }
    expandPlayer();
  });
  dom.playPauseBtn?.addEventListener('click', () => {
    togglePlayPause();
    updatePlayPauseBtn();
  });
  dom.collapsedPlayBtn?.addEventListener('click', () => {
    togglePlayPause();
    updatePlayPauseBtn();
  });

  // Collapsed-mode quick navigation: these act without expanding the player.
  bindCollapsedNav('collapsedPrevSurahBtn', () => prevSurah());
  bindCollapsedNav('collapsedPrevAyahBtn', () => prevAyah());
  bindCollapsedNav('collapsedNextAyahBtn', () => nextAyah(false));
  bindCollapsedNav('collapsedNextSurahBtn', () => nextSurah());

  dom.playerMoreBtn?.addEventListener('click', () => {
    if (dom.playerMoreRow) {
      const isHidden = dom.playerMoreRow.classList.toggle('hidden');
      dom.playerMoreBtn?.setAttribute('aria-expanded', String(!isHidden));
    }
  });

  dom.speedSelect?.addEventListener('change', () => {
    const rate = parseFloat(dom.speedSelect!.value);
    if (dom.audioPlayer) {
      dom.audioPlayer.playbackRate = rate;
    }
    storage.set('playback_speed', rate);
  });

  /* ========== VIEW MODE TOGGLES ========== */
  dom.viewSurahBtn?.addEventListener('click', () => {
    import('./presentation.js')
      .then((m) => m.closePresentation())
      .catch(() => {
        /* noop */
      });
    if (state.mushafMode) {
      import('./mushaf.js').then((m) => m.toggleMushafMode());
    }
    document.querySelectorAll('.view-mode-btn').forEach((b) => {
      const active = (b as HTMLElement).dataset['mode'] === 'surah';
      b.classList.toggle('active', active);
      if (typeof (b as HTMLElement).setAttribute === 'function') {
        b.setAttribute('aria-pressed', String(active));
      }
    });
    if (dom.pageSelect) {
      dom.pageSelect.style.display = 'none';
    }
    if (dom.pageSlider) {
      dom.pageSlider.style.display = 'none';
    }
    if (dom.pageIndicator) {
      dom.pageIndicator.style.display = 'none';
    }
  });
  dom.viewMushafBtn?.addEventListener('click', () => {
    import('./presentation.js')
      .then((m) => m.closePresentation())
      .catch(() => {
        /* noop */
      });
    import('./mushaf.js').then((m) => m.toggleMushafMode());
  });
  dom.viewPresBtn?.addEventListener('click', () => {
    // openPresentation() handles mushaf mode toggle internally — don't toggle here
    // to avoid double-toggle race condition
    import('./presentation.js')
      .then((m) => m.openPresentation())
      .catch((err) => {
        console.error('[Nav] Failed to open presentation:', err);
      });
  });

  dom.pageSelect?.addEventListener('change', () => {
    if (dom.pageSelect!.value) {
      const p = parseInt(dom.pageSelect!.value, 10);
      if (dom.pageSlider) {
        dom.pageSlider.value = String(p);
      }
      import('./mushaf.js').then((m) => m.loadPage(p, true));
    }
  });
  dom.pageSlider?.addEventListener('input', () => {
    const p = parseInt(dom.pageSlider!.value, 10);
    if (dom.pageSelect) {
      dom.pageSelect.value = String(p);
    }
    import('./mushaf.js').then((m) => m.loadPage(p, true));
  });

  /* ========== BOTTOM NAV (جوال/تابلت) ========== */
  const bottomNav = document.getElementById('bottomNav');
  let activeTab: string = 'quran';

  function activateTab(tab: string): void {
    if (!bottomNav) {
      return;
    }
    activeTab = tab;
    bottomNav.querySelectorAll('.bottom-nav-btn').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    });
  }

  bottomNav?.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('.bottom-nav-btn') as HTMLElement | null;
    if (!btn) {
      return;
    }
    const tab = btn.dataset['tab'];
    if (!tab) {
      return;
    }
    if (tab === activeTab && tab !== 'player' && tab !== 'controls') {
      activateTab(tab);
      return;
    }
    activateTab(tab);

    switch (tab) {
      case 'quran':
        dom.surahContent?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dom.controls?.classList.remove('mobile-show');
        break;
      case 'player':
        expandPlayer();
        dom.player?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        dom.controls?.classList.remove('mobile-show');
        break;
      case 'controls':
        dom.controls?.classList.toggle('mobile-show');
        break;
      case 'search':
        document.getElementById('headerSearch')?.classList.add('is-expanded');
        dom.searchToggleBtn?.setAttribute('aria-expanded', 'true');
        dom.searchInput?.focus();
        dom.searchInput?.select();
        break;
      case 'more':
        // Open adhkar panel (was opening settings, but adhkar had no button)
        toggleAdhkarPanel();
        dom.controls?.classList.remove('mobile-show');
        break;
      default:
        break;
    }
  });

  // Restore mushaf mode
  const savedMushaf = storage.get('mushaf_mode');
  const savedPage = storage.get<number>('current_page');
  if (savedPage) {
    state.currentPage = savedPage;
  }
  if (savedMushaf) {
    import('./mushaf.js').then((m) => m.toggleMushafMode());
  }
}

/**
 * Bind a collapsed-mode navigation button so it performs its action without
 * expanding the player (the collapsed-content click handler otherwise opens it).
 */
function bindCollapsedNav(id: string, action: () => void): void {
  const btn = document.getElementById(id);
  if (!btn) {
    return;
  }
  btn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    action();
  });
}
