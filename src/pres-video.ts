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

export function getPresentationVideo(videoId: string): (typeof PRESENTATION_VIDEOS)[PresentationVideoId] {
  return PRESENTATION_VIDEOS[videoId as PresentationVideoId] || PRESENTATION_VIDEOS.eva;
}

/** Apply the selected video background, or its still poster when motion/data saving is preferred. */
export function applyPresentationVideo(overlay: HTMLElement, videoId = 'eva'): void {
  const selectedVideo = getPresentationVideo(videoId);
  overlay.classList.add('pres-video');
  overlay.style.backgroundImage = `url('${selectedVideo.poster}')`;

  if (prefersStaticPresentationBackground()) {
    removePresentationVideo(overlay);
    overlay.classList.add('pres-video');
    return;
  }

  let video = overlay.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
  if (!video) {
    video = document.createElement('video');
    video.className = 'pres-video-bg';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    overlay.insertBefore(video, overlay.firstChild);
  }
  if (video.dataset['presentationVideo'] !== videoId) {
    video.pause();
    video.src = selectedVideo.src;
    video.poster = selectedVideo.poster;
    video.dataset['presentationVideo'] = videoId;
    video.load();
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
