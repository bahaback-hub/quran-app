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

/**
 * Resolve once the browser has painted and presented the current frame.
 *
 * Used to hand the first frame to the static shell in index.html before the
 * startup DOM work (injected panels, launcher hydration) runs. Everything that
 * blocks the commit of that frame is measured as LCP render delay, so waiting
 * here is faster where it counts even though the app starts slightly later.
 *
 * Two frames, not one: the first callback runs before the frame is composited,
 * so work started there still delays its presentation. The second frame starts
 * after the previous one was presented.
 */
export function afterFirstPaint(): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      window.setTimeout(resolve, 0);
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(finish);
      });
    } else {
      finish();
    }
  });
}
