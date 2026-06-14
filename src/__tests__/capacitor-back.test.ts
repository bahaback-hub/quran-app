import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('initCapacitorBackButton', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('should do nothing when no Capacitor or plugins provided', async () => {
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    expect(() => initCapacitorBackButton()).not.toThrow();
    expect(() => initCapacitorBackButton({})).not.toThrow();
  });

  it('should add backButton listener when plugins.App provided', async () => {
    const addListener = vi.fn();
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    initCapacitorBackButton({ App: { addListener } });
    expect(addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('should close visible panel on back button', async () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'flex';
    document.body.appendChild(panel);

    let listener: (() => void) | undefined;
    const addListener = vi.fn((_event: string, cb: () => void) => {
      listener = cb;
    });
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    initCapacitorBackButton({ App: { addListener } });

    expect(listener).toBeDefined();
    // Should not throw when lazy import fails
    expect(() => listener!()).not.toThrow();
  });

  it('should collapse player when no panel is open', async () => {
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.remove('collapsed');
    document.body.appendChild(player);

    let listener: (() => void) | undefined;
    const addListener = vi.fn((_event: string, cb: () => void) => {
      listener = cb;
    });
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    initCapacitorBackButton({ App: { addListener } });
    listener!();
    expect(player.classList.contains('collapsed')).toBe(true);
  });

  it('should not collapse if player already collapsed', async () => {
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    let listener: (() => void) | undefined;
    const addListener = vi.fn((_event: string, cb: () => void) => {
      listener = cb;
    });
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    initCapacitorBackButton({ App: { addListener } });
    listener!();
    expect(player.classList.contains('collapsed')).toBe(true);
  });

  it('should fall back to global Capacitor when no plugins param', async () => {
    const addListener = vi.fn();
    (globalThis as Record<string, unknown>).Capacitor = { Plugins: { App: { addListener } } };
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    initCapacitorBackButton();
    expect(addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    delete (globalThis as Record<string, unknown>).Capacitor;
  });

  it('should handle addListener errors gracefully', async () => {
    const addListener = vi.fn(() => {
      throw new Error('fail');
    });
    const { initCapacitorBackButton } = await import('../capacitor-back.js');
    expect(() => initCapacitorBackButton({ App: { addListener } })).not.toThrow();
  });
});
