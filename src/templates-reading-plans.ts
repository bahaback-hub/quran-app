import { __ } from './i18n.js';
import { escapeHtml } from './utils.js';

/**
 * Reading plans (khatma schedules) panel skeleton.
 *
 * The dynamic content (plan picker + live progress) is rendered into
 * `#readingPlanContent` by `src/reading-plans.ts` whenever the panel is
 * opened. The outer panel is injected alongside the other body-level
 * overlays in `src/overlays.ts` before `cacheDom()` runs.
 */
export function readingPlansPanelHTML(): string {
  return `
<section id="readingPlanPanel" class="reading-plan-panel" role="dialog" aria-modal="true" aria-labelledby="readingPlanTitle">
  <div class="reading-plan-header">
    <button id="readingPlanCloseBtn" class="reading-plan-close" type="button" aria-label="${escapeHtml(__('close'))}">&times;</button>
    <h2 id="readingPlanTitle" data-i18n="reading_plan_title">${escapeHtml(__('reading_plan_title'))}</h2>
  </div>
  <div id="readingPlanContent" class="reading-plan-content"></div>
</section>
`;
}
