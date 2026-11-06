/**
 * Mushaf QCF4 font loader — reliable font acquisition for Canvas rendering.
 * Strategy order: Capacitor ArrayBuffer → FontFace → static @font-face sheet.
 * Extracted from mushaf-renderer.ts; the renderer imports the public helpers.
 * All rendering math stays in mushaf-renderer.ts — this module only loads and
 * verifies fonts, it does not draw anything.
 */
import { isCapacitorNative } from '../../types.js';
import { qcf4FontUrl } from './qcf4-font-pack.js';

/** Tracks fonts that have been verified as loaded and usable on Canvas. */
const loadedFonts = new Set<string>();

/** Tracks fonts currently being loaded (prevents duplicate loads). */
const loadingFonts = new Map<string, Promise<boolean>>();

/** Detect if running in Capacitor/Android WebView environment. */
function isCapacitorEnv(): boolean {
  try {
    return !!(
      isCapacitorNative() ||
      (typeof navigator !== 'undefined' && /wv|Android.*Capacitor/i.test(navigator.userAgent)) ||
      (typeof document !== 'undefined' && document.documentElement.classList.contains('capacitor-native'))
    );
  } catch {
    return false;
  }
}

const _isCapacitor = isCapacitorEnv();

/** Double-check Capacitor status at runtime (class might be added after module load). */
export function isCapacitor(): boolean {
  if (_isCapacitor) {
    return true;
  }
  // Re-check in case capacitor-native class was added after module load
  try {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('capacitor-native');
  } catch {
    return false;
  }
}

/**
 * Build the woff2 font URL for a given QCF4 font name.
 * BSML font uses a different naming convention than Hafs fonts.
 */
function getFontUrl(fontName: string): string {
  return qcf4FontUrl(fontName);
}

/**
 * Fetch font binary data using XMLHttpRequest instead of fetch().
 *
 * CRITICAL: In Capacitor with CapacitorHttp enabled, the native HTTP plugin
 * intercepts ALL fetch() calls and can corrupt binary data (woff2 fonts).
 * XMLHttpRequest is NOT intercepted by CapacitorHttp, so it returns
 * correct binary data. This is the key fix for mushaf mode in Android APK.
 */
function fetchFontViaXHR(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`XHR HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.ontimeout = () => reject(new Error('XHR timeout'));
    xhr.timeout = 15000; // 15 second timeout
    xhr.send();
  });
}

/**
 * Fetch font binary data. In Capacitor, uses XHR to avoid CapacitorHttp
 * interception. In browsers, uses standard fetch().
 */
async function fetchFontBinary(url: string): Promise<ArrayBuffer> {
  if (isCapacitor()) {
    // Use XHR in Capacitor to avoid CapacitorHttp interception
    console.warn(`[Mushaf] Using XHR for font binary (bypassing CapacitorHttp): ${url}`);
    return fetchFontViaXHR(url);
  }
  // Use standard fetch in browser
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}

/**
 * Verify a font is truly usable on Canvas by drawing a PUA character
 * and checking if the pixels are non-blank.
 *
 * IMPORTANT: In Android WebView (Capacitor), Canvas pixel verification is unreliable
 * because WebView processes fonts differently. We use document.fonts.check()
 * as a fallback verification method in that case.
 */
function verifyFontOnCanvas(fontName: string): boolean {
  try {
    // In Capacitor/Android WebView, skip pixel-level Canvas verification
    // because it's unreliable — trust document.fonts API instead
    if (isCapacitor()) {
      const fontsCheck = document.fonts.check(`40px "${fontName}"`);
      console.warn(`[Mushaf] Capacitor: document.fonts.check for "${fontName}": ${fontsCheck}`);
      return fontsCheck;
    }

    const testSize = 40;
    const canvas = document.createElement('canvas');
    canvas.width = testSize * 2;
    canvas.height = testSize * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return false;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${testSize}px "${fontName}"`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uF100', canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 250 || data[i + 1]! < 250 || data[i + 2]! < 250) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Create a hidden DOM element that uses the font. This forces the browser
 * to download and parse the font binary, making it available for Canvas.
 * Some browsers (especially Android WebView) won't make fonts available
 * to Canvas unless they're used in the DOM first.
 */
/**
 * Ensure the static QCF4 @font-face sheet is linked once.
 * A same-origin link-rel-stylesheet is allowed by style-src 'self',
 * unlike a runtime-injected style element (which needs 'unsafe-inline').
 * @font-face rules only download when the family is actually used.
 */
const QCF_FONT_FACE_SHEET_ID = 'qcf-font-face-sheet';
function ensureQcfFontFaceSheet(): void {
  if (document.getElementById(QCF_FONT_FACE_SHEET_ID)) {
    return;
  }
  const link = document.createElement('link');
  link.id = QCF_FONT_FACE_SHEET_ID;
  link.rel = 'stylesheet';
  link.href = `${import.meta.env.BASE_URL}fonts/qcf4/qcf4-font-face.css`;
  document.head.appendChild(link);
}

function createFontPreloadElement(fontName: string): void {
  const id = `qcf-preload-${fontName}`;
  if (document.getElementById(id)) {
    return;
  }

  const span = document.createElement('span');
  span.id = id;
  span.setAttribute('aria-hidden', 'true');
  span.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    font-family: "${fontName}";
    font-size: 40px;
    pointer-events: none;
  `;
  // Use multiple PUA characters to ensure the browser loads the font
  span.textContent = '\uF100\uF101\uF102\uF103\uF104\uF105';
  document.body.appendChild(span);
}

/**
 * Load a QCF4 font using the most reliable method available.
 *
 * Strategy order (most to least reliable):
 * - Capacitor: XHR/fetch as ArrayBuffer → FontFace from binary data, then
 *   FontFace URL and the static CSS fallback. Capacitor needs the binary path
 *   because its WebView can intercept ordinary font requests.
 * - Browser: FontFace API with URL, then the static @font-face sheet. This
 *   avoids copying an 800–950KB WOFF2 into JavaScript memory and lets the
 *   browser manage the request and HTTP cache directly.
 *
 * In Capacitor: We skip pixel-level Canvas verification and trust
 * document.fonts API instead.
 */
export async function ensureFontLoaded(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) {
    return;
  }

  // Deduplicate concurrent loads
  if (loadingFonts.has(fontName)) {
    const result = await loadingFonts.get(fontName);
    if (result) {
      return;
    }
    loadingFonts.delete(fontName);
  }

  const loadPromise = _doLoadFont(fontName);
  loadingFonts.set(fontName, loadPromise);

  try {
    const success = await loadPromise;
    if (success) {
      loadedFonts.add(fontName);
    }
  } finally {
    loadingFonts.delete(fontName);
  }
}

/**
 * Internal font loading implementation.
 * Returns true if the font was loaded and verified.
 */
async function _doLoadFont(fontName: string): Promise<boolean> {
  const fontUrl = getFontUrl(fontName);
  const capMode = isCapacitor();
  const waitMs = capMode ? 1200 : 200;

  for (let attempt = 1; attempt <= (capMode ? 2 : 3); attempt++) {
    console.warn(`[Mushaf] Loading font "${fontName}" (attempt ${attempt})...`);

    // --- Strategy 1: Capacitor-only ArrayBuffer → FontFace ---
    // Browsers use the URL strategy below to avoid an unnecessary binary copy.
    if (capMode) {
      try {
        console.warn(`[Mushaf] Strategy 1: ArrayBuffer for "${fontName}" from ${fontUrl}`);
        const buffer = await fetchFontBinary(fontUrl);
        console.warn(`[Mushaf] Font "${fontName}" downloaded: ${buffer.byteLength} bytes`);

        // Validate: woff2 files should be at least 10KB
        if (buffer.byteLength < 10000) {
          console.warn(`[Mushaf] Font "${fontName}" too small (${buffer.byteLength} bytes), likely corrupted`);
          throw new Error(`Font data too small: ${buffer.byteLength} bytes`);
        }

        const fontFace = new FontFace(fontName, buffer, { display: 'block' });
        const loaded = await fontFace.load();
        document.fonts.add(loaded);

        await document.fonts.ready;
        createFontPreloadElement(fontName);
        await new Promise<void>((r) => setTimeout(r, waitMs));

        const verified = verifyFontOnCanvas(fontName);
        console.warn(`[Mushaf] Strategy 1 verify for "${fontName}": ${verified}`);
        if (verified) {
          console.warn(`[Mushaf] Font "${fontName}" loaded successfully via ArrayBuffer`);
          return true;
        }

        // In Capacitor: trust document.fonts and proceed even if Canvas verify fails
        if (capMode) {
          const fontsCheck = document.fonts.check(`40px "${fontName}"`);
          if (fontsCheck) {
            console.warn(`[Mushaf] Capacitor: Trusting document.fonts.check for "${fontName}"`);
            return true;
          }
          // Even if fonts.check fails, if we added the font, proceed anyway
          console.warn(`[Mushaf] Capacitor: Proceeding with font "${fontName}" despite verification failure`);
          return true;
        }
      } catch (e) {
        console.warn(`[Mushaf] ArrayBuffer strategy failed for "${fontName}":`, e);
      }
    }

    // --- Strategy 2: FontFace with URL (browser handles download) ---
    try {
      console.warn(`[Mushaf] Strategy 2: FontFace URL for "${fontName}"`);
      const fontFace = new FontFace(fontName, `url('${fontUrl}')`, { display: 'block' });
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      await document.fonts.ready;
      createFontPreloadElement(fontName);
      await new Promise<void>((r) => setTimeout(r, waitMs));

      const verified = verifyFontOnCanvas(fontName);
      console.warn(`[Mushaf] Strategy 2 verify for "${fontName}": ${verified}`);
      if (verified) {
        console.warn(`[Mushaf] Font "${fontName}" loaded successfully via FontFace URL`);
        return true;
      }

      if (capMode) {
        console.warn(
          `[Mushaf] Capacitor: Proceeding with font "${fontName}" (strategy 2) despite verification failure`,
        );
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] FontFace URL strategy failed for "${fontName}":`, e);
    }

    // --- Strategy 3: static @font-face sheet + DOM preload ---
    // CSP-safe: the @font-face rules live in the static same-origin sheet
    // public/fonts/qcf4/qcf4-font-face.css (one rule per QCF4 font), loaded
    // once via link. No style element injection, so this works with
    // style-src 'self' and without 'unsafe-inline'.
    try {
      console.warn(`[Mushaf] Strategy 3: static @font-face sheet for "${fontName}"`);
      ensureQcfFontFaceSheet();

      createFontPreloadElement(fontName);

      try {
        await document.fonts.load(`40px "${fontName}"`, '\uF100');
      } catch {
        /* some browsers don't support the text param */
      }

      await document.fonts.ready;
      const cssWaitMs = capMode ? 1500 : 500;
      await new Promise<void>((r) => setTimeout(r, cssWaitMs));

      const verified = verifyFontOnCanvas(fontName);
      console.warn(`[Mushaf] Strategy 3 verify for "${fontName}": ${verified}`);
      if (verified) {
        console.warn(`[Mushaf] Font "${fontName}" loaded successfully via CSS @font-face`);
        return true;
      }

      if (capMode) {
        console.warn(
          `[Mushaf] Capacitor: Proceeding with font "${fontName}" (strategy 3) despite verification failure`,
        );
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] CSS @font-face strategy failed for "${fontName}":`, e);
    }

    if (attempt < (capMode ? 2 : 3)) {
      const delay = capMode ? 1000 : 500 * attempt;
      console.warn(`[Mushaf] All strategies failed for "${fontName}" (attempt ${attempt}), retrying in ${delay}ms...`);
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  // In Capacitor: proceed anyway — better to show something than blank
  if (capMode) {
    console.warn(`[Mushaf] Capacitor: Proceeding despite font "${fontName}" loading failure — will retry render later`);
    return true;
  }

  console.error(`[Mushaf] FAILED to load font "${fontName}" after all attempts.`);
  return false;
}

/** Non-Capacitor final check used by _renderPageInternal: verify the page font
 *  on Canvas (pixel probe) or attempt one final reload with all strategies. */
export async function ensureVerifiedFont(pageFont: string): Promise<void> {
  if (!loadedFonts.has(pageFont) || !verifyFontOnCanvas(pageFont)) {
    console.warn(`[Mushaf] Font "${pageFont}" not verified on Canvas, attempting final reload...`);
    loadedFonts.delete(pageFont);
    await ensureFontLoaded(pageFont);
  }
}
