/** Small scheduling helpers for work that must not compete with first paint. */

/**
 * Run a non-critical task after the browser has had one paint opportunity.
 * The timer after rAF yields once more so the task does not share the initial
 * JavaScript turn with the first frame. The timeout path keeps this safe in
 * WebViews and test environments without requestAnimationFrame.
 */
export function scheduleAfterPaint(task: () => void, delayMs = 0): void {
  const defer = (): void => {
    window.setTimeout(task, delayMs);
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(defer);
  } else {
    defer();
  }
}
