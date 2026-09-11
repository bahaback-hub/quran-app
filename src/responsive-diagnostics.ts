/* Responsive diagnostics — internal-only test lens.
 *
 * Activating it is opt-in and fully local: it only runs when the developer
 * explicitly appends `?diag=response` (or `#diag=response`) to the URL. It
 * collects and displays the device metrics that drive the app's responsive
 * layout (CSS viewport width/height, device pixel ratio, screen size,
 * pointer type, orientation, UA) so the reader can verify how the app behaves
 * on a real wide screen, tablet, or TV.
 *
 * Privacy: nothing is collected, transmitted, or persisted. All values stay
 * in the browser, on the device, shown to whoever opened the lens themselves.
 *
 * Enable via main.ts only when the diagnostic secret is present, so normal
 * users never see or load this module.
 */

export interface ResponsiveMetrics {
  viewportWidth: number;
  viewportHeight: number;
  visualViewportWidth: number;
  visualViewportHeight: number;
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  touchPoints: number;
  pointer: string;
  hover: string;
  orientation: string;
  userAgent: string;
  containerWidth: number;
}

/** A single CSS media query resolved to a value. */
export function media(mq: string): string {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(mq).matches ? 'yes' : 'no';
  }
  return 'n/a';
}

/** Collect the responsive metric snapshot. Pure and testable. */
export function collectResponsiveMetrics(el?: Element | null): ResponsiveMetrics {
  const vv = typeof window.visualViewport === 'object' && window.visualViewport ? window.visualViewport : null;
  let containerWidth = 0;
  if (el) {
    containerWidth = el.clientWidth || 0;
  } else if (typeof document !== 'undefined') {
    const container = document.querySelector('.container');
    containerWidth = container ? container.clientWidth || 0 : 0;
  }

  return {
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    visualViewportWidth: vv ? Math.round(vv.width) : 0,
    visualViewportHeight: vv ? Math.round(vv.height) : 0,
    cssWidth: typeof document !== 'undefined' ? document.documentElement.clientWidth : 0,
    cssHeight: typeof document !== 'undefined' ? document.documentElement.clientHeight : 0,
    devicePixelRatio: typeof window !== 'undefined' ? Math.round(window.devicePixelRatio * 1000) / 1000 : 0,
    touchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
    pointer:
      media('(pointer: coarse)') === 'yes'
        ? 'coarse (touch)'
        : media('(pointer: fine)') === 'yes'
          ? 'fine (mouse/pen)'
          : 'none',
    hover: media('(hover: hover)') === 'yes' ? 'hover' : media('(hover: none)') === 'yes' ? 'no-hover' : 'n/a',
    orientation: media('(orientation: portrait)') === 'yes' ? 'portrait' : 'landscape',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    containerWidth,
  };
}

const EMPTY_NOOP = (): void => {
  /* no-op */
};

/**
 * Build a small on-screen panel for the developer.
 * The panel is purely informational; a close button removes it.
 */
export function buildDiagnosticsPanel(
  metrics: ResponsiveMetrics,
  render: (el: HTMLElement, m: ResponsiveMetrics) => void = defaultRender,
): HTMLElement[] {
  const panel = document.createElement('div');
  panel.id = 'responsive-diag-panel';
  panel.style.cssText =
    'position:fixed;inset:auto 12px 12px auto;z-index:2147483000;' +
    'display:flex;flex-direction:column;gap:2px;padding:12px 14px;' +
    'background:#101418f2;color:#e7edf3;border:1px solid #38bdf8;' +
    'border-radius:10px;font:12px ui-monospace,monospace;direction:ltr;' +
    'text-align:left;max-width:min(92vw,360px);box-shadow:0 8px 28px #0006;';

  const head = document.createElement('div');
  head.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;' + 'font-weight:700;gap:12px;color:#38bdf8;';
  head.textContent = 'Responsive diag';
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'إغلاق لوحة الفحص');
  close.textContent = '✕';
  close.style.cssText =
    'border:0;background:#38bdf8;color:#062536;' + 'border-radius:6px;cursor:pointer;font-weight:700;padding:2px 8px;';
  close.addEventListener('click', () => panel.remove());
  head.appendChild(close);

  const body = document.createElement('div');
  body.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:1px 10px;';
  render(body, metrics);

  panel.appendChild(head);
  panel.appendChild(body);
  return [panel];
}

function defaultRender(el: HTMLElement, m: ResponsiveMetrics): void {
  const rows: Array<[string, string]> = [
    ['innerWidth', String(m.viewportWidth)],
    ['innerHeight', String(m.viewportHeight)],
    ['visualViewport', `${m.visualViewportWidth} x ${m.visualViewportHeight}`],
    ['cssViewport', `${m.cssWidth} x ${m.cssHeight}`],
    ['devicePixelRatio', String(m.devicePixelRatio)],
    ['maxTouchPoints', String(m.touchPoints)],
    ['pointer', m.pointer],
    ['hover', m.hover],
    ['orientation', m.orientation],
    ['containerW', String(m.containerWidth)],
    ['<=600px', media('(max-width: 600px)')],
    ['<=900px', media('(max-width: 900px)')],
    ['>=1440px', media('(min-width: 1440px)')],
    ['prefers-reduced-motion', media('(prefers-reduced-motion: reduce)')],
    ['UA', m.userAgent.slice(0, 90)],
  ];
  for (const [k, v] of rows) {
    const key = document.createElement('span');
    key.style.cssText = 'color:#8fa3b3;';
    key.textContent = k + ':';
    const val = document.createElement('span');
    val.textContent = v;
    val.style.cssText = 'overflow-wrap:anywhere;';
    el.appendChild(key);
    el.appendChild(val);
  }
}

/** The secret that opts a session into the diagnostic lens. */
export function diagnosticsRequested(param = 'diag'): boolean {
  const needle = param + '=response';
  if (typeof window === 'undefined') {
    return false;
  }
  const search = window.location.search || window.location.hash;
  return search.includes(needle);
}

/**
 * Mount the diagnostics panel if the secret is present in the URL.
 * Returns a cleanup function; safe to call once per page load.
 */
export function initResponsiveDiagnostics(): () => void {
  if (!diagnosticsRequested()) {
    return EMPTY_NOOP;
  }

  const append = (): void => {
    if (document.getElementById('responsive-diag-panel')) {
      return;
    }
    const container = document.querySelector('.container');
    const built = buildDiagnosticsPanel(collectResponsiveMetrics(container));
    const panel = built[0];
    if (panel) {
      document.body.appendChild(panel);
    }
  };

  const refresh = (): void => {
    const panel = document.getElementById('responsive-diag-panel');
    if (!panel) {
      return;
    }
    const container = document.querySelector('.container');
    const body = panel.querySelector('div:last-child');
    if (body) {
      body.replaceChildren();
    }
    const bodyEl = panel.querySelector('div:last-child') as HTMLElement | null;
    if (bodyEl) {
      defaultRender(bodyEl, collectResponsiveMetrics(container));
    }
  };

  // Initial read after DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', append, { once: true });
  } else {
    append();
  }

  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  if (typeof window.visualViewport === 'object' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', refresh);
  }

  return () => {
    window.removeEventListener('resize', refresh);
    window.removeEventListener('orientationchange', refresh);
    if (typeof window.visualViewport === 'object' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', refresh);
    }
  };
}
