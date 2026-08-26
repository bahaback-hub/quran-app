import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRESENTATION_VIDEO_POSTER,
  PRESENTATION_VIDEO_SRC,
  applyPresentationVideo,
  removePresentationVideo,
  retryPresentationVideoPlayback,
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
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
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

  it('switches the local source and poster when a different approved video is selected', () => {
    const overlay = document.createElement('div');
    document.body.append(overlay);

    applyPresentationVideo(overlay, 'alps');

    const video = overlay.querySelector<HTMLVideoElement>('.pres-video-bg');
    expect(overlay.style.backgroundImage).toContain('alps-sunrise-fog-poster.jpg');
    expect(video?.src).toContain('alps-sunrise-fog.mp4');
    expect(video?.dataset['presentationVideo']).toBe('alps');
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
    expect(overlay.classList.contains('pres-video-needs-play')).toBe(true);
    expect(play).not.toHaveBeenCalled();
  });

  it('shows a retry state after autoplay is denied and clears it after an explicit retry', async () => {
    const overlay = document.createElement('div');
    const retryButton = document.createElement('button');
    retryButton.id = 'presVideoRetryBtn';
    retryButton.classList.add('hidden');
    document.body.append(overlay, retryButton);
    play.mockImplementationOnce(() => Promise.reject(new Error('Autoplay blocked'))).mockImplementation(() => Promise.resolve());

    applyPresentationVideo(overlay, 'wave');
    await Promise.resolve();
    await Promise.resolve();

    expect(overlay.classList.contains('pres-video-needs-play')).toBe(true);
    expect(retryButton.classList.contains('hidden')).toBe(false);

    retryPresentationVideoPlayback(overlay);
    await Promise.resolve();
    await Promise.resolve();

    expect(overlay.dataset['presentationVideoForce']).toBe('true');
    expect(overlay.classList.contains('pres-video-needs-play')).toBe(false);
    expect(retryButton.classList.contains('hidden')).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('lets a user explicitly enable motion after a reduced-motion preference kept the poster', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const overlay = document.createElement('div');
    document.body.append(overlay);

    applyPresentationVideo(overlay, 'wave');
    retryPresentationVideoPlayback(overlay);

    expect(overlay.querySelector<HTMLVideoElement>('.pres-video-bg')?.autoplay).toBe(true);
    expect(overlay.dataset['presentationVideoForce']).toBe('true');
    expect(play).toHaveBeenCalledTimes(1);
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
