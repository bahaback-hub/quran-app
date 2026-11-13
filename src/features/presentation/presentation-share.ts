/**
 * Share preview dialog: status text, action buttons and the click wiring.
 *
 * Rendering the PNG/video and caching the resulting blobs lives in
 * `presentation-share-export.ts`; the public entry points are re-exported here
 * so callers keep importing from this module.
 */
import { __ } from '../../i18n.js';
import { dom } from '../../dom.js';
import { showToast } from '../../ui.js';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  blobToBase64,
  currentReference,
  ensureShareBlob,
  ensureShareVideo,
  getPresentationShareActionKind,
  getPreparedShareBlob,
  hasReadyVideo,
  isAlafasyVideoShareAvailable,
  isShareCancellation,
  readyVideoBlob,
  resetShareBlobs,
  shareImageFilename,
  shareVideoFilename,
  syncPresentationVideoShareTrigger,
  type ImageShareResult,
  type VideoShareResult,
} from './presentation-share-export.js';

export { getPresentationShareActionKind, preparePresentationShareImage } from './presentation-share-export.js';

let previewUrl: string | null = null;

function setPreviewText(): void {
  const heading = document.getElementById('presentationShareHeading');
  const status = document.getElementById('presentationShareStatus');
  const share = document.getElementById('presentationShareNativeBtn');
  const download = document.getElementById('presentationShareDownloadBtn');
  const close = document.getElementById('presentationShareCloseBtn');
  const video = document.getElementById('presentationShareVideoBtn') as HTMLButtonElement | null;
  const videoDownload = document.getElementById('presentationShareVideoDownloadBtn') as HTMLButtonElement | null;
  const trigger = dom.presShareBtn;
  if (heading) {
    heading.textContent = __('presentation_share_preview');
  }
  if (status && !status.dataset['state']) {
    status.textContent = __('presentation_share_prepare');
  }
  const shareActionKind = getPresentationShareActionKind(hasReadyVideo());
  if (share) {
    share.textContent = `↗ ${shareActionKind === 'video' ? __('presentation_share_video_now') : __('presentation_share_now')}`;
    share.setAttribute(
      'aria-label',
      shareActionKind === 'video' ? __('presentation_share_video_now') : __('presentation_share_now'),
    );
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
  syncPresentationVideoShareTrigger();
  if (video) {
    const ready = hasReadyVideo();
    video.textContent = ready ? `↗ ${__('presentation_share_video_now')}` : `🎞 ${__('presentation_share_video')}`;
    const available = isAlafasyVideoShareAvailable();
    video.classList.toggle('hidden', !available || ready);
    video.disabled = !available || ready;
  }
  if (videoDownload) {
    const ready = hasReadyVideo();
    videoDownload.textContent = `↓ ${__('presentation_share_video_download_hd')}`;
    videoDownload.classList.toggle('hidden', !ready);
    videoDownload.disabled = !ready;
  }
}

function getSharePreview(): HTMLElement | null {
  return document.getElementById('presentationSharePreview');
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
  resetShareBlobs();
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
    const blob = await ensureShareBlob();
    previewUrl = URL.createObjectURL(blob);
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
  const blob = getPreparedShareBlob();
  if (!blob) {
    return;
  }
  const url = URL.createObjectURL(blob);
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

function downloadShareVideo(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = shareVideoFilename();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(__('presentation_share_video_download_hint'), 'success');
}

async function sharePresentationVideo(blob: Blob): Promise<VideoShareResult> {
  const reference = currentReference();
  const filename = shareVideoFilename();
  const file = new File([blob], filename, { type: 'video/webm' });
  // Android apps such as WhatsApp can prioritise EXTRA_TEXT over EXTRA_STREAM.
  // A video share must therefore carry the file alone rather than a caption.
  const shareData = { title: reference, files: [file] };
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
        files: [saved.uri],
        dialogTitle: __('presentation_share_video'),
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

async function handlePresentationVideoShare(): Promise<void> {
  const button = document.getElementById('presentationShareVideoBtn') as HTMLButtonElement | null;
  const ready = readyVideoBlob();
  if (ready) {
    const result = await sharePresentationVideo(ready);
    if (result === 'unavailable') {
      downloadShareVideo(ready);
    }
    return;
  }
  if (!button) {
    return;
  }
  button.disabled = true;
  updatePreviewStatus(__('presentation_share_video_prepare'), 'video-loading');
  try {
    await ensureShareVideo((percent) => {
      updatePreviewStatus(`${__('presentation_share_video_prepare')} ${percent}%`, 'video-loading');
    });
    setPreviewText();
    updatePreviewStatus(__('presentation_share_video_ready'), 'video-ready');
  } catch (error) {
    console.warn('[PresentationShare] Failed to create Alafasy video', error);
    updatePreviewStatus(__('presentation_share_video_failed'), 'video-failed');
    setPreviewText();
  } finally {
    button.disabled = false;
  }
}

async function handlePresentationShareNow(): Promise<void> {
  const ready = readyVideoBlob();
  if (getPresentationShareActionKind(Boolean(ready)) === 'video' && ready) {
    const result = await sharePresentationVideo(ready);
    if (result === 'unavailable') {
      downloadShareVideo(ready);
      updatePreviewStatus(__('presentation_share_video_download_hint'), 'video-download');
    }
    return;
  }
  const result = await sharePresentationImage();
  if (result === 'unavailable') {
    updatePreviewStatus(__('presentation_share_download_hint'), 'download');
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
  dom.presVideoShareBtn?.addEventListener('click', () => {
    void openPresentationSharePreview().then(() => {
      document.getElementById('presentationShareVideoBtn')?.focus();
    });
  });
  document.getElementById('presentationShareCloseBtn')?.addEventListener('click', closePresentationSharePreview);
  document.getElementById('presentationShareDownloadBtn')?.addEventListener('click', downloadShareImage);
  document.getElementById('presentationShareNativeBtn')?.addEventListener('click', () => {
    void handlePresentationShareNow().catch((error) => {
      console.warn('[PresentationShare] Share action failed', error);
      updatePreviewStatus(__('presentation_share_failed'), 'failed');
    });
  });
  document.getElementById('presentationShareVideoBtn')?.addEventListener('click', () => {
    void handlePresentationVideoShare();
  });
  document.getElementById('presentationShareVideoDownloadBtn')?.addEventListener('click', () => {
    const blob = readyVideoBlob();
    if (blob) {
      downloadShareVideo(blob);
    }
  });
  window.addEventListener('app:langchange', setPreviewText);
}
