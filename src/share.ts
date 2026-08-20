/**
 * @module share
 * @description Share and copy functionality for the Quran app. Provides functions
 * to build share text from the current ayah, toggle the share menu, share via the
 * Capacitor's Android share sheet, Web Share API, copy to clipboard (with and
 * without diacritics), and share through WhatsApp and Telegram.
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { stripTashkeel, copyToClipboard } from './utils.js';
import { state } from './state.js';
import { __ } from './i18n.js';

/* ===================== INTERFACES ===================== */

interface ShareErrorLike {
  name?: string;
  message?: string;
}

/** True when the platform reports that the user intentionally dismissed sharing. */
function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { name = '', message = '' } = error as ShareErrorLike;
  return name === 'AbortError' || /cancel(?:led|ed)?|abort/i.test(message);
}

/** Copy share text and make the fallback explicit to the user. */
function copyShareFallback(text: string, message: string): void {
  copyToClipboard(text);
  showToast(message, 'success');
}

/**
 * Open the Android system share sheet when running natively, otherwise use the
 * browser share sheet. If neither is usable, copy the text with visible feedback.
 */
export async function shareText(text: string, fallbackMessage: string = __('copy_for_share')): Promise<void> {
  if (!text) {
    return;
  }

  const shareData = { title: __('app_title'), text };
  try {
    if (Capacitor.isNativePlatform()) {
      const { value: canShare } = await Share.canShare();
      if (!canShare) {
        copyShareFallback(text, fallbackMessage);
        return;
      }
      await Share.share(shareData);
      return;
    }

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      return;
    }
  } catch (error) {
    if (isShareCancellation(error)) {
      return;
    }
    console.warn('[Share] Native share failed; copied text instead.', error);
    copyShareFallback(text, fallbackMessage);
    return;
  }

  copyShareFallback(text, fallbackMessage);
}

/** Build share text for the current ayah. */
export function buildShareText(): string {
  if (!state.surahData) {
    return '';
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) {
    return '';
  }
  return `${a.text} — ${surahData.name} — ${__('ayah')} ${a.numberInSurah}`;
}

/** Toggle share menu visibility. */
export function toggleShareMenu(): void {
  dom.shareMenu?.classList.toggle('show');
}

/** Share the current ayah through the unified native/web share path. */
export async function shareNative(): Promise<void> {
  const text = buildShareText();
  if (!text) {
    return;
  }
  await shareText(text, __('copied'));
}

/** Copy current ayah text to clipboard. */
export function shareCopy(): void {
  copyToClipboard(buildShareText());
  showToast(__('copied'), 'success');
}

/** Copy current ayah text without diacritics. */
export function shareCopySimple(): void {
  if (!state.surahData) {
    return;
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) {
    return;
  }
  const text = `${stripTashkeel(a.text)} — ${surahData.name} — ${__('ayah')} ${a.numberInSurah}`;
  copyToClipboard(text);
  showToast(__('share_copied_simple'), 'success');
}

/** Share current ayah via WhatsApp. */
export function shareWhatsApp(): void {
  const text = buildShareText();
  if (!text) {
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

/** Share current ayah via Telegram. */
export function shareTelegram(): void {
  const text = buildShareText();
  if (!text) {
    return;
  }
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`,
    '_blank',
  );
}
