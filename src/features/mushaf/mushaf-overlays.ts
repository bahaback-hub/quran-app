/**
 * Mushaf surah overlay and surah secrets helpers.
 * Extracted from `mushaf.ts`; behavior unchanged.
 */

import { apiFetch } from '../../api-client.js';
import { dom } from '../../dom.js';
import { requireDom } from '../../dom-require.js';
import { __ } from '../../i18n.js';
import { setTrustedHtml } from '../../safe-html.js';
import { state } from '../../state.js';
import { SURAH_SECRETS } from '../../surahs-data.js';
import { surahSecretsBody } from '../../templates.js';
import type { AyahPageResponse } from '../../types.js';
import { loadingBar, showToast } from '../../ui.js';
import { loadSurah } from '../../surah-loader.js';

interface SurahListEntry {
  number: number;
  name: string;
  englishName: string;
}

type LoadPageFn = (pageNum: number, skipNav?: boolean, force?: boolean) => Promise<void> | void;

export function showSurahSecret(surahNum: number, surahName?: string): void {
  if (!dom.surahSecretsOverlay || !dom.surahSecretsBody || !dom.surahSecretsTitle || !dom.surahSecretsSurahName) {
    return;
  }
  const secret = SURAH_SECRETS[surahNum];
  if (!secret) {
    showToast(__('mushaf_no_secret'), 'error');
    return;
  }
  dom.surahSecretsSurahName.textContent = `ℹ️ ${surahNum}. ${surahName ?? ''}`;
  dom.surahSecretsTitle.textContent = __('mushaf_surah_info');
  setTrustedHtml(dom.surahSecretsBody, surahSecretsBody(secret));
  dom.surahSecretsOverlay.classList.remove('hidden');
  dom.surahSecretsOverlay.style.display = 'flex';
}

export function populateSurahOverlayImpl(loadPage: LoadPageFn): void {
  if (!dom.mushafSurahOverlayList || !state.surahList.length) {
    return;
  }
  dom.mushafSurahOverlayList.replaceChildren();
  for (const s of state.surahList as SurahListEntry[]) {
    const row = document.createElement('div');
    row.className = 'mushaf-surah-overlay-row';
    const btn = document.createElement('button');
    btn.className = 'mushaf-surah-overlay-btn';
    btn.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    btn.dataset['surah'] = String(s.number);
    btn.dataset['surahName'] = s.name;
    row.appendChild(btn);
    if (SURAH_SECRETS[s.number]) {
      const secretBtn = document.createElement('button');
      secretBtn.className = 'surah-secret-btn';
      secretBtn.textContent = 'ℹ️';
      secretBtn.title = __('surah_info_title');
      secretBtn.setAttribute('aria-label', `${__('surah_info_for', s.name)}`);
      secretBtn.dataset['surah'] = String(s.number);
      secretBtn.dataset['surahName'] = s.name;
      row.appendChild(secretBtn);
    }
    dom.mushafSurahOverlayList.appendChild(row);
  }

  const overlayList = dom.mushafSurahOverlayList as HTMLElement & { _delegationBound?: boolean };
  if (!overlayList._delegationBound) {
    overlayList._delegationBound = true;
    overlayList.addEventListener('click', async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mushaf-surah-overlay-btn')) {
        const surahNum = parseInt(target.dataset['surah']!, 10);
        const surahName = target.dataset['surahName'] || '';
        requireDom('mushafSurahOverlay').classList.add('hidden');
        requireDom('mushafSurahOverlay').style.display = 'none';
        state.currentSurah = surahNum;
        state.currentAyahIndex = 0;
        state.surahData = null;
        loadingBar.show(`⏳ ${__('loading_surah')} ${surahName}...`);
        try {
          // Sync the player/reciter to the chosen surah (without autoplay),
          // then force-redraw the mushaf page once loadSurah settles — its
          // text render replaces the page canvas.
          const [data] = await Promise.all([
            apiFetch<AyahPageResponse>(`/ayah/${surahNum}:1`, { silent: true }),
            loadSurah(surahNum),
          ]);
          const page = data?.data?.page || 1;
          if (dom.pageSelect) {
            dom.pageSelect.value = String(page);
          }
          if (dom.pageSlider) {
            dom.pageSlider.value = String(page);
          }
          void loadPage(page, true, true);
        } catch {
          showToast(__('mushaf_page_not_found'), 'error');
        } finally {
          loadingBar.hide();
        }
        return;
      }
      if (target.classList.contains('surah-secret-btn')) {
        e.stopPropagation();
        showSurahSecret(parseInt(target.dataset['surah']!, 10), target.dataset['surahName'] || '');
      }
    });
  }
}
