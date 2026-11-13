/**
 * Share-media export pipeline: canvas image rendering, Alafasy video recording,
 * the blob caches and the pure helpers around them.
 *
 * The preview dialog and its event wiring live in `presentation-share.ts`,
 * which re-exports the two public entry points from here.
 */
import { __ } from '../../i18n.js';
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { getAutoBackground, getNatureBgByMood } from './pres-backgrounds.js';
import { PRESENTATION_VIDEO_SRC, getPresentationVideo } from './pres-video.js';
import { QURAN_COM_API_BASE } from '../../external-sources.js';

const PORTRAIT_EXPORT_WIDTH = 1080;
const PORTRAIT_EXPORT_HEIGHT = 1920;
const WIDE_EXPORT_WIDTH = 1920;
const WIDE_EXPORT_HEIGHT = 1080;
const GOLD = '#d8b25f';
const SULAIMANI_SIGNATURE = 'المصحف السليماني';
const ALAFASY_RECITER_ID = 'ar.alafasy';
const ALAFASY_QURAN_COM_RECITATION_ID = 7;
const VIDEO_EXPORT_WIDTH = 1920;
const VIDEO_EXPORT_HEIGHT = 1080;
const VIDEO_EXPORT_FPS = 24;
const VIDEO_EXPORT_BITRATE = 8_000_000;
const VIDEO_EXPORT_TAIL_MS = 900;
const VIDEO_AUDIO_END_GUARD_MS = 140;
const VIDEO_AUDIO_STALL_MS = 12_000;

let shareBlob: Blob | null = null;
let shareBlobKey = '';
let sharePreparation: Promise<Blob> | null = null;
let videoBlob: Blob | null = null;
let videoBlobKey = '';
let videoPreparation: Promise<Blob> | null = null;

export type ImageShareResult = 'shared' | 'cancelled' | 'unavailable';
export type VideoShareResult = ImageShareResult;

interface AlafasyTiming {
  audioUrl: string;
  startSeconds: number;
  endSeconds: number;
}

export function shareImageFilename(): string {
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

function getVideoBlobKey(): string {
  return [
    state.currentSurah,
    state.currentAyahIndex,
    state.currentReciter,
    state.presBgMode,
    state.presBgNature,
    state.presBgScene,
    state.presBgVideo,
    document.body.classList.contains('night-mode') ? 'night' : 'light',
  ].join(':');
}

/** True when a recorded video exists for the current ayah and presentation settings. */
export function hasReadyVideo(): boolean {
  return Boolean(videoBlob && videoBlobKey === getVideoBlobKey());
}

/** The recorded video only when it still matches the current ayah/settings. */
export function readyVideoBlob(): Blob | null {
  return hasReadyVideo() ? videoBlob : null;
}

/** The prepared PNG, if the image was already rendered for the current ayah. */
export function getPreparedShareBlob(): Blob | null {
  return shareBlob;
}

/** Drop both caches so the next preview re-renders from the live presentation. */
export function resetShareBlobs(): void {
  shareBlob = null;
  shareBlobKey = '';
  videoBlob = null;
  videoBlobKey = '';
}

export function isAlafasyVideoShareAvailable(): boolean {
  return (
    state.currentReciter === ALAFASY_RECITER_ID &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    typeof window.AudioContext !== 'undefined'
  );
}

export function shareVideoFilename(): string {
  return `quran-${state.currentSurah}-${state.currentAyahIndex + 1}-alafasy-hd.webm`;
}

export function isShareCancellation(error: unknown): boolean {
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

export function currentReference(): string {
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    return '';
  }
  return `${localizedSurahName()} — ${__('ayah')} ${ayah.numberInSurah}`;
}

export function syncPresentationVideoShareTrigger(): void {
  const trigger = dom.presVideoShareBtn;
  if (!trigger) {
    return;
  }
  const available = isAlafasyVideoShareAvailable();
  trigger.classList.toggle('hidden', !available);
  trigger.setAttribute('aria-label', __('presentation_share_video'));
  trigger.setAttribute('title', __('presentation_share_video'));
}

export function getPresentationShareActionKind(videoReady: boolean): 'image' | 'video' {
  return videoReady ? 'video' : 'image';
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

function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Background image failed CORS check'));
    image.src = src;
  });
}

function waitForMediaEvent(media: HTMLMediaElement, eventName: 'loadedmetadata' | 'seeked' | 'canplay'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error('Audio could not be loaded'));
    };
    const cleanup = (): void => {
      media.removeEventListener(eventName, onSuccess);
      media.removeEventListener('error', onError);
    };
    media.addEventListener(eventName, onSuccess, { once: true });
    media.addEventListener('error', onError, { once: true });
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
  const video = image as HTMLVideoElement;
  const sourceWidth = video.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = video.videoHeight || source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) {
    return;
  }
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
    ctx.font = `${fontSize}px "KFGQPC HAFS Uthmanic Script", "Amiri", "Traditional Arabic", serif`;
    lines = wrapText(ctx, ayahText, maxTextWidth);
    fontSize -= 4;
  } while (lines.length > (isWide ? 6 : 8) && fontSize >= (isWide ? 44 : 64));

  const lineHeight = Math.round(fontSize * 1.72);
  const contentHeight = lines.length * lineHeight;
  const textX = isWide ? Math.round(width * 0.31) : width / 2;
  const startY = (isWide ? Math.round(height * 0.4) : height / 2) - contentHeight / 2 + lineHeight * 0.2;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontSize}px "KFGQPC HAFS Uthmanic Script", "Amiri", "Traditional Arabic", serif`;
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

async function getAlafasyTiming(): Promise<AlafasyTiming> {
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah || !state.currentSurah) {
    throw new Error('No current ayah');
  }
  const response = await fetch(
    `${QURAN_COM_API_BASE}/chapter_recitations/${ALAFASY_QURAN_COM_RECITATION_ID}/${state.currentSurah}?segments=true`,
    { credentials: 'omit' },
  );
  if (!response.ok) {
    throw new Error('Alafasy timing service unavailable');
  }
  const payload = (await response.json()) as {
    audio_file?: {
      audio_url?: string;
      timestamps?: Array<{ verse_key?: string; timestamp_from?: number; timestamp_to?: number }>;
    };
  };
  const verseKey = `${state.currentSurah}:${ayah.numberInSurah}`;
  const timing = payload.audio_file?.timestamps?.find((item) => item.verse_key === verseKey);
  const audioUrl = payload.audio_file?.audio_url;
  if (!audioUrl || !timing || !Number.isFinite(timing.timestamp_from) || !Number.isFinite(timing.timestamp_to)) {
    throw new Error('Alafasy timing data unavailable');
  }
  return {
    audioUrl,
    startSeconds: timing.timestamp_from! / 1000,
    endSeconds: timing.timestamp_to! / 1000,
  };
}

function pickVideoMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource | null,
  width: number,
  height: number,
): void {
  drawFallbackBackground(ctx, width, height);
  if (background) {
    try {
      drawCover(ctx, background, width, height);
    } catch {
      // Keep the fallback if an animated source changes while the video is exporting.
    }
  }
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    return;
  }
  drawShareOverlay(ctx, width, height, true);
  drawShareText(ctx, ayah.text, currentReference(), width, height, true);
  drawSulaimaniSignature(ctx, width, height);
}

interface ExportBackground {
  source: CanvasImageSource | null;
  dispose: () => void;
}

function noOpDispose(): void {
  return;
}

function disposeExportVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
}

async function resolveVideoBackground(): Promise<ExportBackground> {
  const overlay = dom.presentationOverlay;
  const liveVideo = overlay?.querySelector<HTMLVideoElement>('.pres-video-bg');
  if (state.presBgMode === 'video') {
    const exportVideo = document.createElement('video');
    exportVideo.src =
      liveVideo?.currentSrc || liveVideo?.src || getPresentationVideo(state.presBgVideo).src || PRESENTATION_VIDEO_SRC;
    exportVideo.muted = true;
    exportVideo.defaultMuted = true;
    exportVideo.loop = true;
    exportVideo.playsInline = true;
    exportVideo.preload = 'auto';
    exportVideo.load();
    try {
      await waitForMediaEvent(exportVideo, 'canplay');
      if (liveVideo && Number.isFinite(liveVideo.currentTime)) {
        exportVideo.currentTime = liveVideo.currentTime;
        await waitForMediaEvent(exportVideo, 'seeked');
      }
      await exportVideo.play();
      return { source: exportVideo, dispose: () => disposeExportVideo(exportVideo) };
    } catch {
      disposeExportVideo(exportVideo);
      return { source: null, dispose: noOpDispose };
    }
  }
  const sceneCanvas = overlay?.querySelector<HTMLCanvasElement>('.pres-canvas-bg');
  if (state.presBgMode === 'scene' && sceneCanvas) {
    return { source: sceneCanvas, dispose: noOpDispose };
  }
  const source = getImageSource();
  if (!source) {
    return { source: null, dispose: noOpDispose };
  }
  try {
    return { source: await loadCorsImage(source), dispose: noOpDispose };
  } catch {
    return { source: null, dispose: noOpDispose };
  }
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
  drawShareText(ctx, ayah.text, currentReference(), width, height, isWide);
  if (isWide) {
    drawSulaimaniSignature(ctx, width, height);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

export async function ensureShareBlob(): Promise<Blob> {
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

async function renderShareVideo(onProgress: (percent: number) => void): Promise<Blob> {
  if (!isAlafasyVideoShareAvailable()) {
    throw new Error('Video export unsupported');
  }
  await document.fonts?.ready;
  const timing = await getAlafasyTiming();
  // Quran.com verse timestamps can overlap the first phoneme of the next ayah.
  // Finish slightly before that boundary, then check on every rendered frame.
  const audioEndSeconds = Math.max(timing.startSeconds + 0.25, timing.endSeconds - VIDEO_AUDIO_END_GUARD_MS / 1000);
  const audioDuration = Math.max(0.25, audioEndSeconds - timing.startSeconds);
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_EXPORT_WIDTH;
  canvas.height = VIDEO_EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }
  const background = await resolveVideoBackground();
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = timing.audioUrl;
  audio.load();
  await waitForMediaEvent(audio, 'loadedmetadata');
  audio.currentTime = Math.min(timing.startSeconds, Math.max(0, audio.duration - 0.05));
  await waitForMediaEvent(audio, 'seeked');

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaElementSource(audio);
  const recordingDestination = audioContext.createMediaStreamDestination();
  sourceNode.connect(recordingDestination);
  sourceNode.connect(audioContext.destination);
  await audioContext.resume();

  const canvasStream = canvas.captureStream(VIDEO_EXPORT_FPS);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...recordingDestination.stream.getAudioTracks()]);
  const mimeType = pickVideoMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_EXPORT_BITRATE, audioBitsPerSecond: 128_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_EXPORT_BITRATE, audioBitsPerSecond: 128_000 });
  const chunks: BlobPart[] = [];
  let rejectOutput: ((error: Error) => void) | null = null;
  const output = new Promise<Blob>((resolve, reject) => {
    rejectOutput = reject;
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener('error', () => reject(new Error('Video recording failed')), { once: true });
    recorder.addEventListener(
      'stop',
      () => {
        resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      },
      { once: true },
    );
  });
  let frameId = 0;
  let finished = false;
  let verseAudioEnded = false;
  let tailTimer: number | null = null;
  let stallTimer: number | null = null;
  const stopRecording = (error?: Error): void => {
    if (finished) {
      return;
    }
    finished = true;
    cancelAnimationFrame(frameId);
    if (tailTimer !== null) {
      window.clearTimeout(tailTimer);
    }
    if (stallTimer !== null) {
      window.clearTimeout(stallTimer);
    }
    audio.pause();
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (error) {
      rejectOutput?.(error);
    }
  };
  const resetStallTimer = (): void => {
    if (stallTimer !== null) {
      window.clearTimeout(stallTimer);
    }
    stallTimer = window.setTimeout(
      () => stopRecording(new Error('Audio playback stalled during video export')),
      VIDEO_AUDIO_STALL_MS,
    );
  };
  const finishVerseAudio = (): void => {
    if (finished || verseAudioEnded) {
      return;
    }
    verseAudioEnded = true;
    audio.pause();
    onProgress(100);
    tailTimer = window.setTimeout(stopRecording, VIDEO_EXPORT_TAIL_MS);
  };
  const paintFrame = (): void => {
    if (audio.currentTime >= audioEndSeconds) {
      finishVerseAudio();
    }
    drawVideoFrame(ctx, background.source, VIDEO_EXPORT_WIDTH, VIDEO_EXPORT_HEIGHT);
    if (!finished) {
      frameId = requestAnimationFrame(paintFrame);
    }
  };
  audio.addEventListener('timeupdate', () => {
    if (finished) {
      return;
    }
    resetStallTimer();
    const elapsed = Math.max(0, audio.currentTime - timing.startSeconds);
    onProgress(Math.min(100, Math.round((elapsed / audioDuration) * 100)));
    if (audio.currentTime >= audioEndSeconds) {
      finishVerseAudio();
    }
  });
  audio.addEventListener('ended', () => stopRecording(), { once: true });
  audio.addEventListener('error', () => stopRecording(new Error('Audio failed during video export')), { once: true });
  drawVideoFrame(ctx, background.source, VIDEO_EXPORT_WIDTH, VIDEO_EXPORT_HEIGHT);
  recorder.start(500);
  paintFrame();
  resetStallTimer();
  try {
    await audio.play();
  } catch (error) {
    stopRecording(error instanceof Error ? error : new Error('Audio playback could not start'));
  }
  return output.finally(() => {
    cancelAnimationFrame(frameId);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    sourceNode.disconnect();
    recordingDestination.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    background.dispose();
    void audioContext.close();
  });
}

export async function ensureShareVideo(onProgress: (percent: number) => void): Promise<Blob> {
  const currentKey = getVideoBlobKey();
  if (videoBlob && videoBlobKey === currentKey) {
    return videoBlob;
  }
  if (videoPreparation) {
    return videoPreparation;
  }
  const preparation = renderShareVideo(onProgress);
  videoPreparation = preparation;
  try {
    const blob = await preparation;
    if (getVideoBlobKey() === currentKey) {
      videoBlob = blob;
      videoBlobKey = currentKey;
    }
    return blob;
  } finally {
    if (videoPreparation === preparation) {
      videoPreparation = null;
    }
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
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
