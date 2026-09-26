/**
 * Audio — pitch / reference frequency + Web Audio graph.
 *
 * Reference-frequency tuning (default concert pitch 440Hz, presets 432/528/
 * 550Hz, custom 400-600Hz slider). Implemented as the classic "tape speed"
 * effect: effectiveRate = speed × (freq/440) with preservesPitch = false,
 * so pitch and tempo move together — no server processing needed.
 * An AudioContext graph (MediaElementSource pass-through) is built lazily
 * ONLY for CORS-clean hosts: routing a tainted (non-CORS) stream would
 * silence the output, so other hosts keep the direct element path, which
 * sounds identical (the graph carries no effect nodes yet).
 */

import { dom } from '../../dom.js';
import { storage } from '../../storage.js';

const PITCH_DEFAULT_FREQ = 440;
const PITCH_MIN_FREQ = 400;
const PITCH_MAX_FREQ = 600;
const PITCH_STORAGE_KEY = 'pitch_freq';

let _audioCtx: AudioContext | null = null;
let _mediaSrc: MediaElementAudioSourceNode | null = null;
/** Per-origin CORS probe results (true = safe to route through the graph). */
const _corsProbeCache = new Map<string, boolean>();

/** Current reference frequency in Hz (persisted). */
export function getPitchFreq(): number {
  const stored = storage.get<number>(PITCH_STORAGE_KEY);
  return typeof stored === 'number' && stored >= PITCH_MIN_FREQ && stored <= PITCH_MAX_FREQ
    ? Math.round(stored)
    : PITCH_DEFAULT_FREQ;
}

/** pitchRatio = target/440 — the multiplier applied on top of playback speed. */
export function pitchRatio(freq?: number): number {
  const f = freq ?? getPitchFreq();
  return f / PITCH_DEFAULT_FREQ;
}

/** Effective element rate combining user speed and pitch ratio. */
export function getEffectiveRate(): number {
  const speed = parseFloat(storage.get<string>('playback_speed') || '1') || 1;
  return speed * pitchRatio();
}

/** Apply the effective rate + preservesPitch to the live element (no restart).
 * Optional overrides skip the storage round-trip so UI handlers stay
 * deterministic even when storage is unavailable. */
export function applyPlaybackRate(speed?: number, freq?: number): void {
  if (!dom.audioPlayer) {
    return;
  }
  const s = speed ?? (parseFloat(storage.get<string>('playback_speed') || '1') || 1);
  const f = freq ?? getPitchFreq();
  try {
    dom.audioPlayer.playbackRate = s * (f / PITCH_DEFAULT_FREQ);
  } catch {
    /* some engines reject rate writes on an unloaded element — UI still syncs below */
  }
  // preservesPitch=false lets the rate shift the actual pitch; restore the
  // browser default when tuned back to 440Hz.
  const preserves = f === PITCH_DEFAULT_FREQ;
  try {
    (dom.audioPlayer as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = preserves;
    (dom.audioPlayer as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = preserves;
  } catch {
    /* older engines ignore it — rate still applies */
  }
  syncPitchControls();
}

/** Keep the select + slider UI in sync with the stored frequency. */
export function syncPitchControls(): void {
  const freq = getPitchFreq();
  if (dom.pitchSelect) {
    dom.pitchSelect.value = String(freq);
  }
  if (dom.pitchRange) {
    dom.pitchRange.value = String(freq);
  }
}

/**
 * Set the reference frequency: persist, re-apply live, sync UI.
 * Returns the stored value.
 */
export function setPitchFreq(freq: number): number {
  const clamped = Math.min(PITCH_MAX_FREQ, Math.max(PITCH_MIN_FREQ, Math.round(freq)));
  storage.set(PITCH_STORAGE_KEY, clamped);
  applyPlaybackRate(undefined, clamped);
  return clamped;
}

/** True when a URL can be routed through Web Audio without tainting. */
async function isHostCorsClean(url: string): Promise<boolean> {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol === 'blob:' || u.protocol === 'data:' || u.origin === window.location.origin) {
      return true;
    }
    const cached = _corsProbeCache.get(u.origin);
    if (cached !== undefined) {
      return cached;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      mode: 'cors',
      signal: AbortSignal.timeout(5000),
    });
    const ok = res.ok || res.status === 206;
    _corsProbeCache.set(u.origin, ok);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Lazily build the AudioContext graph (created on user gesture so autoplay
 * policies allow it). Must only be called for CORS-clean hosts — routing a
 * tainted stream would silence the output. Safe no-op when Web Audio is
 * unavailable (e.g. jsdom). The direct element path sounds identical
 * (the graph carries no effect nodes yet; it is scaffolding for the future).
 */
export function ensureAudioGraph(): boolean {
  if (typeof AudioContext === 'undefined' || !dom.audioPlayer) {
    return false;
  }
  try {
    _audioCtx ??= new AudioContext();
    if (_audioCtx.state === 'suspended') {
      void _audioCtx.resume();
    }
    if (!_mediaSrc) {
      _mediaSrc = _audioCtx.createMediaElementSource(dom.audioPlayer);
      _mediaSrc.connect(_audioCtx.destination);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepare the element for a new source URL. Awaits the per-origin CORS probe
 * (cached after the first byte-range request) BEFORE src is assigned, because
 * crossOrigin only takes effect on the fetch that starts after it is set.
 * Clean hosts load with CORS and join the graph; other hosts keep the plain
 * path so playback can never go silent. If the element was already routed
 * for an earlier clean host, crossOrigin stays on: a later non-clean host
 * then fails loudly through the existing error/retry path instead of
 * silently.
 */
export async function prepareElementForUrl(url: string): Promise<void> {
  if (!dom.audioPlayer || typeof AudioContext === 'undefined') {
    return;
  }
  const clean = await isHostCorsClean(url);
  if (!dom.audioPlayer) {
    return;
  }
  try {
    if (clean) {
      dom.audioPlayer.crossOrigin = 'anonymous';
      ensureAudioGraph();
    } else if (!_mediaSrc) {
      dom.audioPlayer.removeAttribute('crossOrigin');
    }
  } catch {
    /* keep direct playback */
  }
}

/** Test hook: reset the CORS probe cache and graph handles. */
export function _resetPitchForTests(): void {
  _corsProbeCache.clear();
  _audioCtx = null;
  _mediaSrc = null;
}
