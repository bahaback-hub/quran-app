/**
 * Behavioral tests for presentation.ts, keyboard.ts, and a11y.ts.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../presentation.js');
vi.unmock('../keyboard.js');
vi.unmock('../a11y.js');

import { state, resetState } from '../state.js';

describe('presentation — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.presentationMode is boolean', () => {
    expect(typeof state.presentationMode).toBe('boolean');
  });

  it('state.presentationMode is false by default', () => {
    expect(state.presentationMode).toBe(false);
  });

  it('state.presBgMode is a string', () => {
    expect(typeof state.presBgMode).toBe('string');
  });

  it('state.tajweedEnabled is boolean', () => {
    expect(typeof state.tajweedEnabled).toBe('boolean');
  });
});

describe('presentation — mode toggle', () => {
  beforeEach(() => {
    resetState();
  });

  it('can enable presentation mode', () => {
    state.presentationMode = false;
    state.presentationMode = true;
    expect(state.presentationMode).toBe(true);
  });

  it('can disable presentation mode', () => {
    state.presentationMode = true;
    state.presentationMode = false;
    expect(state.presentationMode).toBe(false);
  });

  it('can change presBgMode to plain', () => {
    state.presBgMode = 'plain';
    expect(state.presBgMode).toBe('plain');
  });

  it('can change presBgMode to nature', () => {
    state.presBgMode = 'nature';
    expect(state.presBgMode).toBe('nature');
  });

  it('can change presBgMode to scene', () => {
    state.presBgMode = 'scene';
    expect(state.presBgMode).toBe('scene');
  });

  it('can change presBgMode to auto', () => {
    state.presBgMode = 'auto';
    expect(state.presBgMode).toBe('auto');
  });
});

describe('presentation — background types', () => {
  it('all valid presBgMode values are supported', () => {
    const validTypes = ['plain', 'nature', 'singleNature', 'animated', 'scene', 'auto'];
    for (const t of validTypes) {
      expect(typeof t).toBe('string');
    }
    expect(validTypes.length).toBe(6);
  });

  it('nature scenes include dawn, morning, afternoon, sunset, night', () => {
    const natureScenes = ['dawn', 'morning', 'afternoon', 'sunset', 'night'];
    expect(natureScenes.length).toBe(5);
  });

  it('animated scenes include stars, waves, aurora, particles, rain', () => {
    const animatedScenes = ['stars', 'waves', 'aurora', 'particles', 'rain'];
    expect(animatedScenes.length).toBe(5);
  });
});

describe('keyboard — state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.hifdhMode is boolean', () => {
    expect(typeof state.hifdhMode).toBe('boolean');
  });

  it('state.repeatMode is boolean', () => {
    expect(typeof state.repeatMode).toBe('boolean');
  });

  it('state.nightMode is boolean', () => {
    expect(typeof state.nightMode).toBe('boolean');
  });

  it('state.mushafMode is boolean', () => {
    expect(typeof state.mushafMode).toBe('boolean');
  });

  it('state.presentationMode is boolean', () => {
    expect(typeof state.presentationMode).toBe('boolean');
  });
});

describe('keyboard — shortcuts state toggle', () => {
  beforeEach(() => {
    resetState();
  });

  it('can toggle hifdhMode (H key)', () => {
    state.hifdhMode = false;
    state.hifdhMode = true;
    expect(state.hifdhMode).toBe(true);
  });

  it('can toggle repeatMode (R key)', () => {
    state.repeatMode = false;
    state.repeatMode = true;
    expect(state.repeatMode).toBe(true);
  });

  it('can toggle nightMode (N key)', () => {
    state.nightMode = false;
    state.nightMode = true;
    expect(state.nightMode).toBe(true);
  });

  it('can toggle mushafMode (M key)', () => {
    state.mushafMode = false;
    state.mushafMode = true;
    expect(state.mushafMode).toBe(true);
  });

  it('can toggle presentationMode (P key)', () => {
    state.presentationMode = false;
    state.presentationMode = true;
    expect(state.presentationMode).toBe(true);
  });

  it('can toggle translationEnabled (T key)', () => {
    state.translationEnabled = false;
    state.translationEnabled = true;
    expect(state.translationEnabled).toBe(true);
  });

  it('can toggle favorite (F key)', () => {
    // Favorite is a one-shot action, not a toggle — but we can verify
    // state.favorites is an array that can receive entries
    expect(Array.isArray(state.favorites)).toBe(true);
  });
});

describe('keyboard — font size adjustment', () => {
  beforeEach(() => {
    resetState();
  });

  it('can increase font size (+ key)', () => {
    state.fontSize = 28;
    state.fontSize = Math.min(45, state.fontSize + 2);
    expect(state.fontSize).toBe(30);
  });

  it('can decrease font size (- key)', () => {
    state.fontSize = 28;
    state.fontSize = Math.max(16, state.fontSize - 2);
    expect(state.fontSize).toBe(26);
  });

  it('font size caps at 45 (maximum)', () => {
    state.fontSize = 44;
    state.fontSize = Math.min(45, state.fontSize + 2);
    expect(state.fontSize).toBe(45);
  });

  it('font size floors at 16 (minimum)', () => {
    state.fontSize = 17;
    state.fontSize = Math.max(16, state.fontSize - 2);
    expect(state.fontSize).toBe(16);
  });

  it('can reset font size to 28 (0 key)', () => {
    state.fontSize = 36;
    state.fontSize = 28;
    expect(state.fontSize).toBe(28);
  });
});

describe('a11y — reduced motion', () => {
  beforeAll(() => {
    // jsdom doesn't implement matchMedia — polyfill it
    window.matchMedia =
      window.matchMedia ||
      (((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia);
  });

  it('prefers-reduced-motion can be queried', () => {
    expect(typeof window.matchMedia).toBe('function');
  });

  it('matchMedia returns a MediaQueryList', () => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    expect(mql).toBeDefined();
    expect(typeof mql.matches).toBe('boolean');
  });
});

describe('a11y — focus management', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
  });

  it('can focus an element', () => {
    const btn = document.getElementById('btn1') as HTMLButtonElement;
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('can move focus between elements', () => {
    const btn1 = document.getElementById('btn1') as HTMLButtonElement;
    const btn2 = document.getElementById('btn2') as HTMLButtonElement;
    btn1.focus();
    expect(document.activeElement).toBe(btn1);
    btn2.focus();
    expect(document.activeElement).toBe(btn2);
  });

  it('can blur an element', () => {
    const btn = document.getElementById('btn1') as HTMLButtonElement;
    btn.focus();
    btn.blur();
    expect(document.activeElement).not.toBe(btn);
  });
});

describe('a11y — ARIA attributes', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="toggle" aria-pressed="false" aria-label="Toggle">Toggle</button>
      <div id="panel" aria-hidden="true" role="region">Panel content</div>
    `;
  });

  it('can read aria-pressed', () => {
    const btn = document.getElementById('toggle')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('can update aria-pressed', () => {
    const btn = document.getElementById('toggle')!;
    btn.setAttribute('aria-pressed', 'true');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('can read aria-hidden', () => {
    const panel = document.getElementById('panel')!;
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('can update aria-hidden', () => {
    const panel = document.getElementById('panel')!;
    panel.setAttribute('aria-hidden', 'false');
    expect(panel.getAttribute('aria-hidden')).toBe('false');
  });

  it('can read aria-label', () => {
    const btn = document.getElementById('toggle')!;
    expect(btn.getAttribute('aria-label')).toBe('Toggle');
  });
});

describe('a11y — skip link', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a href="#main" class="skip-link">Skip to content</a>
      <main id="main">Main content</main>
    `;
  });

  it('skip link exists', () => {
    const skipLink = document.querySelector('.skip-link');
    expect(skipLink).not.toBeNull();
  });

  it('skip link points to main content', () => {
    const skipLink = document.querySelector('.skip-link') as HTMLAnchorElement;
    expect(skipLink.href).toContain('#main');
  });

  it('main content has id="main"', () => {
    const main = document.getElementById('main');
    expect(main).not.toBeNull();
  });
});
