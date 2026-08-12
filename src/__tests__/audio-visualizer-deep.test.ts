/**
 * Deep coverage tests for audio-visualizer.ts — targets:
 * - drawAnimatedBars internal logic (lines 24-41)
 * - cancelAnimationFrame branch (lines 12-13)
 * - stopVisualizer with active canvas and ctx clear (lines 47-48, 55)
 * - requestAnimationFrame callback execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Create a mock 2D rendering context. */
function createMockCtx(): CanvasRenderingContext2D {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4 * 80 * 80) })),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

describe('audio-visualizer deep coverage — drawAnimatedBars internals', () => {
  let canvas: HTMLCanvasElement;
  let audioPlayer: HTMLAudioElement;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    document.body.innerHTML = '';
    rafCallbacks = new Map();
    nextRafId = 1;
    mockCtx = createMockCtx();

    // Mock requestAnimationFrame to capture callbacks
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    canvas = document.createElement('canvas');
    canvas.id = 'audioVisualizer';
    canvas.width = 200;
    canvas.height = 60;
    // Mock getContext to return our mock context
    canvas.getContext = ((type: string) => {
      if (type === '2d') return mockCtx;
      return null;
    }) as typeof HTMLCanvasElement.prototype.getContext;
    document.body.appendChild(canvas);

    audioPlayer = document.createElement('audio');
    audioPlayer.id = 'audioPlayer';
    document.body.appendChild(audioPlayer);
  });

  afterEach(async () => {
    const { stopVisualizer } = await import('../audio-visualizer.js');
    stopVisualizer();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should call requestAnimationFrame and draw bars via callback', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    startVisualizer(canvas);

    // Simulate one animation frame callback
    const rafCb = rafCallbacks.get(1);
    expect(rafCb).toBeDefined();
    if (rafCb) {
      rafCb(performance.now());
    }

    // Should have cleared and drawn bars
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 200, 60);
    expect(mockCtx.fillRect).toHaveBeenCalled();

    stopVisualizer();
  });

  it('should cancel previous animation when starting again', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

    startVisualizer(canvas);

    // Simulate first frame callback to set _animId
    const rafCb = rafCallbacks.get(1);
    if (rafCb) rafCb(performance.now());

    // Start again — should cancel previous
    startVisualizer(canvas);
    expect(cancelSpy).toHaveBeenCalled();

    stopVisualizer();
  });

  it('should execute drawAnimatedBars with bar calculations (12 bars)', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    startVisualizer(canvas);

    // Execute the RAF callback
    const rafCb = rafCallbacks.get(1);
    if (rafCb) rafCb(performance.now());

    // Should have called fillRect for bars (at least 12 for bars + clearRect call is separate)
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(12);

    stopVisualizer();
  });

  it('should stop visualizer and clear canvas when canvas has active class and ctx', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    startVisualizer(canvas);

    // Execute RAF callback to set _animId
    const rafCb = rafCallbacks.get(1);
    if (rafCb) rafCb(performance.now());

    expect(canvas.classList.contains('active')).toBe(true);

    stopVisualizer();

    expect(canvas.classList.contains('active')).toBe(false);
    // The stopVisualizer should clear the canvas
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
  });

  it('should handle canvas with getContext returning null in drawAnimatedBars', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    const badCanvas = document.createElement('canvas');
    badCanvas.id = 'badCanvas';
    badCanvas.width = 200;
    badCanvas.height = 60;
    badCanvas.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    document.body.appendChild(badCanvas);

    // Should add active class but drawAnimatedBars should return early
    expect(() => startVisualizer(badCanvas)).not.toThrow();

    // The RAF callback should execute without error even with null ctx
    const latestId = Math.max(...Array.from(rafCallbacks.keys()), 0);
    const rafCb = rafCallbacks.get(latestId);
    if (rafCb) {
      expect(() => rafCb(performance.now())).not.toThrow();
    }

    stopVisualizer();
  });

  it('should handle multiple animation frame callbacks in sequence', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    startVisualizer(canvas);

    // Simulate multiple frames
    let cb = rafCallbacks.get(1);
    if (cb) cb(performance.now());

    // After first callback, a new RAF should be registered
    const latestId = Math.max(...Array.from(rafCallbacks.keys()));
    cb = rafCallbacks.get(latestId);
    if (cb) cb(performance.now());

    // Should have drawn multiple frames
    expect(mockCtx.fillRect).toHaveBeenCalled();

    stopVisualizer();
  });

  it('should handle stopVisualizer when no animation is running (no _animId)', async () => {
    const { stopVisualizer } = await import('../audio-visualizer.js');
    expect(() => stopVisualizer()).not.toThrow();
  });

  it('should handle stopVisualizer when active canvas has no context', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    // Create a canvas that returns null for getContext in stopVisualizer
    const testCanvas = document.createElement('canvas');
    testCanvas.id = 'audioVisualizer2';
    testCanvas.width = 200;
    testCanvas.height = 60;
    testCanvas.classList.add('active');
    testCanvas.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Override querySelector to return our canvas
    const origQuerySelector = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
      if (selector === '#audioVisualizer.active') return testCanvas;
      return origQuerySelector(selector);
    });

    document.body.appendChild(testCanvas);

    // Should not throw when ctx is null in stopVisualizer
    expect(() => stopVisualizer()).not.toThrow();

    vi.restoreAllMocks();
  });

  it('should set fillStyle to hsla values for bars', async () => {
    const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');

    const fillStyleValues: string[] = [];

    // Track fillStyle assignments on our mock context
    let currentFillStyle = '';
    Object.defineProperty(mockCtx, 'fillStyle', {
      get: () => currentFillStyle,
      set: (v: string) => {
        currentFillStyle = v;
        fillStyleValues.push(v);
      },
      configurable: true,
    });

    startVisualizer(canvas);

    const rafCb = rafCallbacks.get(1);
    if (rafCb) rafCb(performance.now());

    // Should have set fillStyle to hsla values for bars
    const hslaValues = fillStyleValues.filter((v) => typeof v === 'string' && v.includes('hsla'));
    expect(hslaValues.length).toBeGreaterThan(0);

    stopVisualizer();
  });
});
