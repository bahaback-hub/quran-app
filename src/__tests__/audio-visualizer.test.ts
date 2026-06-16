/**
 * Tests for audio-visualizer.ts — Canvas-based audio visualizer animation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import with fresh module state for each test
describe('audio-visualizer', () => {
  let canvas: HTMLCanvasElement;
  let audioPlayer: HTMLAudioElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();

    canvas = document.createElement('canvas');
    canvas.id = 'audioVisualizer';
    canvas.width = 200;
    canvas.height = 60;
    document.body.appendChild(canvas);

    audioPlayer = document.createElement('audio');
    audioPlayer.id = 'audioPlayer';
    document.body.appendChild(audioPlayer);
  });

  afterEach(async () => {
    const { stopVisualizer } = await import('../audio-visualizer.js');
    stopVisualizer();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /* ===================== startVisualizer ===================== */

  describe('startVisualizer', () => {
    it('should add active class to canvas', async () => {
      const { startVisualizer } = await import('../audio-visualizer.js');
      startVisualizer(canvas);
      expect(canvas.classList.contains('active')).toBe(true);
    });

    it('should return early if canvas is null/undefined', async () => {
      const { startVisualizer } = await import('../audio-visualizer.js');
      expect(() => startVisualizer(null as unknown as HTMLCanvasElement)).not.toThrow();
    });

    it('should return early if audioPlayer element does not exist in DOM', async () => {
      audioPlayer.remove();
      const { startVisualizer } = await import('../audio-visualizer.js');
      startVisualizer(canvas);
      expect(canvas.classList.contains('active')).toBe(false);
    });

    it('should handle canvas with no 2d context gracefully', async () => {
      const { startVisualizer } = await import('../audio-visualizer.js');
      const badCanvas = document.createElement('canvas');
      badCanvas.id = 'badCanvas';
      badCanvas.width = 200;
      badCanvas.height = 60;
      badCanvas.getContext = () => null as unknown as CanvasRenderingContext2D;
      document.body.appendChild(badCanvas);
      // Should add active class but not throw when drawAnimatedBars gets null ctx
      expect(() => startVisualizer(badCanvas)).not.toThrow();
    });
  });

  /* ===================== stopVisualizer ===================== */

  describe('stopVisualizer', () => {
    it('should remove active class from the visualizer canvas', async () => {
      const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');
      startVisualizer(canvas);
      expect(canvas.classList.contains('active')).toBe(true);
      stopVisualizer();
      expect(canvas.classList.contains('active')).toBe(false);
    });

    it('should not throw when no animation is running', async () => {
      const { stopVisualizer } = await import('../audio-visualizer.js');
      expect(() => stopVisualizer()).not.toThrow();
    });

    it('should handle missing active canvas gracefully', async () => {
      const { stopVisualizer } = await import('../audio-visualizer.js');
      canvas.remove();
      expect(() => stopVisualizer()).not.toThrow();
    });
  });

  /* ===================== start/stop cycle ===================== */

  describe('start/stop cycle', () => {
    it('should be able to restart visualizer after stopping', async () => {
      const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');
      startVisualizer(canvas);
      stopVisualizer();
      expect(canvas.classList.contains('active')).toBe(false);
      startVisualizer(canvas);
      expect(canvas.classList.contains('active')).toBe(true);
      stopVisualizer();
    });

    it('should handle multiple start calls without issues', async () => {
      const { startVisualizer, stopVisualizer } = await import('../audio-visualizer.js');
      startVisualizer(canvas);
      startVisualizer(canvas);
      startVisualizer(canvas);
      expect(canvas.classList.contains('active')).toBe(true);
      stopVisualizer();
      expect(canvas.classList.contains('active')).toBe(false);
    });
  });
});
