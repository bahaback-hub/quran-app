/**
 * Player UI chrome and playback UI state helpers.
 *
 * Owns the busy/watchdog state, the play/pause button presentation, the
 * collapsed/expanded shell and the one-time expand hint. Extracted from
 * `audio.ts`; behavior and the public surface are unchanged.
 */
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { storage } from '../../storage.js';
import { showToast } from '../../ui.js';
import { __ } from '../../i18n.js';
import { setTrustedHtml } from '../../safe-html.js';

const PLAY_START_TIMEOUT_MS = 10000;
const EXPAND_HINT_KEY = 'player_expand_hint_seen';
const PLAYER_HINT_DURATION = 6000;

const PLAY_SVG =
  '<svg class="icon icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>';
const PAUSE_SVG =
  '<svg class="icon icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" /><rect x="15" y="4" width="4" height="16" /></svg>';

/** Watchdog for playback requests that never start (silent network hangs). */
let _playWatchdog: ReturnType<typeof setTimeout> | null = null;
/** Pending mp3quran metadata listener, tracked so a timeout can detach it. */
let _pendingMetaHandler: (() => void) | null = null;

/**
 * Reset the audio player UI to the stopped state.
 * Separated from prepareAudioForNewSurah for testability.
 */
export function resetAudioPlayerUI(): void {
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
}

/**
 * Reset a single audio element — pause, remove src, and reload.
 * Pure DOM operation, separated for testability.
 *
 * Revokes any blob: URL currently assigned to the player's src before clearing
 * it, to prevent Blob memory leaks when switching surahs while audio is loaded
 * from the offline cache (resolveAudioUrl returns blob: URLs).
 */
export function resetAudioElement(player: HTMLAudioElement | null): void {
  if (!player) {
    return;
  }
  const oldSrc = player.src;
  if (oldSrc && oldSrc.startsWith('blob:')) {
    URL.revokeObjectURL(oldSrc);
  }
  player.pause();
  player.removeAttribute('src');
  player.load();
}

/** Set playback state to playing and update UI. */
export function setPlayingState(): void {
  state.isPlaying = true;
  document.body.classList.add('audio-playing');
  updatePlayPauseBtn();
}

/** Set playback state to stopped and update UI. */
export function setStoppedState(): void {
  endPlaybackWatchdog();
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
}

/**
 * Mark the play button as busy and arm a watchdog while a fresh playback
 * request is loading. If playback never starts within the timeout (silent
 * network hang), the watchdog stops the attempt and surfaces an error toast.
 */
export function beginPlaybackWatchdog(): void {
  endPlaybackWatchdog();
  dom.playPauseBtn?.classList.add('is-loading');
  dom.playPauseBtn?.setAttribute('aria-busy', 'true');
  _playWatchdog = setTimeout(() => {
    _playWatchdog = null;
    if (_pendingMetaHandler && dom.audioPlayer) {
      dom.audioPlayer.removeEventListener('loadedmetadata', _pendingMetaHandler);
    }
    _pendingMetaHandler = null;
    try {
      dom.audioPlayer?.pause();
    } catch (e) {
      console.warn(e);
    }
    setStoppedState();
    showToast(__('audio_error'), 'error');
  }, PLAY_START_TIMEOUT_MS);
}

/** Clear the busy indicator and cancel any pending playback watchdog. */
export function endPlaybackWatchdog(): void {
  if (_playWatchdog) {
    clearTimeout(_playWatchdog);
    _playWatchdog = null;
  }
  if (_pendingMetaHandler && dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('loadedmetadata', _pendingMetaHandler);
  }
  _pendingMetaHandler = null;
  dom.playPauseBtn?.classList.remove('is-loading');
  dom.playPauseBtn?.removeAttribute('aria-busy');
}

/** Track the mp3quran metadata listener so the watchdog can detach it. */
export function setPendingMetaHandler(handler: (() => void) | null): void {
  _pendingMetaHandler = handler;
}

/**
 * Expand the collapsed audio player and persist the preference to localStorage.
 * Removes the 'collapsed' CSS class from the player element.
 */
export function expandPlayer(): void {
  dom.player?.classList.remove('collapsed');
  document.body.classList.add('player-expanded');
  storage.set('player_collapsed', false);
}

/** Collapse the player and restore the mobile reading controls around it. */
export function collapsePlayer(): void {
  dom.player?.classList.add('collapsed');
  document.body.classList.remove('player-expanded');
  storage.set('player_collapsed', true);
}

/** Show a one-time hint (arrow pulse + message) the first time playback starts. */
export function maybeShowExpandHint(): void {
  if (storage.get(EXPAND_HINT_KEY)) {
    return;
  }
  storage.set(EXPAND_HINT_KEY, '1');
  dom.player?.classList.add('first-play-glow');
  const hint = document.getElementById('playerExpandHint');
  if (hint) {
    hint.hidden = false;
  }
  window.setTimeout(() => {
    dom.player?.classList.remove('first-play-glow');
    const el = document.getElementById('playerExpandHint');
    if (el) {
      el.hidden = true;
    }
  }, PLAYER_HINT_DURATION);
}

/**
 * Update the play/pause button text to reflect current playback state.
 * Reads state.isPlaying and updates the button label accordingly.
 * Also swaps the collapsed floating button icon (it had no pause state).
 */
export function updatePlayPauseBtn(): void {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? __('pause') : __('play');
  }
  if (dom.collapsedPlayBtn) {
    setTrustedHtml(dom.collapsedPlayBtn, state.isPlaying ? PAUSE_SVG : PLAY_SVG);
  }
}
