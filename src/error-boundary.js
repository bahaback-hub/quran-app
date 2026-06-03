/**
 * Global Error Boundary for Quran App.
 *
 * Catches three categories of runtime errors:
 *   1. Synchronous JS errors        → window.onerror
 *   2. Unhandled Promise rejections → window.onunhandledrejection
 *   3. Resource load failures        → window.addEventListener('error', capture)
 *
 * For each error the boundary:
 *   - Logs a structured entry to the console for debugging
 *   - Shows a user-friendly toast (non-intrusive)
 *   - Shows a recovery overlay if the error is critical
 *   - Keeps an in-memory error log (capped at 50 entries) for diagnostics
 */

/* ===================== CONFIG ===================== */

const MAX_LOG_ENTRIES = 50;
const TOAST_DEBOUNCE_MS = 3000;

/* ===================== STATE ===================== */

/** @type {Array<{timestamp:number, type:string, message:string, source?:string, line?:number, col?:number, stack?:string}>} */
const errorLog = [];

/** @type {number|null} */
let _lastToastTime = null;

/** Is the recovery overlay currently visible? */
let _recoveryVisible = false;

/* ===================== LOGGING ===================== */

/**
 * Push a structured error entry and trim old entries.
 * @param {{type:string, message:string, source?:string, line?:number, col?:number, stack?:string}} entry
 */
function logError(entry) {
  errorLog.push({ timestamp: Date.now(), ...entry });
  if (errorLog.length > MAX_LOG_ENTRIES) errorLog.splice(0, errorLog.length - MAX_LOG_ENTRIES);
  // Structured console output
  console.error(`[ErrorBoundary][${entry.type}]`, entry.message, entry.stack || '');
}

/**
 * Return a copy of the current error log.
 * @returns {Array<object>}
 */
export function getErrorLog() {
  return [...errorLog];
}

/**
 * Clear the in-memory error log.
 */
export function clearErrorLog() {
  errorLog.length = 0;
}

/* ===================== USER NOTIFICATIONS ===================== */

/**
 * Show a debounced toast so rapid errors don't flood the UI.
 * @param {string} msg
 */
function showDebouncedToast(msg) {
  const now = Date.now();
  if (_lastToastTime && now - _lastToastTime < TOAST_DEBOUNCE_MS) return;
  _lastToastTime = now;
  try {
    // Use dynamic import to avoid circular dependency at module level.
    // showToast is safe to call after app init.
    const { showToast } = require('./ui.js');
    showToast(msg, 'error');
  } catch {
    // Fallback: use DOM directly if module import fails
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = 'toast show error';
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  }
}

/* ===================== RECOVERY OVERLAY ===================== */

/**
 * Show a full-screen recovery overlay for critical errors.
 * This is rendered with inline styles because the error may have
 * occurred before CSS fully loaded or may have broken the app shell.
 */
function showRecoveryOverlay(errorMsg) {
  if (_recoveryVisible) return;
  _recoveryVisible = true;

  // Don't create duplicate overlays
  if (document.getElementById('errorRecoveryOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'errorRecoveryOverlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-label', 'حدث خطأ في التطبيق');
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999999;
                display:flex;align-items:center;justify-content:center;
                font-family:system-ui,-apple-system,sans-serif;direction:rtl;">
      <div style="background:#1e1e2e;color:#e0e0e0;border-radius:16px;padding:32px;
                  max-width:420px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5);">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h2 style="margin:0 0 12px;font-size:20px;color:#f87171;">حدث خطأ غير متوقع</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.6;">
          واجه التطبيق مشكلة غير متوقعة. يمكنك إعادة التحميل أو العودة للصفحة الرئيسية.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button id="errorRecoveryReload" style="padding:10px 24px;border-radius:8px;border:none;
                  background:#6366f1;color:#fff;font-size:15px;cursor:pointer;font-weight:600;">
            🔄 إعادة تحميل
          </button>
          <button id="errorRecoveryHome" style="padding:10px 24px;border-radius:8px;border:none;
                  background:#374151;color:#e0e0e0;font-size:15px;cursor:pointer;font-weight:600;">
            🏠 الصفحة الرئيسية
          </button>
          <button id="errorRecoveryCopy" style="padding:10px 24px;border-radius:8px;border:none;
                  background:#1f2937;color:#9ca3af;font-size:14px;cursor:pointer;">
            📋 نسخ تفاصيل الخطأ
          </button>
        </div>
        <details style="margin-top:20px;text-align:right;cursor:pointer;">
          <summary style="color:#6b7280;font-size:13px;">تفاصيل تقنية</summary>
          <pre id="errorRecoveryDetails" style="margin-top:8px;padding:12px;background:#111827;
               border-radius:8px;overflow-x:auto;font-size:12px;color:#f87171;
               white-space:pre-wrap;word-break:break-all;direction:ltr;text-align:left;
               max-height:200px;overflow-y:auto;">${escapeForHtml(errorMsg)}</pre>
        </details>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Bind recovery buttons
  document.getElementById('errorRecoveryReload')?.addEventListener('click', () => location.reload());
  document.getElementById('errorRecoveryHome')?.addEventListener('click', () => {
    overlay.remove();
    _recoveryVisible = false;
    window.location.hash = '';
    location.reload();
  });
  document.getElementById('errorRecoveryCopy')?.addEventListener('click', () => {
    const details = document.getElementById('errorRecoveryDetails')?.textContent || '';
    navigator.clipboard?.writeText(details).then(() => {
      const btn = document.getElementById('errorRecoveryCopy');
      if (btn) btn.textContent = '✅ تم النسخ';
    }).catch(() => {});
  });
}

/**
 * Minimal HTML escaper for the recovery overlay (no dependency on utils.js).
 * @param {string} str
 * @returns {string}
 */
function escapeForHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===================== ERROR CLASSIFICATION ===================== */

/**
 * Determine if an error is "critical" (should show recovery overlay)
 * vs "non-critical" (toast only).
 *
 * Critical = likely broke the entire app shell or rendering.
 * Non-critical = a feature failed but the app is still usable.
 *
 * @param {string} message
 * @param {string} [source]
 * @returns {boolean}
 */
function isCriticalError(message, source) {
  if (!message) return false;
  const msg = message.toLowerCase();
  // Rendering / DOM errors that break the UI
  if (msg.includes('cannot read properties of null') && (msg.includes('dom') || msg.includes('element'))) return true;
  if (msg.includes('cannot read properties of undefined') && (msg.includes('dom') || msg.includes('element'))) return true;
  // Bootstrap / init errors
  if (source && source.includes('app.js')) return true;
  if (source && source.includes('main.js')) return true;
  // Stack overflow
  if (msg.includes('maximum call stack')) return true;
  // Out of memory
  if (msg.includes('out of memory')) return true;
  return false;
}

/* ===================== HANDLERS ===================== */

/**
 * Handler for synchronous JS errors.
 * @param {string} message
 * @param {string} [source]
 * @param {number} [lineno]
 * @param {number} [colno]
 * @param {Error} [error]
 * @returns {boolean} true = error handled, prevent default browser handler
 */
function handleOnError(message, source, lineno, colno, error) {
  logError({
    type: 'sync',
    message: String(message),
    source: source || undefined,
    line: lineno || undefined,
    col: colno || undefined,
    stack: error?.stack || undefined,
  });

  if (isCriticalError(String(message), source)) {
    showRecoveryOverlay(error?.stack || message);
  } else {
    showDebouncedToast('⚠️ حدث خطأ غير متوقع');
  }

  return true; // Prevent default browser error handling
}

/**
 * Handler for unhandled Promise rejections.
 * @param {PromiseRejectionEvent} event
 */
function handleUnhandledRejection(event) {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;

  logError({
    type: 'promise',
    message,
    stack,
  });

  // Network / API errors → toast only, never critical overlay
  const msgLower = message.toLowerCase();
  if (
    msgLower.includes('fetch') ||
    msgLower.includes('network') ||
    msgLower.includes('failed to fetch') ||
    msgLower.includes('networkerror') ||
    msgLower.includes('load failed') ||
    msgLower.includes('err_internet_disconnected') ||
    msgLower.includes('net::err')
  ) {
    showDebouncedToast('⚠️ تعذّر الاتصال بالخادم');
  } else if (isCriticalError(message)) {
    showRecoveryOverlay(stack || message);
  } else {
    showDebouncedToast('⚠️ حدث خطأ غير متوقع');
  }

  event.preventDefault(); // Silence console warning
}

/**
 * Handler for resource load errors (images, scripts, stylesheets).
 * @param {Event} event
 */
function handleResourceError(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  if (!target || target === window || target === document) return; // Not a resource error

  const tagName = target.tagName?.toLowerCase();
  const src = target.getAttribute('src') || target.getAttribute('href') || '';
  if (!src) return;

  logError({
    type: 'resource',
    message: `Failed to load ${tagName}: ${src}`,
    source: src,
  });

  // Resource errors are non-critical — just log them
  // (CSS/images failing shouldn't break the app experience)
}

/* ===================== INITIALIZATION ===================== */

/**
 * Install the global error boundary handlers.
 * Call this as early as possible in the app lifecycle (before other modules).
 */
export function initErrorBoundary() {
  // 1. Synchronous errors
  window.onerror = handleOnError;

  // 2. Unhandled Promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // 3. Resource load failures (capturing phase to catch before bubble)
  window.addEventListener('error', handleResourceError, true);

  // Log initialization
  console.info('[ErrorBoundary] Global error handlers installed.');
}

/**
 * Remove all error boundary handlers (useful for testing / cleanup).
 */
export function destroyErrorBoundary() {
  window.onerror = null;
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('error', handleResourceError, true);
  _recoveryVisible = false;
  console.info('[ErrorBoundary] Global error handlers removed.');
}
