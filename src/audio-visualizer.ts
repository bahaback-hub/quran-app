let _animId: number | null = null;

/**
 * Start a visualizer animation on the given canvas using time-based bars
 * (does NOT use Web Audio API, so it won't interfere with audio output).
 */
export function startVisualizer(canvas: HTMLCanvasElement): void {
  if (!canvas || !document.getElementById('audioPlayer')) return;
  if (_animId) {
    cancelAnimationFrame(_animId);
    _animId = null;
  }
  canvas.classList.add('active');
  drawAnimatedBars(canvas);
}

function drawAnimatedBars(canvas: HTMLCanvasElement): void {
  const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!ctx) return;
  const w: number = canvas.width;
  const h: number = canvas.height;
  const barCount: number = 12;
  const barW: number = Math.max(2, w / barCount - 2);
  _animId = requestAnimationFrame(() => drawAnimatedBars(canvas));
  ctx.clearRect(0, 0, w, h);
  for (let i: number = 0; i < barCount; i++) {
    // Pseudo-random height based on time + index for a lively feel
    const v: number =
      (Math.sin(Date.now() / 200 + i * 1.5) * 0.5 + 0.5) * 0.6 +
      (Math.sin(Date.now() / 350 + i * 2.3) * 0.5 + 0.5) * 0.4;
    const barH: number = Math.max(2, v * h * 0.9);
    const x: number = i * (barW + 2);
    const y: number = h - barH;
    const hue: number = 30 + v * 20;
    ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
    ctx.fillRect(x, y, barW, barH);
  }
}

/** Stop the visualizer animation. */
export function stopVisualizer(): void {
  if (_animId) {
    cancelAnimationFrame(_animId);
    _animId = null;
  }
  const c = document.querySelector('#audioVisualizer.active') as unknown as HTMLCanvasElement | null;
  if (c) {
    c.classList.remove('active');
    const ctx: CanvasRenderingContext2D | null = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }
}
