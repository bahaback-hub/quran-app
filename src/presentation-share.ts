import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { getAutoBackground, getNatureBgByMood } from './pres-backgrounds.js';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;
const GOLD = '#d8b25f';

let shareBlob: Blob | null = null;
let previewUrl: string | null = null;

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
  if (heading) heading.textContent = __('presentation_share_preview');
  if (status && !status.dataset['state']) status.textContent = __('presentation_share_prepare');
  if (share) share.textContent = `↗ ${__('presentation_share_now')}`;
  if (download) download.textContent = `↓ ${__('presentation_share_download')}`;
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

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource): void {
  const source = image as HTMLImageElement;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const scale = Math.max(EXPORT_WIDTH / sourceWidth, EXPORT_HEIGHT / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (EXPORT_WIDTH - drawWidth) / 2, (EXPORT_HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D): void {
  const dark = document.body.classList.contains('night-mode');
  const gradient = ctx.createLinearGradient(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  gradient.addColorStop(0, dark ? '#08101a' : '#f7f0df');
  gradient.addColorStop(0.55, dark ? '#102a35' : '#d8c6a0');
  gradient.addColorStop(1, dark ? '#182122' : '#8c6a48');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
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
  if (line) lines.push(line);
  return lines;
}

function drawShareText(ctx: CanvasRenderingContext2D, ayahText: string, reference: string): void {
  const maxTextWidth = 860;
  let fontSize = ayahText.length > 200 ? 88 : ayahText.length > 115 ? 112 : 140;
  let lines: string[] = [];
  do {
    ctx.font = `${fontSize}px "Uthmanic Hafs Official", "Amiri", "Traditional Arabic", serif`;
    lines = wrapText(ctx, ayahText, maxTextWidth);
    fontSize -= 4;
  } while (lines.length > 8 && fontSize >= 64);

  const lineHeight = Math.round(fontSize * 1.72);
  const contentHeight = lines.length * lineHeight;
  const startY = EXPORT_HEIGHT / 2 - contentHeight / 2 + lineHeight * 0.2;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontSize}px "Uthmanic Hafs Official", "Amiri", "Traditional Arabic", serif`;
  ctx.fillStyle = '#fffdf6';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = 18;
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, EXPORT_WIDTH / 2, startY + index * lineHeight, maxTextWidth);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = GOLD;
  ctx.font = '500 46px "Amiri", "Traditional Arabic", serif';
  ctx.fillText(reference, EXPORT_WIDTH / 2, EXPORT_HEIGHT - 156, 860);
}

async function renderShareImage(): Promise<Blob> {
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    throw new Error('No current ayah');
  }
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }
  drawFallbackBackground(ctx);

  const sceneCanvas = dom.presentationOverlay?.querySelector<HTMLCanvasElement>('.pres-canvas-bg');
  if (state.presBgMode === 'scene' && sceneCanvas) {
    drawCover(ctx, sceneCanvas);
  } else {
    const source = getImageSource();
    if (source) {
      try {
        drawCover(ctx, await loadImage(source));
      } catch {
        // The refined fallback background keeps sharing available when an image cannot be read.
      }
    }
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.strokeStyle = 'rgba(216, 178, 95, 0.78)';
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, EXPORT_WIDTH - 88, EXPORT_HEIGHT - 88);
  ctx.strokeStyle = 'rgba(255, 253, 246, 0.24)';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 60, EXPORT_WIDTH - 120, EXPORT_HEIGHT - 120);
  drawShareText(ctx, ayah.text, currentReference());

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
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
  if (share) share.disabled = !enabled;
  if (download) download.disabled = !enabled;
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
  shareBlob = null;
  setPreviewText();
  setPreviewActions(false);
  image.removeAttribute('src');
  preview.classList.remove('hidden');
  preview.style.display = 'flex';
  updatePreviewStatus(__('presentation_share_prepare'), 'loading');
  try {
    shareBlob = await renderShareImage();
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
  const filename = `quran-${state.currentSurah}-${state.currentAyahIndex + 1}.png`;
  const url = URL.createObjectURL(shareBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(__('presentation_share_saved'), 'success');
}

async function sharePresentationImage(): Promise<void> {
  if (!shareBlob) {
    return;
  }
  const reference = currentReference();
  const file = new File([shareBlob], `quran-${state.currentSurah}-${state.currentAyahIndex + 1}.png`, {
    type: 'image/png',
  });
  const shareData = { title: reference, text: reference, files: [file] };
  if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) {
    updatePreviewStatus(__('presentation_share_download_hint'), 'download');
    return;
  }
  try {
    await navigator.share(shareData);
  } catch (error) {
    if ((error as { name?: string } | undefined)?.name !== 'AbortError') {
      updatePreviewStatus(__('presentation_share_download_hint'), 'download');
    }
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
  dom.presShareBtn?.addEventListener('click', () => void openPresentationSharePreview());
  document.getElementById('presentationShareCloseBtn')?.addEventListener('click', closePresentationSharePreview);
  document.getElementById('presentationShareDownloadBtn')?.addEventListener('click', downloadShareImage);
  document.getElementById('presentationShareNativeBtn')?.addEventListener('click', () => void sharePresentationImage());
  window.addEventListener('app:langchange', setPreviewText);
}
