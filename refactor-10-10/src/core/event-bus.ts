/**
 * ================================================================
 * Event Bus — Solves Problem #9
 * ----------------------------------------------------------------
 * Replaces scattered `dom.xBtn?.addEventListener('click', fn)` calls
 * with:
 *   1. Event delegation (one listener on document, dispatches by data-action)
 *   2. AbortController-based cleanup (no memory leaks)
 *   3. Type-safe action registry
 *
 * Benefits:
 *   - Single event listener per type (memory efficient)
 *   - Works for dynamically-injected elements (no re-binding)
 *   - Easy cleanup via AbortController
 *   - Type-safe action names
 * ================================================================
 */

const DEV = import.meta.env?.DEV ?? false;

/** Maps data-action values to handler functions. */
type ActionHandler = (event: Event, target: HTMLElement) => void | Promise<void>;

interface ActionRegistry {
  [action: string]: ActionHandler;
}

class EventBus {
  private readonly actions: ActionRegistry = {};
  private readonly controllers = new Map<string, AbortController>();
  private readonly delegatedEvents = new Set<string>();

  /**
   * Register an action handler.
   * @example
   *   events.on('prev-ayah', () => audio.prevAyah());
   *   // HTML: <button data-action="prev-ayah">...</button>
   */
  on(action: string, handler: ActionHandler): () => void {
    if (this.actions[action] && DEV) {
      console.warn(`[EventBus] Action "${action}" already registered. Overwriting.`);
    }
    this.actions[action] = handler;
    return () => {
      delete this.actions[action];
    };
  }

  /**
   * Register multiple actions at once.
   * @example
   *   events.register({
   *     'prev-ayah': () => audio.prevAyah(),
   *     'next-ayah': () => audio.nextAyah(),
   *     'play-pause': () => audio.togglePlayPause(),
   *   });
   */
  register(actions: ActionRegistry): () => void {
    const cleanups = Object.entries(actions).map(([action, handler]) => this.on(action, handler));
    return () => cleanups.forEach((cleanup) => cleanup());
  }

  /**
   * Delegate an event type to document, dispatching by data-action.
   * Call once per event type (idempotent).
   *
   * @example
   *   events.delegate('click');
   *   events.delegate('change');
   *   events.delegate('input');
   */
  delegate(eventType: string): void {
    if (this.delegatedEvents.has(eventType)) return;
    this.delegatedEvents.add(eventType);

    const controller = new AbortController();
    this.controllers.set(eventType, controller);

    document.addEventListener(
      eventType,
      async (event: Event) => {
        const target = (event.target as HTMLElement)?.closest<HTMLElement>('[data-action]');
        if (!target) return;

        const action = target.dataset['action'];
        if (!action) return;

        const handler = this.actions[action];
        if (!handler) {
          if (DEV) console.warn(`[EventBus] No handler registered for action "${action}".`);
          return;
        }

        try {
          await handler(event, target);
        } catch (err) {
          console.error(`[EventBus] Handler for "${action}" threw:`, err);
          // Optionally show user toast
          toast.show('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.', 'error');
        }
      },
      { signal: controller.signal, passive: eventType !== 'click' },
    );
  }

  /**
   * Programmatically trigger an action (for tests or keyboard shortcuts).
   */
  async trigger(action: string, event?: Event, target?: HTMLElement): Promise<void> {
    const handler = this.actions[action];
    if (!handler) {
      console.warn(`[EventBus] Cannot trigger unknown action "${action}".`);
      return;
    }
    await handler(event ?? new Event('synthetic'), target ?? document.body);
  }

  /** Remove all delegated listeners (cleanup on app shutdown / hot reload). */
  destroy(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.controllers.clear();
    this.delegatedEvents.clear();
    for (const key of Object.keys(this.actions)) {
      delete this.actions[key];
    }
  }

  /** List all registered action names (for debugging). */
  listActions(): string[] {
    return Object.keys(this.actions);
  }
}

/** Singleton instance for the whole app. */
export const events = new EventBus();

// ================================================================
// Helper: Bind non-delegated listeners with auto-cleanup
// ================================================================

/**
 * Bind an event listener with AbortController for easy cleanup.
 * Use for events that CAN'T be delegated (e.g., scroll on a specific element).
 *
 * @example
 *   const cleanup = events.bind(window, 'scroll', updateProgress, { passive: true });
 *   // Later: cleanup();
 */
export function bindEventListener<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Window | Document,
  eventType: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  const controller = new AbortController();
  target.addEventListener(eventType, handler as EventListener, {
    ...options,
    signal: controller.signal,
  });
  return () => controller.abort();
}

/**
 * Bind multiple listeners that share a single AbortController.
 * Use for grouped cleanup (e.g., all listeners for a module).
 *
 * @example
 *   const cleanup = events.bindGroup([
 *     [window, 'scroll', updateProgress],
 *     [window, 'online', handleOnline],
 *     [window, 'offline', handleOffline],
 *   ]);
 *   // Later: cleanup();
 */
export function bindEventListenerGroup(
  listeners: Array<
    [HTMLElement | Window | Document, string, EventListener, AddEventListenerOptions?]
  >,
): () => void {
  const controller = new AbortController();
  for (const [target, type, handler, options] of listeners) {
    target.addEventListener(type, handler, { ...options, signal: controller.signal });
  }
  return () => controller.abort();
}
