/**
 * The single audited place where the app turns a trusted HTML string into DOM.
 *
 * Almost every screen is produced by the template modules (`src/templates*`),
 * which return strings and escape each interpolated value with `escapeHtml()`.
 * Those strings still have to be parsed into nodes somewhere. Doing that with
 * `.innerHTML` in 20+ modules meant the lint ban needed 23 file-wide
 * exemptions; after this helper exists the ban covers every other source file
 * and only `src/safe-html.ts` is exempt, on purpose and in the open.
 *
 * Contract: `html` must be trusted markup produced by this app's own
 * templates. Never pass raw user input, API text, or a translated string —
 * run it through `escapeHtml()` first (or use `textContent` for plain text).
 *
 * The assignment stays a direct one on purpose: `<select>` selectedness,
 * `<tbody>` rows, `<option>`s, and implicit `<tbody>` creation inside a
 * `<table>` all behave exactly as they did before, so centralising the sink
 * here is a pure refactor. Every call site is reviewable in one lint rule.
 */
export function setTrustedHtml(target: Element, html: string): void {
  target.innerHTML = html;
}
