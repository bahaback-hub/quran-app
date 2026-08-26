/**
 * Presentation video background: a user-selected, silent visual layer that
 * is created only while presentation mode is active and cleaned up on exit.
 */

export const PRESENTATION_VIDEO_SRC = 'backgrounds/eva-calm-house.mp4';
export const PRESENTATION_VIDEO_POSTER = 'backgrounds/eva-calm-house-poster.jpg';

export const PRESENTATION_VIDEOS = {
  eva: { src: PRESENTATION_VIDEO_SRC, poster: PRESENTATION_VIDEO_POSTER },
  alps: { src: 'backgrounds/alps-sunrise-fog.mp4', poster: 'backgrounds/alps-sunrise-fog-poster.jpg' },
  sunset: { src: 'backgrounds/sea-sunset.mp4', poster: 'backgrounds/sea-sunset-poster.jpg' },
  wave: { src: 'backgrounds/wave-breaking.mp4', poster: 'backgrounds/wave-breaking-poster.jpg' },
} as const;

export type PresentationVideoId = keyof typeof PRESENTATION_VIDEOS;

const VIDEO_SELECTOR = '.pres-video-bg';

function setPresentationVideoRetryState(overlay: HTMLElement, needsRetry: boolean): void {
  overlay.classList.toggle('pres-video-needs-play', needsRetry);
  const retryButton = document.getElementById('presVideoRetryBtn');
  if (retryButton) {
    retryButton.classList.toggle('hidden', !needsRetry);
    retryButton.setAttribute('aria-hidden', String(!needsRetry));
  }
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function prefersStaticPresentationBackground(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
  }

  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  return Boolean(connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g');
}

function canPlay(overlay: HTMLElement, forceMotion: boolean): boolean {
  return document.visibilityState === 'visible' && overlay.isConnected && (forceMotion || !prefersStaticPresentationBackground());
}

/** Pause or resume the active video according to current visibility and user preferences. */
export function syncPresentationVideoPlayback(
  overlay: HTMLElement,
  forceMotion = overlay.dataset['presentationVideoForce'] === 'true',
): void {
  const video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (!video) {
    return;
  }
  if (!canPlay(overlay, forceMotion)) {
    video.pause();
    if (document.visibilityState === 'visible' && overlay.isConnected) {
      setPresentationVideoRetryState(overlay, true);
    }
    return;
  }
  const playback = video.play();
  if (playback && typeof playback.catch === 'function') {
    void playback
      .then(() => setPresentationVideoRetryState(overlay, false))
      .catch(() => {
        // Older browsers may deny autoplay. Keep the poster and offer an explicit retry.
        setPresentationVideoRetryState(overlay, true);
      });
  } else {
    setPresentationVideoRetryState(overlay, false);
  }
}

/** Remove the video element and release its network/media resources. */
export function removePresentationVideo(overlay: HTMLElement): void {
  const video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.remove();
  }
  overlay.classList.remove('pres-video');
  overlay.removeAttribute('data-presentation-video');
  overlay.removeAttribute('data-presentation-video-force');
  setPresentationVideoRetryState(overlay, false);
}

export function getPresentationVideo(videoId: string): (typeof PRESENTATION_VIDEOS)[PresentationVideoId] {
  return PRESENTATION_VIDEOS[videoId as PresentationVideoId] || PRESENTATION_VIDEOS.eva;
}

/** Apply the selected video background, or its still poster when motion/data saving is preferred. */
export function applyPresentationVideo(overlay: HTMLElement, videoId = 'eva', forceMotion = false): void {
  const selectedVideo = getPresentationVideo(videoId);
  if (overlay.dataset['presentationVideo'] && overlay.dataset['presentationVideo'] !== videoId) {
    overlay.removeAttribute('data-presentation-video-force');
  }
  if (forceMotion) {
    overlay.dataset['presentationVideoForce'] = 'true';
  }
  const shouldForceMotion = overlay.dataset['presentationVideoForce'] === 'true';
  overlay.classList.add('pres-video');
  overlay.dataset['presentationVideo'] = videoId;
  overlay.style.backgroundImage = `url('${selectedVideo.poster}')`;

  if (prefersStaticPresentationBackground() && !shouldForceMotion) {
    removePresentationVideo(overlay);
    overlay.classList.add('pres-video');
    overlay.dataset['presentationVideo'] = videoId;
    overlay.style.backgroundImage = `url('${selectedVideo.poster}')`;
    setPresentationVideoRetryState(overlay, true);
    return;
  }

  let video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (!video) {
    video = document.createElement('video');
    video.className = 'pres-video-bg';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    overlay.insertBefore(video, overlay.firstChild);
  }
  if (video.dataset['presentationVideo'] !== videoId) {
    video.pause();
    video.src = selectedVideo.src;
    video.poster = selectedVideo.poster;
    video.dataset['presentationVideo'] = videoId;
    video.addEventListener('loadeddata', () => syncPresentationVideoPlayback(overlay, shouldForceMotion), { once: true });
    video.addEventListener('error', () => setPresentationVideoRetryState(overlay, true), { once: true });
    video.load();
  }
  syncPresentationVideoPlayback(overlay, shouldForceMotion);
}

/** Retry the visual background after an explicit user gesture when autoplay was denied. */
export function retryPresentationVideoPlayback(overlay: HTMLElement): void {
  const videoId = overlay.dataset['presentationVideo'] || 'eva';
  applyPresentationVideo(overlay, videoId, true);
}

let visibilityListenerBound = false;

/** Bind one document-level visibility listener so hidden tabs never keep video decoding. */
export function bindPresentationVideoVisibility(): void {
  if (visibilityListenerBound) {
    return;
  }
  visibilityListenerBound = true;
  document.addEventListener('visibilitychange', () => {
    const overlay = document.getElementById('presentationOverlay');
    if (overlay?.classList.contains('pres-video')) {
      syncPresentationVideoPlayback(overlay);
    }
  });
}
