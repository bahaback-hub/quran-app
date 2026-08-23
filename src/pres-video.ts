/**
 * Presentation video background: a user-selected, silent visual layer that
 * is created only while presentation mode is active and cleaned up on exit.
 */

export const PRESENTATION_VIDEO_SRC = 'backgrounds/eva-calm-house.mp4';
export const PRESENTATION_VIDEO_POSTER = 'backgrounds/eva-calm-house-poster.jpg';

const VIDEO_SELECTOR = '.pres-video-bg';

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

function canPlay(overlay: HTMLElement): boolean {
  return document.visibilityState === 'visible' && overlay.isConnected && !prefersStaticPresentationBackground();
}

/** Pause or resume the active video according to current visibility and user preferences. */
export function syncPresentationVideoPlayback(overlay: HTMLElement): void {
  const video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (!video) {
    return;
  }
  if (!canPlay(overlay)) {
    video.pause();
    return;
  }
  const playback = video.play();
  if (playback && typeof playback.catch === 'function') {
    void playback.catch(() => {
      // Autoplay can be denied by an older browser; the poster remains visible.
    });
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
}

/** Apply the selected video background, or its still poster when motion/data saving is preferred. */
export function applyPresentationVideo(overlay: HTMLElement): void {
  overlay.classList.add('pres-video');
  overlay.style.backgroundImage = `url('${PRESENTATION_VIDEO_POSTER}')`;

  if (prefersStaticPresentationBackground()) {
    removePresentationVideo(overlay);
    overlay.classList.add('pres-video');
    return;
  }

  let video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (!video) {
    video = document.createElement('video');
    video.className = 'pres-video-bg';
    video.src = PRESENTATION_VIDEO_SRC;
    video.poster = PRESENTATION_VIDEO_POSTER;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    overlay.insertBefore(video, overlay.firstChild);
  }
  syncPresentationVideoPlayback(overlay);
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
