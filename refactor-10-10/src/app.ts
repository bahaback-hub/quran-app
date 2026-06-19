/**
 * ================================================================
 * App Initialization — Layered Architecture (Problem #10)
 * ----------------------------------------------------------------
 * 3-Phase Bootstrap:
 *   Phase 1 — Critical: state, DOM, settings, surah list, first surah
 *   Phase 2 — Bindings: events, keyboard, navigation
 *   Phase 3 — Deferred: clock, prayer, adhkar, favorites, modals
 *
 * All dependencies resolved via DI container.
 * All dynamic imports wrapped in Error Boundary.
 * ================================================================
 */

import { state, batch, resetState } from './core/state.js';
import { cacheDom } from './core/dom.js';
import { events } from './core/event-bus.js';
import { errorBoundary } from './core/error-boundary.js';
import { templates } from './core/template-registry.js';
import { i18n } from './core/i18n.js';
import { container, TOKENS } from './core/di-container.js';
import { storage } from './services/storage.js';
import { apiClient } from './services/api-client.js';
import { toast } from './core/toast.js';

// Register DI tokens
container.registerInstance(TOKENS.Storage, storage);
container.registerInstance(TOKENS.ApiClient, apiClient);
container.registerInstance(TOKENS.Toast, toast);
container.registerInstance(TOKENS.ErrorBoundary, errorBoundary);
container.registerInstance(TOKENS.I18n, i18n);
container.registerInstance(TOKENS.EventBus, events);

class QuranApp {
  async init(): Promise<void> {
    console.info('[App] Starting Quran App (Refactored)...');

    try {
      await this.phase1Critical();
      this.phase2Bindings();
      this.phase3Deferred();
      console.info('[App] Initialization complete.');
    } catch (err) {
      console.error('[App] Initialization failed:', err);
      errorBoundary.showErrorUI('التطبيق', err as Error);
    }
  }

  // ================================================================
  // PHASE 1: CRITICAL PATH
  // ================================================================
  private async phase1Critical(): Promise<void> {
    resetState();

    // i18n must load before DOM so we can translate strings
    await i18n.init();

    // Inject overlay HTML from <template> tags
    this.injectOverlays();

    // Cache DOM elements (fail-fast in dev mode)
    cacheDom();

    // Restore settings
    this.restoreSettings();

    // Load surah list
    const surahRepo = await container.resolveAsync(TOKENS.SurahRepository);
    const surahList = await errorBoundary.load(
      'قائمة السور',
      () => surahRepo.getSurahList(),
      { maxRetries: 2 },
    );

    if (surahList) {
      batch(() => {
        state.surahList = surahList;
      });
    }

    // Load last position or default to Al-Fatihah
    const last = storage.get<{ surah: number; ayah?: number }>('last_position');
    if (last?.surah) {
      state.currentSurah = last.surah;
      await this.loadSurah(last.surah);
    } else {
      await this.loadSurah(1);
    }
  }

  // ================================================================
  // PHASE 2: EVENT BINDINGS
  // ================================================================
  private phase2Bindings(): void {
    // Set up event delegation (single listener for all data-action elements)
    events.delegate('click');
    events.delegate('change');
    events.delegate('input');

    // Register all action handlers
    events.register({
      'prev-ayah': () => console.log('prev ayah'),
      'next-ayah': () => console.log('next ayah'),
      'play-pause': () => console.log('play/pause'),
      'toggle-theme': (e, target) => {
        const theme = target.dataset['theme'];
        if (theme) this.setTheme(theme as 'light' | 'sepia' | 'night');
      },
      'view-surah': () => state.mushafMode = false,
      'view-mushaf': () => state.mushafMode = true,
      'toggle-settings': () => this.togglePanel('settings'),
      'toggle-favorites': () => this.togglePanel('favorites'),
      'toggle-tafsir': () => this.togglePanel('tafsir'),
      'toggle-adhkar': () => this.togglePanel('adhkar'),
      'nav-tab': (e, target) => {
        const tab = target.dataset['tab'];
        if (tab) this.switchTab(tab);
      },
    });

    // Keyboard shortcuts
    this.initKeyboardShortcuts();

    // Network status
    window.addEventListener('online', () => {
      toast.success('عاد الاتصال بالإنترنت.');
      errorBoundary.resetFailures();
    });
    window.addEventListener('offline', () => {
      toast.warning('لا يوجد اتصال بالإنترنت.');
    });
  }

  // ================================================================
  // PHASE 3: DEFERRED (non-critical)
  // ================================================================
  private phase3Deferred(): void {
    const scheduleIdle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 1);

    scheduleIdle(() => {
      // Group 1: Lightweight state init
      this.loadFavorites();
      this.loadBookmarks();

      // Group 2: Network-dependent (deferred)
      scheduleIdle(() => {
        this.loadPrayerTimes();
      });

      // Group 3: Heavy feature modules (lazy-loaded with error boundary)
      scheduleIdle(() => {
        errorBoundary.load('وضع المصحف', () => import('./features/mushaf.js'));
        errorBoundary.load('وضع العرض', () => import('./features/presentation.js'));
        errorBoundary.load('نافذة الآية', () => import('./features/ayah-modal.js'));
        errorBoundary.load('مشغل الصوت', () => import('./features/audio-player.js'));
        errorBoundary.load('البحث', () => import('./features/search.js'));
      });
    });
  }

  // ================================================================
  // Helpers
  // ================================================================

  private injectOverlays(): void {
    const overlayTemplateIds = [
      'player',
      'settings-panel',
      'help-panel',
      'adhkar-notification',
      'adhkar-add-overlay',
      'presentation-overlay',
      'azan-notification',
      'surah-secrets-overlay',
      'ayah-modal',
      'qibla-overlay',
      'reading-stats-panel',
    ];
    templates.injectAll(document.body, overlayTemplateIds);
  }

  private async loadSurah(surahNumber: number): Promise<void> {
    const surahRepo = await container.resolveAsync(TOKENS.SurahRepository);
    const surahData = await errorBoundary.load(
      `سورة ${surahNumber}`,
      () => surahRepo.getSurah(surahNumber),
    );
    if (surahData) {
      batch(() => {
        state.surahData = surahData;
        state.currentSurah = surahNumber;
        state.currentAyahIndex = 0;
      });
      storage.set('last_position', { surah: surahNumber, timestamp: Date.now() });
    }
  }

  private restoreSettings(): void {
    const theme = storage.get<'light' | 'sepia' | 'night'>('theme') ?? 'light';
    this.setTheme(theme);

    const reciter = storage.get<string>('reciter');
    if (reciter) state.currentReciter = reciter;

    const speed = storage.get<number>('playback_speed');
    if (speed) state.playbackSpeed = speed;
  }

  private setTheme(theme: 'light' | 'sepia' | 'night'): void {
    document.documentElement.dataset['theme'] = theme;
    state.theme = theme;
    storage.set('theme', theme);

    // Update theme switcher buttons
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset['theme'] === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private togglePanel(panel: string): void {
    const id = `${panel}Panel`;
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('open');
      el.classList.toggle('hidden', !el.classList.contains('open'));
    }
  }

  private switchTab(tab: string): void {
    document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset['tab'] === tab);
    });
  }

  private loadFavorites(): void {
    const favs = storage.get<unknown[]>('favorites') ?? [];
    state.favorites = favs as never;
  }

  private loadBookmarks(): void {
    const marks = storage.get<unknown[]>('bookmarks') ?? [];
    state.bookmarks = marks as never;
  }

  private async loadPrayerTimes(): Promise<void> {
    // Implemented in prayer service module
  }

  private initKeyboardShortcuts(): void {
    const shortcuts: Record<string, () => void> = {
      ' ': () => events.trigger('play-pause'),
      ArrowLeft: () => events.trigger('next-ayah'),
      ArrowRight: () => events.trigger('prev-ayah'),
      h: () => (state.hifdhMode = !state.hifdhMode),
      n: () => this.setTheme(state.theme === 'night' ? 'light' : 'night'),
      m: () => (state.mushafMode = !state.mushafMode),
      f: () => console.log('toggle favorite'),
      t: () => this.togglePanel('tafsir'),
      Escape: () => {
        document.querySelectorAll('.open').forEach((el) => el.classList.remove('open'));
      },
    };

    document.addEventListener('keydown', (e) => {
      // Don't trigger when typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}

// ================================================================
// Bootstrap
// ================================================================

export const app = new QuranApp();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void app.init());
} else {
  void app.init();
}
