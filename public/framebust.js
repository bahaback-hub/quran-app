/**
 * SEC-02 / N-01 — frame-busting guard for statically deployed pages.
 *
 * GitHub Pages ignores public/_headers, and `frame-ancestors` is ignored when
 * delivered through a meta CSP tag, so headers cannot prevent these pages from
 * being framed elsewhere. This script refuses to render inside a frame: it
 * navigates the top window out of the frame, and when the embedder is
 * cross-origin (navigation throws) it blanks the document so clickjacking has
 * no visible UI to target.
 *
 * Kept as a classic (non-module) script on purpose: it must run synchronously
 * before first paint, and it is shared verbatim by the app shell
 * (index.html, via %BASE_URL%) and the static pages that sit next to it in
 * dist/ (offline.html, privacy-policy.html, 404.html).
 */
(function () {
  'use strict';
  if (window.top !== window.self) {
    try {
      window.top.location.href = window.self.location.href;
    } catch (e) {
      document.documentElement.style.display = 'none';
    }
  }
})();
