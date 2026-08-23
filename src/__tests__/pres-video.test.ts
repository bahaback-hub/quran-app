import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRESENTATION_VIDEO_POSTER,
  PRESENTATION_VIDEO_SRC,
  applyPresentationVideo,
  removePresentationVideo,
  syncPresentationVideoPlayback,
} from '../pres-video.js';

describe('presentation video background', () => {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    play.mockClear();
    pause.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a muted looping video only when the mode is selected', () => {
    const overlay = document.createElement('div');
    document.body.append(overlay);

    applyPresentationVideo(overlay);

    const video = overlay.querySelector<HTMLVideoElement>('.pres-video-bg');
    expect(overlay.classList.contains('pres-video')).toBe(true);
    expect(overlay.style.backgroundImage).toContain(PRESENTATION_VIDEO_POSTER);
    expect(video?.src).toContain(PRESENTATION_VIDEO_SRC);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.getAttribute('aria-hidden')).toBe('true');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('keeps the poster but skips playback for users who reduce motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const overlay = document.createElement('div');
    document.body.append(overlay);

    applyPresentationVideo(overlay);

    expect(overlay.classList.contains('pres-video')).toBe(true);
    expect(overlay.style.backgroundImage).toContain(PRESENTATION_VIDEO_POSTER);
    expect(overlay.querySelector('.pres-video-bg')).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('pauses while the page is hidden and releases resources on removal', () => {
    const overlay = document.createElement('div');
    document.body.append(overlay);
    applyPresentationVideo(overlay);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    syncPresentationVideoPlayback(overlay);
    removePresentationVideo(overlay);

    expect(pause).toHaveBeenCalled();
    expect(overlay.querySelector('.pres-video-bg')).toBeNull();
    expect(overlay.classList.contains('pres-video')).toBe(false);
  });
});
