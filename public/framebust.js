/**
 * SEC-02 — frame-busting for static hosts.
 *
 * GitHub Pages ignores public/_headers, and `frame-ancestors` is ignored when
 * delivered through a meta CSP tag, so headers cannot prevent the app shell
 * from being framed elsewhere. This script refuses to render inside a frame:
 * it navigates the top window out of the frame, and when the embedder is
 * cross-origin (navigation throws) it blanks the document so clickjacking has
 * no visible UI to target.
 */
(function () {
  if (window.top === window.self) {
    return;
  }
  try {
    window.top.location = window.self.location;
  } catch {
    document.documentElement.style.display = 'none';
  }
})();
