/**
 * Reader navigation event bindings (surah/reciter selection, compact player,
 * reader toolbar pin, reader surface popover).
 *
 * Split from app-events.ts for maintainability; re-exported through its barrel.
 */
import { apiFetch } from '../api-client.js';
import { dom } from '../dom.js';
import { requireDom } from '../dom-require.js';
import { storage } from '../storage.js';
import { state } from '../state.js';
import type { AyahPageResponse } from '../types.js';
import { showToast } from '../ui.js';
import { __ } from '../i18n.js';
import { loadSurah } from '../surah-loader.js';
import * as audioModule from '../features/audio/audio.js';

/**
 * Bind surah/reciter selection and navigation controls.
 */
export function bindNavigationEvents(): void {
  dom.surahSelect?.addEventListener('change', () => {
    if (!requireDom('surahSelect').value) {
      return;
    }
    const surahNum = parseInt(requireDom('surahSelect').value, 10);
    // أخرج التركيز من القائمة لعودة المؤشر لطبيعته
    dom.surahSelect?.blur?.();
    if (state.mushafMode) {
      state.currentSurah = surahNum;
      apiFetch<AyahPageResponse>(`/ayah/${surahNum}:1`)
        .then((data) => {
          const page = data?.data?.page || 1;
          if (dom.pageSelect) {
            dom.pageSelect.value = String(page);
          }
          if (dom.pageSlider) {
            dom.pageSlider.value = String(page);
          }
          import('../features/mushaf/mushaf.js').then((m) => m.loadPage(page, true)); // lazy: mushaf not in main chunk
        })
        .catch(() => showToast(__('mushaf_page_not_found'), 'error'));
    } else {
      loadSurah(surahNum);
    }
  });

  dom.reciterSelect?.addEventListener('change', () => {
    state.currentReciter = requireDom('reciterSelect').value;
    storage.set('reciter', state.currentReciter);
    // The new reciter has a different audio duration, so the per-word sync
    // timings cached for the previous reciter are no longer valid.
    audioModule.clearWordWeightsCache();
    if (state.currentSurah) {
      loadSurah(state.currentSurah);
    }
  });

  // Compact player: tapping the current ayah opens the full ayah modal.
  dom.playerCurrentAyah?.addEventListener('click', () => {
    const data = state.surahData;
    const idx = state.currentAyahIndex;
    if (data && idx >= 0 && data.ayahs[idx]) {
      const a = data.ayahs[idx]!;
      import('../ayah-modal.js').then((m) =>
        m.openAyahModal({
          surah: state.currentSurah,
          ayah: idx + 1,
          text: a.text,
          surahName: data.name,
          index: idx,
        }),
      );
    }
  });
}
