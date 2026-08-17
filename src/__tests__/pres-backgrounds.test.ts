/**
 * Tests for pres-backgrounds.ts — Nature backgrounds, Ken Burns animations,
 * canvas scene management (stars, waves, aurora, particles, rain),
 * and animated background layer operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock i18n module
vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: unknown[]) => key,
}));

// Mock IntersectionObserver — jsdom doesn't implement it
// This mock immediately calls the callback with isIntersecting: true
class MockIntersectionObserver {
  callback: (entries: { isIntersecting: boolean; target: Element }[]) => void;
  static instances: MockIntersectionObserver[] = [];

  constructor(cb: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
    this.callback = cb;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    // Immediately trigger with isIntersecting: true
    Promise.resolve().then(() => {
      this.callback([{ isIntersecting: true, target }]);
    });
  }

  disconnect(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  takeRecords(): [] { return []; }
}

// Install mock before importing the module
(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

import {
  NATURE_BACKGROUNDS,
  getAutoBackground,
  getNatureBgByMood,
  getRandomNatureBg,
  getRandomKenBurns,
  removeAnimatedBgLayer,
  applyAnimatedBg,
  removeSceneCanvas,
  startSceneAnimation,
} from '../pres-backgrounds.js';

describe('NATURE_BACKGROUNDS', () => {
  it('should have 5 background entries', () => {
    expect(NATURE_BACKGROUNDS.length).toBe(5);
  });

  it('should have dawn as first entry', () => {
    expect(NATURE_BACKGROUNDS[0]!.mood).toBe('dawn');
    expect(NATURE_BACKGROUNDS[0]!.src).toContain('dawn');
  });

  it('should have night as last entry', () => {
    expect(NATURE_BACKGROUNDS[4]!.mood).toBe('night');
    expect(NATURE_BACKGROUNDS[4]!.src).toContain('nightsky');
  });

  it('should have all expected moods', () => {
    const moods = NATURE_BACKGROUNDS.map((bg) => bg.mood);
    expect(moods).toContain('dawn');
    expect(moods).toContain('morning');
    expect(moods).toContain('afternoon');
    expect(moods).toContain('sunset');
    expect(moods).toContain('night');
  });

  it('should have src for each background', () => {
    for (const bg of NATURE_BACKGROUNDS) {
      expect(bg.src).toBeTruthy();
      expect(bg.src).toContain('.jpg');
    }
  });

  it('should have label for each background', () => {
    for (const bg of NATURE_BACKGROUNDS) {
      expect(bg.label).toBeTruthy();
    }
  });
});

describe('getAutoBackground', () => {
  it('should return dawn background for early morning hours (4-6)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 5, 0, 0));
    expect(getAutoBackground().mood).toBe('dawn');
    vi.useRealTimers();
  });

  it('should return morning background for morning hours (7-11)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0));
    expect(getAutoBackground().mood).toBe('morning');
    vi.useRealTimers();
  });

  it('should return afternoon background for afternoon hours (12-15)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 14, 0, 0));
    expect(getAutoBackground().mood).toBe('afternoon');
    vi.useRealTimers();
  });

  it('should return sunset background for evening hours (16-18)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 17, 0, 0));
    expect(getAutoBackground().mood).toBe('sunset');
    vi.useRealTimers();
  });

  it('should return night background for night hours (19+)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 21, 0, 0));
    expect(getAutoBackground().mood).toBe('night');
    vi.useRealTimers();
  });

  it('should return night background for late night hours (0-3)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 2, 0, 0));
    expect(getAutoBackground().mood).toBe('night');
    vi.useRealTimers();
  });

  it('should return dawn background at hour 4', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 4, 0, 0));
    expect(getAutoBackground().mood).toBe('dawn');
    vi.useRealTimers();
  });

  it('should return morning background at hour 7', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 7, 0, 0));
    expect(getAutoBackground().mood).toBe('morning');
    vi.useRealTimers();
  });

  it('should return afternoon background at hour 12', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    expect(getAutoBackground().mood).toBe('afternoon');
    vi.useRealTimers();
  });

  it('should return sunset background at hour 16', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 16, 0, 0));
    expect(getAutoBackground().mood).toBe('sunset');
    vi.useRealTimers();
  });
});

describe('getNatureBgByMood', () => {
  it('should return correct background for known moods', () => {
    expect(getNatureBgByMood('dawn')?.mood).toBe('dawn');
    expect(getNatureBgByMood('morning')?.mood).toBe('morning');
    expect(getNatureBgByMood('afternoon')?.mood).toBe('afternoon');
    expect(getNatureBgByMood('sunset')?.mood).toBe('sunset');
    expect(getNatureBgByMood('night')?.mood).toBe('night');
  });

  it('should return null for unknown mood', () => {
    expect(getNatureBgByMood('unknown')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(getNatureBgByMood('')).toBeNull();
  });
});

describe('getRandomNatureBg', () => {
  it('should return a valid background object', () => {
    const bg = getRandomNatureBg();
    expect(bg).toBeDefined();
    expect(bg.mood).toBeTruthy();
    expect(bg.src).toBeTruthy();
  });

  it('should return one of the NATURE_BACKGROUNDS entries', () => {
    const bg = getRandomNatureBg();
    expect(NATURE_BACKGROUNDS).toContain(bg);
  });
});

describe('getRandomKenBurns', () => {
  it('should return a string', () => {
    const anim = getRandomKenBurns();
    expect(typeof anim).toBe('string');
  });

  it('should return a Ken Burns animation name', () => {
    const validNames = ['kenBurns1', 'kenBurns2', 'kenBurns3', 'kenBurns4', 'kenBurns5'];
    const anim = getRandomKenBurns();
    expect(validNames).toContain(anim);
  });

  it('should return various animations over multiple calls', () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(getRandomKenBurns());
    }
    // With 50 tries, we should get at least 2 different values (statistically near-certain)
    expect(results.size).toBeGreaterThanOrEqual(2);
  });
});

describe('removeAnimatedBgLayer', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
  });

  it('should remove existing pres-bg-layer from overlay', () => {
    const layer = document.createElement('div');
    layer.className = 'pres-bg-layer';
    overlay.appendChild(layer);

    expect(overlay.querySelector('.pres-bg-layer')).not.toBeNull();
    removeAnimatedBgLayer(overlay);
    expect(overlay.querySelector('.pres-bg-layer')).toBeNull();
  });

  it('should not throw when no bg layer exists', () => {
    expect(() => removeAnimatedBgLayer(overlay)).not.toThrow();
  });

  it('should not affect other elements in overlay', () => {
    const other = document.createElement('div');
    other.className = 'other-element';
    overlay.appendChild(other);

    removeAnimatedBgLayer(overlay);
    expect(overlay.querySelector('.other-element')).not.toBeNull();
  });
});

describe('applyAnimatedBg', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
  });

  it('should create a pres-bg-layer element', () => {
    applyAnimatedBg(overlay, 'backgrounds/sunset.jpg');
    expect(overlay.querySelector('.pres-bg-layer')).not.toBeNull();
  });

  it('should set background image on the layer', async () => {
    applyAnimatedBg(overlay, 'backgrounds/sunset.jpg');
    // IntersectionObserver is async — wait for microtask
    await new Promise((r) => setTimeout(r, 0));
    const layer = overlay.querySelector('.pres-bg-layer') as HTMLElement;
    expect(layer.style.backgroundImage).toContain('backgrounds/sunset.jpg');
  });

  it('should add a Ken Burns animation class', () => {
    applyAnimatedBg(overlay, 'backgrounds/sunset.jpg');
    const layer = overlay.querySelector('.pres-bg-layer') as HTMLElement;
    const validClasses = ['kenBurns1', 'kenBurns2', 'kenBurns3', 'kenBurns4', 'kenBurns5'];
    const hasKenBurns = validClasses.some((cls) => layer.classList.contains(cls));
    expect(hasKenBurns).toBe(true);
  });

  it('should insert layer as first child', () => {
    const existingChild = document.createElement('div');
    existingChild.className = 'existing';
    overlay.appendChild(existingChild);

    applyAnimatedBg(overlay, 'backgrounds/sunset.jpg');
    expect(overlay.firstChild).not.toBe(existingChild);
    expect((overlay.firstChild as HTMLElement).classList.contains('pres-bg-layer')).toBe(true);
  });

  it('should replace existing bg layer', async () => {
    applyAnimatedBg(overlay, 'backgrounds/dawn.jpg');
    applyAnimatedBg(overlay, 'backgrounds/night.jpg');

    const layers = overlay.querySelectorAll('.pres-bg-layer');
    expect(layers.length).toBe(1);
    const layer = layers[0] as HTMLElement;
    // IntersectionObserver is async — wait for microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(layer.style.backgroundImage).toContain('night.jpg');
  });
});

describe('removeSceneCanvas', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
  });

  it('should remove existing pres-canvas-bg element', () => {
    const canvas = document.createElement('canvas');
    canvas.className = 'pres-canvas-bg';
    overlay.appendChild(canvas);

    expect(overlay.querySelector('.pres-canvas-bg')).not.toBeNull();
    removeSceneCanvas(overlay);
    expect(overlay.querySelector('.pres-canvas-bg')).toBeNull();
  });

  it('should not throw when no canvas exists', () => {
    expect(() => removeSceneCanvas(overlay)).not.toThrow();
  });

  it('should not affect other elements in overlay', () => {
    const other = document.createElement('div');
    other.className = 'other';
    overlay.appendChild(other);

    removeSceneCanvas(overlay);
    expect(overlay.querySelector('.other')).not.toBeNull();
  });
});

describe('startSceneAnimation', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    document.body.appendChild(overlay);
    // Mock canvas 2d context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
      lineCap: '',
      font: '',
      measureText: vi.fn(() => ({ width: 10 })),
      fillText: vi.fn(),
      canvas: { width: 800, height: 600 },
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    removeSceneCanvas(overlay);
    overlay.remove();
  });

  it('should create a canvas element with pres-canvas-bg class', () => {
    startSceneAnimation(overlay, 'stars');
    const canvas = overlay.querySelector('.pres-canvas-bg');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName).toBe('CANVAS');
  });

  it('should set scene data attribute', () => {
    startSceneAnimation(overlay, 'waves');
    const canvas = overlay.querySelector('.pres-canvas-bg');
    expect(canvas?.dataset['scene']).toBe('waves');
  });

  it('should insert canvas as first child of overlay', () => {
    const existing = document.createElement('div');
    overlay.appendChild(existing);
    startSceneAnimation(overlay, 'aurora');
    expect(overlay.firstChild).not.toBe(existing);
  });

  it('should replace existing canvas when called again', () => {
    startSceneAnimation(overlay, 'stars');
    startSceneAnimation(overlay, 'waves');
    const canvases = overlay.querySelectorAll('.pres-canvas-bg');
    expect(canvases.length).toBe(1);
  });

  it('should handle unknown scene IDs gracefully', () => {
    startSceneAnimation(overlay, 'nonexistent');
    const canvas = overlay.querySelector('.pres-canvas-bg');
    expect(canvas).not.toBeNull();
    // No renderer, but canvas still created
  });

  it('should set canvas dimensions to window size', () => {
    startSceneAnimation(overlay, 'particles');
    const canvas = overlay.querySelector('.pres-canvas-bg') as HTMLCanvasElement;
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('should add resize event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    startSceneAnimation(overlay, 'rain');
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('should clean up properly with removeSceneCanvas', () => {
    startSceneAnimation(overlay, 'stars');
    expect(overlay.querySelector('.pres-canvas-bg')).not.toBeNull();
    removeSceneCanvas(overlay);
    expect(overlay.querySelector('.pres-canvas-bg')).toBeNull();
  });

  it('should remove resize listener when canvas is removed', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    startSceneAnimation(overlay, 'stars');
    removeSceneCanvas(overlay);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
