/**
 * Condition-based waits shared by the E2E specs.
 *
 * These replace fixed `page.waitForTimeout(...)` sleeps, which are a source of
 * both flakiness (the sleep is sometimes too short) and slowness (often too
 * long). Each helper waits for an observable signal instead.
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Wait for every CSS animation and transition on the element (and its
 * descendants) to finish. Use after an action that triggers a transition when
 * the next step measures geometry that the transition moves.
 */
export async function waitForAnimations(locator: Locator): Promise<void> {
  await locator.evaluate((el) =>
    Promise.all(
      el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Wait for two animation frames, by which point a synchronous layout change
 * (e.g. after `setViewportSize`) has been laid out and painted.
 */
export async function waitForReflow(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}
