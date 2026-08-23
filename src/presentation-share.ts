import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { getAutoBackground, getNatureBgByMood } from './pres-backgrounds.js';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const PORTRAIT_EXPORT_WIDTH = 1080;
const PORTRAIT_EXPORT_HEIGHT = 1920;
const WIDE_EXPORT_WIDTH = 1920;
const WIDE_EXPORT_HEIGHT = 1080;
const GOLD = '#d8b25f';
const SULAIMANI_SIGNATURE = 'المصحف السليماني';

let shareBlob: Blob | null = null;
let previewUrl: string | null = null;
let shareBlobKey = '';
let sharePreparation: Promise<Blob> | null = null;

type ImageShareResult = 'shared' | 'cancelled' | 'unavailable';

function shareImageFilename(): string {
  const layout = state.presBgMode === 'video' ? 'wide' : 'portrait';
  return `quran-${state.currentSurah}-${state.currentAyahIndex + 1}-${layout}.png`;
}

function getShareBlobKey(): string {
  return [
    state.currentSurah,
    state.currentAyahIndex,
    state.presBgMode,
    state.presBgNature,
    document.body.classList.contains('night-mode') ? 'night' : 'light',
  ].join(':');
}

function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { name = '', message = '' } = error as { name?: string; message?: string };
  return name === 'AbortError' || /cancel(?:led|ed)?|abort/i.test(message);
}

function localizedSurahName(): string {
  const surah = state.surahData;
  if (!surah) {
    return '';
  }
  if (document.documentElement.lang === 'ar' || !document.documentElement.lang) {
    return surah.name;
  }
  return state.surahList.find((entry) => entry.number === state.currentSurah)?.englishName || surah.name;
}

function currentReference(): string {
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    return '';
  }
  return `${localizedSurahName()} — ${__('ayah')} ${ayah.numberInSurah}`;
}

function setPreviewText(): void {
  const heading = document.getElementById('presentationShareHeading');
  const status = document.getElementById('presentationShareStatus');
  const share = document.getElementById('presentationShareNativeBtn');
  const download = document.getElementById('presentationShareDownloadBtn');
  const close = document.getElementById('presentationShareCloseBtn');
  const trigger = dom.presShareBtn;
  if (heading) {
    heading.textContent = __('presentation_share_preview');
  }
  if (status && !status.dataset['state']) {
    status.textContent = __('presentation_share_prepare');
  }
  if (share) {
    share.textContent = `↗ ${__('presentation_share_now')}`;
  }
  if (download) {
    download.textContent = `↓ ${__('presentation_share_download')}`;
  }
  if (close) {
    close.textContent = `✖ ${__('close')}`;
    close.setAttribute('aria-label', __('close'));
  }
  if (trigger) {
    trigger.setAttribute('aria-label', __('presentation_share_image'));
    trigger.setAttribute('title', __('presentation_share_image'));
  }
}

function getSharePreview(): HTMLElement | null {
  return document.getElementById('presentationSharePreview');
}

function getImageSource(): string | null {
  const overlay = dom.presentationOverlay;
  if (!overlay) {
    return null;
  }
  const layer = overlay.querySelector<HTMLElement>('.pres-bg-layer');
  const candidate = layer?.style.backgroundImage || overlay.style.backgroundImage;
  const match = /url\(["']?(.*?)["']?\)/.exec(candidate || '');
  if (match?.[1]) {
    return match[1];
  }
  if (state.presBgMode === 'auto') {
    return getAutoBackground().src;
  }
  if (state.presBgMode === 'singleNature') {
    return getNatureBgByMood(state.presBgNature)?.src || null;
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Background image failed to load'));
    image.src = src;
  });
}

function getShareDimensions(): { width: number; height: number; isWide: boolean } {
  const isWide = state.presBgMode === 'video';
  return {
    width: isWide ? WIDE_EXPORT_WIDTH : PORTRAIT_EXPORT_WIDTH,
    height: isWide ? WIDE_EXPORT_HEIGHT : PORTRAIT_EXPORT_HEIGHT,
    isWide,
  };
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number): void {
  const source = image as HTMLImageElement;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const dark = document.body.classList.contains('night-mode');
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, dark ? '#08101a' : '#f7f0df');
  gradient.addColorStop(0.55, dark ? '#102a35' : '#d8c6a0');
  gradient.addColorStop(1, dark ? '#182122' : '#8c6a48');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function drawShareText(
  ctx: CanvasRenderingContext2D,
  ayahText: string,
  reference: string,
  width: number,
  height: number,
  isWide: boolean,
): void {
  const maxTextWidth = isWide ? 800 : 860;
  let fontSize = isWide
    ? ayahText.length > 200
      ? 56
      : ayahText.length > 115
        ? 72
        : 94
    : ayahText.length > 200
      ? 88
      : ayahText.length > 115
        ? 112
        : 140;
  let lines: string[] = [];
  do {
    ctx.font = `${fontSize}px "Uthmanic Hafs Official", "Amiri", "Traditional Arabic", serif`;
    lines = wrapText(ctx, ayahText, maxTextWidth);
    fontSize -= 4;
  } while (lines.length > (isWide ? 6 : 8) && fontSize >= (isWide ? 44 : 64));

  const lineHeight = Math.round(fontSize * 1.72);
  const contentHeight = lines.length * lineHeight;
  const textX = isWide ? Math.round(width * 0.28) : width / 2;
  const startY = (isWide ? Math.round(height * 0.4) : height / 2) - contentHeight / 2 + lineHeight * 0.2;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontSize}px "Uthmanic Hafs Official", "Amiri", "Traditional Arabic", serif`;
  ctx.fillStyle = '#fffdf6';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = 18;
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, textX, startY + index * lineHeight, maxTextWidth);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = GOLD;
  ctx.font = '500 46px "Amiri", "Traditional Arabic", serif';
  const referenceY = isWide ? Math.min(height - 100, startY + contentHeight + 82) : height - 156;
  ctx.fillText(reference, textX, referenceY, maxTextWidth);
}

function drawShareOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, isWide: boolean): void {
  if (isWide) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
    gradient.addColorStop(0.48, 'rgba(0, 0, 0, 0.28)');
    gradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.02)');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  }
  ctx.fillRect(0, 0, width, height);
}

function drawSulaimaniSignature(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#f8f2e5';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = 8;
  ctx.font = `400 ${Math.round(width * 0.021)}px "Amiri", "Traditional Arabic", serif`;
  ctx.fillText(SULAIMANI_SIGNATURE, Math.round(width * 0.035), height - Math.round(height * 0.065));
  ctx.restore();
}

async function renderShareImage(): Promise<Blob> {
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    throw new Error('No current ayah');
  }
  await document.fonts?.ready;
  const { width, height, isWide } = getShareDimensions();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }
  drawFallbackBackground(ctx, width, height);

  const sceneCanvas = dom.presentationOverlay?.querySelector<HTMLCanvasElement>('.pres-canvas-bg');
  if (state.presBgMode === 'scene' && sceneCanvas) {
    drawCover(ctx, sceneCanvas, width, height);
  } else {
    const source = getImageSource();
    if (source) {
      try {
        drawCover(ctx, await loadImage(source), width, height);
      } catch {
        // The refined fallback background keeps sharing available when an image cannot be read.
      }
    }
  }
  drawShareOverlay(ctx, width, height, isWide);
  ctx.strokeStyle = 'rgba(216, 178, 95, 0.78)';
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, width - 88, height - 88);
  ctx.strokeStyle = 'rgba(255, 253, 246, 0.24)';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 60, width - 120, height - 120);
  drawShareText(ctx, ayah.text, currentReference(), width, height, isWide);
  if (isWide) {
    drawSulaimaniSignature(ctx, width, height);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

async function ensureShareBlob(): Promise<Blob> {
  const currentKey = getShareBlobKey();
  if (shareBlob && shareBlobKey === currentKey) {
    return shareBlob;
  }
  if (sharePreparation) {
    return sharePreparation;
  }

  const preparation = renderShareImage();
  sharePreparation = preparation;
  try {
    const blob = await preparation;
    if (getShareBlobKey() === currentKey) {
      shareBlob = blob;
      shareBlobKey = currentKey;
    }
    return blob;
  } finally {
    if (sharePreparation === preparation) {
      sharePreparation = null;
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('PNG encoding failed'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.split(',', 2)[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('PNG encoding failed'));
      }
    };
    reader.readAsDataURL(blob);
  });
}

/** Prepare the image while the ayah is on screen, so the click remains a direct
 * user activation for browser and native share sheets. */
export function preparePresentationShareImage(): void {
  void ensureShareBlob().catch((error) => {
    console.warn('[PresentationShare] Failed to prepare image in advance', error);
  });
}

function updatePreviewStatus(message: string, stateName: string): void {
  const status = document.getElementById('presentationShareStatus');
  if (status) {
    status.textContent = message;
    status.dataset['state'] = stateName;
  }
}

function setPreviewActions(enabled: boolean): void {
  const share = document.getElementById('presentationShareNativeBtn') as HTMLButtonElement | null;
  const download = document.getElementById('presentationShareDownloadBtn') as HTMLButtonElement | null;
  if (share) {
    share.disabled = !enabled;
  }
  if (download) {
    download.disabled = !enabled;
  }
}

export function closePresentationSharePreview(): void {
  const preview = getSharePreview();
  if (preview) {
    preview.classList.add('hidden');
    preview.style.display = 'none';
  }
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  shareBlob = null;
  shareBlobKey = '';
}

export async function openPresentationSharePreview(): Promise<void> {
  const preview = getSharePreview();
  const image = document.getElementById('presentationShareImage') as HTMLImageElement | null;
  if (!preview || !image) {
    return;
  }
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  setPreviewText();
  setPreviewActions(false);
  image.removeAttribute('src');
  preview.classList.remove('hidden');
  preview.style.display = 'flex';
  updatePreviewStatus(__('presentation_share_prepare'), 'loading');
  try {
    shareBlob = await ensureShareBlob();
    previewUrl = URL.createObjectURL(shareBlob);
    image.src = previewUrl;
    image.alt = currentReference();
    setPreviewActions(true);
    updatePreviewStatus(__('presentation_share_ready'), 'ready');
  } catch (error) {
    console.warn('[PresentationShare] Failed to prepare image', error);
    updatePreviewStatus(__('presentation_share_failed'), 'failed');
  }
}

function downloadShareImage(): void {
  if (!shareBlob) {
    return;
  }
  const url = URL.createObjectURL(shareBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = shareImageFilename();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(__('presentation_share_saved'), 'success');
}

async function sharePresentationImage(): Promise<ImageShareResult> {
  const blob = await ensureShareBlob();
  const reference = currentReference();
  const filename = shareImageFilename();
  const file = new File([blob], filename, {
    type: 'image/png',
  });
  const shareData = { title: reference, text: reference, files: [file] };
  try {
    if (Capacitor.isNativePlatform()) {
      const { value: canShare } = await Share.canShare();
      if (!canShare) {
        return 'unavailable';
      }
      const saved = await Filesystem.writeFile({
        path: `shared/${filename}`,
        data: await blobToBase64(blob),
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: reference,
        text: reference,
        files: [saved.uri],
        dialogTitle: __('presentation_share_image'),
      });
      return 'shared';
    }
    if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) {
      return 'unavailable';
    }
    await navigator.share(shareData);
    return 'shared';
  } catch (error) {
    return isShareCancellation(error) ? 'cancelled' : 'unavailable';
  }
}

async function shareFromPresentationTrigger(): Promise<void> {
  try {
    const result = await sharePresentationImage();
    if (result !== 'unavailable') {
      return;
    }
    await openPresentationSharePreview();
    updatePreviewStatus(__('presentation_share_download_hint'), 'download');
  } catch (error) {
    console.warn('[PresentationShare] Native share failed', error);
    await openPresentationSharePreview();
    updatePreviewStatus(__('presentation_share_failed'), 'failed');
  }
}

export function initPresentationShare(): void {
  if (dom.presShareBtn?.dataset['presentationShareBound'] === 'true') {
    setPreviewText();
    return;
  }
  setPreviewText();
  if (dom.presShareBtn) {
    dom.presShareBtn.dataset['presentationShareBound'] = 'true';
  }
  dom.presShareBtn?.addEventListener('click', () => void shareFromPresentationTrigger());
  document.getElementById('presentationShareCloseBtn')?.addEventListener('click', closePresentationSharePreview);
  document.getElementById('presentationShareDownloadBtn')?.addEventListener('click', downloadShareImage);
  document.getElementById('presentationShareNativeBtn')?.addEventListener('click', () => {
    void sharePresentationImage().then((result) => {
      if (result === 'unavailable') {
        updatePreviewStatus(__('presentation_share_download_hint'), 'download');
      }
    });
  });
  window.addEventListener('app:langchange', setPreviewText);
}
