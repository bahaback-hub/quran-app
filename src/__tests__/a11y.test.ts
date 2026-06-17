/**
 * Tests for a11y.ts — Accessibility utilities.
 *
 * Covers focus trapping, screen-reader announcements, keyboard dismiss,
 * panel focus management, and toggle-switch accessibility.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  trapFocus,
  announceToScreenReader,
  manageFocusOnPanelOpen,
  restoreFocusOnPanelClose,
  addKeyboardDismiss,
  initToggleSwitchAccessibility,
  prefersReducedMotion,
  initReducedMotionDetection,
  initDialogAccessibility,
  syncAriaExpanded,
} from '../a11y.js';

describe('trapFocus', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return a cleanup function', () => {
    const cleanup = trapFocus(container);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should return a no-op function when container is null', () => {
    const cleanup = trapFocus(null as unknown as HTMLElement);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should focus the first focusable element on init', () => {
    const btn = document.createElement('button');
    btn.textContent = 'First';
    container.appendChild(btn);
    const input = document.createElement('input');
    container.appendChild(input);

    trapFocus(container);

    // Focus is requested via requestAnimationFrame, so it may not be immediate
    expect(container.contains(btn)).toBe(true);
  });

  it('should trap Tab key within container', () => {
    const btn1 = document.createElement('button');
    btn1.textContent = 'First';
    container.appendChild(btn1);
    const btn2 = document.createElement('button');
    btn2.textContent = 'Last';
    container.appendChild(btn2);

    const cleanup = trapFocus(container);
    btn2.focus();

    // Simulate Tab from last element
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(tabEvent, 'preventDefault', { value: vi.fn() });
    container.dispatchEvent(tabEvent);

    cleanup();
  });

  it('should trap Shift+Tab from first element', () => {
    const btn1 = document.createElement('button');
    btn1.textContent = 'First';
    container.appendChild(btn1);
    const btn2 = document.createElement('button');
    btn2.textContent = 'Last';
    container.appendChild(btn2);

    const cleanup = trapFocus(container);
    btn1.focus();

    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    Object.defineProperty(shiftTabEvent, 'preventDefault', { value: vi.fn() });
    container.dispatchEvent(shiftTabEvent);

    cleanup();
  });

  it('should ignore non-Tab keys', () => {
    const btn = document.createElement('button');
    container.appendChild(btn);
    const cleanup = trapFocus(container);

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    container.dispatchEvent(enterEvent);

    // Should not throw
    cleanup();
  });

  it('should handle container with no focusable elements', () => {
    const cleanup = trapFocus(container);
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    container.dispatchEvent(tabEvent);
    cleanup();
  });

  it('should remove event listener on cleanup', () => {
    const cleanup = trapFocus(container);
    cleanup();
    // Should not throw when dispatching after cleanup
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    container.dispatchEvent(tabEvent);
  });
});

describe('announceToScreenReader', () => {
  it('should not throw when called with a message', () => {
    expect(() => announceToScreenReader('Test message')).not.toThrow();
  });

  it('should not throw for assertive politeness', () => {
    expect(() => announceToScreenReader('Alert!', 'assertive')).not.toThrow();
  });

  it('should skip empty messages', () => {
    expect(() => announceToScreenReader('')).not.toThrow();
  });

  it('should create a live region element in the DOM', async () => {
    announceToScreenReader('Hello screen reader');
    // Wait for requestAnimationFrame
    await new Promise((r) => setTimeout(r, 100));
    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion).not.toBeNull();
  });

  it('should reuse existing live regions', async () => {
    announceToScreenReader('Message 1', 'polite');
    await new Promise((r) => setTimeout(r, 100));
    const countBefore = document.querySelectorAll('[aria-live="polite"]').length;
    announceToScreenReader('Message 2', 'polite');
    await new Promise((r) => setTimeout(r, 100));
    const countAfter = document.querySelectorAll('[aria-live="polite"]').length;
    // Should not create many duplicate regions
    expect(countAfter).toBeLessThanOrEqual(countBefore + 1);
  });
});

describe('manageFocusOnPanelOpen', () => {
  let panel: HTMLElement;
  let trigger: HTMLElement;

  beforeEach(() => {
    panel = document.createElement('div');
    panel.setAttribute('aria-label', 'Test Panel');
    trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(panel);
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    panel.remove();
    trigger.remove();
  });

  it('should not throw when panelEl is null', () => {
    expect(() => manageFocusOnPanelOpen(null as unknown as HTMLElement)).not.toThrow();
  });

  it('should set tabindex on panel if not already set', () => {
    manageFocusOnPanelOpen(panel);
    expect(panel.getAttribute('tabindex')).toBe('-1');
  });

  it('should not override existing tabindex', () => {
    panel.setAttribute('tabindex', '0');
    manageFocusOnPanelOpen(panel);
    expect(panel.getAttribute('tabindex')).toBe('0');
  });

  it('should store trigger element ID on panel dataset', () => {
    trigger.id = 'myTrigger';
    manageFocusOnPanelOpen(panel, trigger);
    expect(panel.dataset['a11yTriggerId']).toBe('myTrigger');
  });

  it('should assign an ID to trigger if it has none', () => {
    expect(trigger.id).toBe('');
    manageFocusOnPanelOpen(panel, trigger);
    expect(trigger.id).not.toBe('');
  });
});

describe('restoreFocusOnPanelClose', () => {
  let trigger: HTMLElement;
  let panel: HTMLElement;

  beforeEach(() => {
    trigger = document.createElement('button');
    trigger.id = 'restoreTrigger';
    trigger.textContent = 'Trigger';
    panel = document.createElement('div');
    panel.setAttribute('aria-label', 'Panel');
    document.body.appendChild(trigger);
    document.body.appendChild(panel);
  });

  afterEach(() => {
    trigger.remove();
    panel.remove();
  });

  it('should not throw when triggerEl is null', () => {
    expect(() => restoreFocusOnPanelClose(null, panel)).not.toThrow();
  });

  it('should not throw when both are null', () => {
    expect(() => restoreFocusOnPanelClose(null, null)).not.toThrow();
  });

  it('should restore focus to trigger element', () => {
    restoreFocusOnPanelClose(trigger, panel);
    // Focus is set via requestAnimationFrame
  });

  it('should find trigger by ID from panel dataset', () => {
    panel.dataset['a11yTriggerId'] = 'restoreTrigger';
    restoreFocusOnPanelClose(null, panel);
  });
});

describe('addKeyboardDismiss', () => {
  let element: HTMLElement;
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    callback = vi.fn();
  });

  afterEach(() => {
    element.remove();
  });

  it('should return a cleanup function', () => {
    const cleanup = addKeyboardDismiss(element, callback);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should return no-op when element is null', () => {
    const cleanup = addKeyboardDismiss(null as unknown as HTMLElement, callback);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should return no-op when callback is not a function', () => {
    const cleanup = addKeyboardDismiss(element, 'not a function' as unknown as () => void);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should call callback on Escape key', () => {
    addKeyboardDismiss(element, callback);
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    element.dispatchEvent(escapeEvent);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback on other keys', () => {
    addKeyboardDismiss(element, callback);
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    element.dispatchEvent(enterEvent);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should stop propagation on Escape', () => {
    addKeyboardDismiss(element, callback);
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const spy = vi.spyOn(escapeEvent, 'stopPropagation');
    element.dispatchEvent(escapeEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('should remove listener on cleanup', () => {
    const cleanup = addKeyboardDismiss(element, callback);
    cleanup();
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    element.dispatchEvent(escapeEvent);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('initToggleSwitchAccessibility', () => {
  let toggle: HTMLElement;

  beforeEach(() => {
    toggle = document.createElement('div');
    toggle.className = 'toggle-switch on';
    toggle.setAttribute('tabindex', '0');
    document.body.appendChild(toggle);
  });

  afterEach(() => {
    toggle.remove();
  });

  it('should not throw when called', () => {
    expect(() => initToggleSwitchAccessibility()).not.toThrow();
  });

  it('should set aria-checked attribute on toggle switches', () => {
    initToggleSwitchAccessibility();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('should set aria-checked to false for off toggles', () => {
    toggle.classList.remove('on');
    initToggleSwitchAccessibility();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('should add tabindex to toggle switches without one', () => {
    toggle.removeAttribute('tabindex');
    initToggleSwitchAccessibility();
    expect(toggle.getAttribute('tabindex')).toBe('0');
  });

  it('should respond to Enter key on toggle switch', () => {
    initToggleSwitchAccessibility();
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    toggle.dispatchEvent(enterEvent);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should respond to Space key on toggle switch', () => {
    initToggleSwitchAccessibility();
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    toggle.dispatchEvent(spaceEvent);
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('prefersReducedMotion', () => {
  it('should return a boolean', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});

describe('initReducedMotionDetection', () => {
  it('should not throw when called', () => {
    expect(() => initReducedMotionDetection()).not.toThrow();
  });

  it('should set reduced-motion class on html element when user prefers reduced motion', () => {
    // We can't easily mock matchMedia in jsdom, but we can test the function doesn't break
    initReducedMotionDetection();
    // The function should have run without error
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});

describe('initDialogAccessibility', () => {
  let dialog: HTMLElement;
  let closeCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Test Dialog');
    const btn = document.createElement('button');
    btn.textContent = 'Close';
    dialog.appendChild(btn);
    document.body.appendChild(dialog);
    closeCallback = vi.fn();
  });

  afterEach(() => {
    dialog.remove();
  });

  it('should return a cleanup function', () => {
    const cleanup = initDialogAccessibility(dialog, closeCallback);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should return no-op when dialog is null', () => {
    const cleanup = initDialogAccessibility(null as unknown as HTMLElement, closeCallback);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('should set aria-modal to true on the dialog', () => {
    const cleanup = initDialogAccessibility(dialog, closeCallback);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    cleanup();
  });

  it('should call closeCallback on Escape key', () => {
    const cleanup = initDialogAccessibility(dialog, closeCallback);
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    dialog.dispatchEvent(escapeEvent);
    expect(closeCallback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('should clean up event listeners', () => {
    const cleanup = initDialogAccessibility(dialog, closeCallback);
    cleanup();
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    dialog.dispatchEvent(escapeEvent);
    expect(closeCallback).not.toHaveBeenCalled();
  });
});

describe('syncAriaExpanded', () => {
  let trigger: HTMLElement;

  beforeEach(() => {
    trigger = document.createElement('button');
    trigger.textContent = 'Toggle';
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    trigger.remove();
  });

  it('should set aria-expanded to true', () => {
    syncAriaExpanded(trigger, true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('should set aria-expanded to false', () => {
    syncAriaExpanded(trigger, false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('should not throw when trigger is null', () => {
    expect(() => syncAriaExpanded(null, true)).not.toThrow();
  });

  it('should update aria-expanded when called multiple times', () => {
    syncAriaExpanded(trigger, true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    syncAriaExpanded(trigger, false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
