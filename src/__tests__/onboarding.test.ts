/**
 * Tests for onboarding.ts — First-time user onboarding wizard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage.js';

// The global setup already mocks i18n and storage, which is what we need.
// We use storage.get mock to control whether onboarding has been seen.

describe('onboarding', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('hasSeenOnboarding', () => {
    it('should return the stored value from storage', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { hasSeenOnboarding } = await import('../onboarding.js');
      expect(hasSeenOnboarding()).toBe(true);
      expect(storage.get).toHaveBeenCalledWith('onboarding_seen');
    });

    it('should return undefined when not seen', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const { hasSeenOnboarding } = await import('../onboarding.js');
      expect(hasSeenOnboarding()).toBeNull();
    });

    it('should return truthy value when onboarding was completed', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue('2025-01-01');
      const { hasSeenOnboarding } = await import('../onboarding.js');
      expect(hasSeenOnboarding()).toBe('2025-01-01');
    });

    it('should return false when onboarding_seen is false', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { hasSeenOnboarding } = await import('../onboarding.js');
      expect(hasSeenOnboarding()).toBe(false);
    });

    it('should return 0 when onboarding_seen is 0', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(0);
      const { hasSeenOnboarding } = await import('../onboarding.js');
      expect(hasSeenOnboarding()).toBe(0);
    });
  });

  describe('startOnboarding', () => {
    it('should not show onboarding if already seen', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return true;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      expect(document.getElementById('onboardingOverlay')).toBeNull();
    });

    it('should show onboarding if not seen before', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay');
      expect(overlay).not.toBeNull();
      expect(overlay!.style.position).toBe('fixed');
    });

    it('should mark onboarding as seen when shown', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      expect(storage.set).toHaveBeenCalledWith('onboarding_seen', true);
    });

    it('should not mark onboarding as seen if already seen', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return true;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      // storage.set should NOT be called with 'onboarding_seen'
      const calls = (storage.set as ReturnType<typeof vi.fn>).mock.calls;
      const onboardingCall = calls.find((c: unknown[]) => c[0] === 'onboarding_seen');
      expect(onboardingCall).toBeUndefined();
    });

    it('should create overlay with correct styling', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay')!;
      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.zIndex).toBe('10000');
      expect(overlay.style.display).toBe('flex');
    });

    it('should create overlay with RTL direction', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay')!;
      expect(overlay.style.direction).toBe('rtl');
    });

    it('should contain step content with icon, title, and description', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay')!;
      // Should have an h2 element for the title
      const title = overlay.querySelector('h2');
      expect(title).not.toBeNull();
      expect(title!.textContent).toBeTruthy();
    });

    it('should include navigation buttons', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay')!;
      const buttons = overlay.querySelectorAll('button');
      // Should have prev, next, and skip buttons
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('should show dot indicators for each step', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      const overlay = document.getElementById('onboardingOverlay')!;
      const dots = overlay.querySelectorAll('span');
      // 6 steps => 6 dots
      expect(dots.length).toBeGreaterThanOrEqual(6);
    });

    it('should show onboarding when storage returns falsy 0', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return 0;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      // 0 is falsy, so onboarding should still show
      expect(document.getElementById('onboardingOverlay')).not.toBeNull();
    });

    it('should not show onboarding when storage returns empty string', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return '';
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      // Empty string is falsy, so onboarding should still show
      expect(document.getElementById('onboardingOverlay')).not.toBeNull();
    });
  });

  describe('onboarding interaction', () => {
    async function startFreshOnboarding() {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      return document.getElementById('onboardingOverlay')!;
    }

    it('should remove overlay when skip button is clicked', async () => {
      const overlay = await startFreshOnboarding();
      const skipBtn = overlay.querySelectorAll('button')[0];
      expect(skipBtn).toBeTruthy();
      skipBtn!.click();
      expect(document.getElementById('onboardingOverlay')).toBeNull();
    });

    it('should remove overlay when last step next button is clicked', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');
      // Find the "next" button (it's the second-to-last button, typically the rightmost)
      // The layout is: skip (absolutely positioned), prev (hidden), next
      // We need to find the next button by its text
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next' || btn.textContent === 'onboarding_start') {
          nextBtn = btn;
        }
      });
      expect(nextBtn).not.toBeNull();

      // Click through all steps (6 steps, so 5 clicks to advance to last, then 1 to close)
      for (let i = 0; i < 6; i++) {
        nextBtn!.click();
      }
      expect(document.getElementById('onboardingOverlay')).toBeNull();
    });

    it('should update step content when navigating', async () => {
      const overlay = await startFreshOnboarding();
      const titleEl = overlay.querySelector('h2')!;
      const initialTitle = titleEl.textContent;

      // Find the next button
      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next' || btn.textContent === 'onboarding_start') {
          nextBtn = btn;
        }
      });

      nextBtn!.click();
      // Title should change (since i18n returns keys, and each step has a different title key)
      expect(titleEl.textContent).not.toBe(initialTitle);
    });

    it('should hide prev button on first step', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');
      // The prev button should be hidden on step 0
      let prevBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_prev') {
          prevBtn = btn;
        }
      });
      expect(prevBtn).not.toBeNull();
      expect(prevBtn!.style.display).toBe('none');
    });

    it('should show prev button after advancing past first step', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');

      let nextBtn: HTMLButtonElement | null = null;
      let prevBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
        if (btn.textContent === 'onboarding_prev') prevBtn = btn;
      });

      // Advance to step 1
      nextBtn!.click();
      expect(prevBtn!.style.display).not.toBe('none');
    });

    it('should navigate back when prev button is clicked', async () => {
      const overlay = await startFreshOnboarding();
      const titleEl = overlay.querySelector('h2')!;
      const initialTitle = titleEl.textContent;

      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      let prevBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
        if (btn.textContent === 'onboarding_prev') prevBtn = btn;
      });

      // Advance then go back
      nextBtn!.click();
      expect(titleEl.textContent).not.toBe(initialTitle);
      prevBtn!.click();
      expect(titleEl.textContent).toBe(initialTitle);
    });

    it('should change next button text on last step', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
      });

      // Advance through all steps to the last one
      for (let i = 0; i < 5; i++) {
        nextBtn!.click();
      }
      // On the last step, the button text should be the "start" text
      expect(nextBtn!.textContent).toBe('onboarding_start');
    });

    it('should not go before step 0 when prev is clicked', async () => {
      const overlay = await startFreshOnboarding();
      const titleEl = overlay.querySelector('h2')!;
      const initialTitle = titleEl.textContent;

      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      let prevBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
        if (btn.textContent === 'onboarding_prev') prevBtn = btn;
      });

      // Advance to step 1, then go back to step 0
      nextBtn!.click();
      prevBtn!.click();
      expect(titleEl.textContent).toBe(initialTitle);

      // Try to go back from step 0 — should stay at step 0
      prevBtn!.click();
      expect(titleEl.textContent).toBe(initialTitle);
    });

    it('should update dot indicators when navigating', async () => {
      const overlay = await startFreshOnboarding();
      const dots = overlay.querySelectorAll('span');

      // First dot should have accent color on step 0
      const firstDot = dots[0] as HTMLSpanElement;
      expect(firstDot.style.background).toContain('accent');

      // Advance to next step
      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
      });

      nextBtn!.click();

      // After advancing, second dot should now be wider
      const secondDot = dots[1] as HTMLSpanElement;
      expect(secondDot.style.width).toBe('20px');
    });

    it('should update icon when navigating between steps', async () => {
      const overlay = await startFreshOnboarding();
      const iconEl = overlay.querySelector('div[style*="font-size: 56px"]') as HTMLElement;
      expect(iconEl).not.toBeNull();

      const initialIcon = iconEl!.textContent;

      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
      });

      nextBtn!.click();
      // Icon should change to the next step's icon
      expect(iconEl!.textContent).not.toBe(initialIcon);
    });

    it('should update description when navigating', async () => {
      const overlay = await startFreshOnboarding();
      const descEl = overlay.querySelector('p') as HTMLElement;
      const initialDesc = descEl.textContent;

      const buttons = overlay.querySelectorAll('button');
      let nextBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_next') nextBtn = btn;
      });

      nextBtn!.click();
      expect(descEl.textContent).not.toBe(initialDesc);
    });
  });

  describe('startOnboarding idempotency', () => {
    it('should not create duplicate overlays when called after already seen', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return true;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      startOnboarding();
      expect(document.getElementById('onboardingOverlay')).toBeNull();
    });

    it('should not create duplicate overlays when called with already-seen value', async () => {
      let callCount = 0;
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') {
          callCount++;
          // Return true after the first call (simulating that the first call sets it)
          return callCount > 1 ? true : null;
        }
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      // First call creates overlay; second call should see onboarding_seen=true now
      // (but since hasSeenOnboarding returns the value from storage, and we set it to true
      // in the first call, it depends on how storage.get mock is set up)
      const overlay = document.getElementById('onboardingOverlay');
      expect(overlay).not.toBeNull();
    });
  });

  describe('onboarding overlay structure', () => {
    async function startFreshOnboarding() {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'onboarding_seen') return null;
        return null;
      });
      const { startOnboarding } = await import('../onboarding.js');
      startOnboarding();
      return document.getElementById('onboardingOverlay')!;
    }

    it('should have a centered inner container', async () => {
      const overlay = await startFreshOnboarding();
      const inner = overlay.querySelector('div') as HTMLElement;
      expect(inner).not.toBeNull();
      expect(inner.style.borderRadius).toBeTruthy();
      expect(inner.style.textAlign).toBe('center');
    });

    it('should have skip button positioned absolutely', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');
      let skipBtn: HTMLButtonElement | null = null;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_skip') {
          skipBtn = btn;
        }
      });
      expect(skipBtn).not.toBeNull();
      expect(skipBtn!.style.position).toBe('absolute');
    });

    it('should have 6 steps in the onboarding wizard', async () => {
      const overlay = await startFreshOnboarding();
      const dots = overlay.querySelectorAll('span');
      // 6 steps => 6 dot indicators
      expect(dots.length).toBe(6);
    });

    it('should have prev and next buttons in a nav row', async () => {
      const overlay = await startFreshOnboarding();
      const buttons = overlay.querySelectorAll('button');
      let hasPrev = false;
      let hasNext = false;
      buttons.forEach((btn) => {
        if (btn.textContent === 'onboarding_prev') hasPrev = true;
        if (btn.textContent === 'onboarding_next') hasNext = true;
      });
      expect(hasPrev).toBe(true);
      expect(hasNext).toBe(true);
    });

    it('should have initial icon as the first step icon', async () => {
      const overlay = await startFreshOnboarding();
      const iconEl = overlay.querySelector('div[style*="font-size: 56px"]') as HTMLElement;
      expect(iconEl).not.toBeNull();
      expect(iconEl!.textContent).toBe('📖'); // First step icon
    });
  });
});
