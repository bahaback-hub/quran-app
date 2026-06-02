import { dom } from './dom.js';
import { state } from './state.js';

let _animId = null;
let _ctx = null;
let _analyser = null;
let _dataArray = null;

/**
 * Start the visualizer for the current audio player.
 * Uses a single shared AnalyserNode connected once.
 */
export function startVisualizer(canvas) {
  if (!canvas || !dom.audioPlayer) return;
  stopVisualizer();
  const audioEl = dom.audioPlayer;
  if (!audioEl.src) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const actx = state._adhkarAudioCtx || new AudioCtx();
    state._adhkarAudioCtx = actx;
    if (actx.state === 'suspended') actx.resume();
    if (!_analyser) {
      _analyser = actx.createAnalyser();
      _analyser.fftSize = 64;
      const src = actx.createMediaElementSource(audioEl);
      src.connect(_analyser);
      _analyser.connect(actx.destination);
    }
    _dataArray = new Uint8Array(_analyser.frequencyBinCount);
    _ctx = canvas.getContext('2d');
    canvas.classList.add('active');
    drawWaveform(canvas);
  } catch (e) {
    // Already connected or not supported - skip gracefully
  }
}

function drawWaveform(canvas) {
  if (!_ctx || !_analyser) return;
  _animId = requestAnimationFrame(() => drawWaveform(canvas));
  _analyser.getByteFrequencyData(_dataArray);
  const w = canvas.width;
  const h = canvas.height;
  _ctx.clearRect(0, 0, w, h);
  const barCount = _dataArray.length;
  const barW = Math.max(2, w / barCount - 1);
  for (let i = 0; i < barCount; i++) {
    const v = _dataArray[i] / 255;
    const barH = v * h;
    const x = i * (barW + 1);
    const y = h - barH;
    const hue = 30 + v * 20;
    _ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
    _ctx.fillRect(x, y, barW, barH);
  }
}

/** Stop the visualizer animation. */
export function stopVisualizer() {
  if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  if (_ctx) {
    const c = _ctx.canvas;
    if (c) { c.classList.remove('active'); _ctx.clearRect(0, 0, c.width, c.height); }
  }
  _analyser = null;
  _dataArray = null;
  _ctx = null;
}
