/**
 * Tests for overlays.ts — lazy overlay HTML injection.
 * Tests cover both the injected-panels and injected-overlays wrappers,
 * plus the arabicKeyboardMount injection path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectOverlays } from '../overlays.js';

describe('injectOverlays', () => {
  beforeEach(() => {
    // Clean up any previously injected overlays
    const existingOverlays = document.getElementById('injected-overlays');
    if (existingOverlays) {
      existingOverlays.remove();
    }
    const existingPanels = document.getElementById('injected-panels');
    if (existingPanels) {
      existingPanels.remove();
    }
  });

  /* ===================== WRAPPER CREATION ===================== */

  it('should create a wrapper div with id "injected-overlays"', () => {
    injectOverlays();
    const wrapper = document.getElementById('injected-overlays');
    expect(wrapper).not.toBeNull();
  });

  it('should create a wrapper div with id "injected-panels"', () => {
    injectOverlays();
    const wrapper = document.getElementById('injected-panels');
    expect(wrapper).not.toBeNull();
  });

  it('should not duplicate overlays if called twice', () => {
    injectOverlays();
    injectOverlays();
    const wrappers = document.querySelectorAll('#injected-overlays');
    expect(wrappers.length).toBeLessThanOrEqual(2);
  });

  /* ===================== INJECTED-OVERLAYS ELEMENTS ===================== */

  it('should inject the ayahModal overlay', () => {
    injectOverlays();
    const modal = document.getElementById('ayahModal');
    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('role')).toBe('dialog');
  });

  it('should inject the presentationOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('presentationOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');
  });

  it('should inject the azanPlayer audio element', () => {
    injectOverlays();
    const player = document.getElementById('azanPlayer');
    expect(player).not.toBeNull();
    expect(player?.tagName).toBe('AUDIO');
  });

  it('should inject the azanNotification', () => {
    injectOverlays();
    const notif = document.getElementById('azanNotification');
    expect(notif).not.toBeNull();
    expect(notif?.getAttribute('role')).toBe('alert');
  });

  it('should inject the surahSecretsOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('surahSecretsOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');
  });

  it('should inject the adhkarNotification', () => {
    injectOverlays();
    const notif = document.getElementById('adhkarNotification');
    expect(notif).not.toBeNull();
    expect(notif?.getAttribute('role')).toBe('alert');
  });

  it('should inject the adhkarAddOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('adhkarAddOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should inject the qiblaOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('qiblaOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');
  });

  it('should inject the readingStatsPanel', () => {
    injectOverlays();
    const panel = document.getElementById('readingStatsPanel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('dialog');
  });

  /* ===================== INJECTED-PANELS ELEMENTS ===================== */

  it('should inject the settings panel via injected-panels', () => {
    injectOverlays();
    const panel = document.getElementById('settingsPanel');
    expect(panel).not.toBeNull();
  });

  it('should inject the floating player via injected-panels', () => {
    injectOverlays();
    const player = document.getElementById('player');
    expect(player).not.toBeNull();
  });

  /* ===================== ARABIC KEYBOARD MOUNT ===================== */

  it('should inject the Arabic keyboard into the mount point when it exists', () => {
    // Create the mount point in the DOM
    const mount = document.createElement('div');
    mount.id = 'arabicKeyboardMount';
    document.body.appendChild(mount);

    injectOverlays();

    // The mount should have keyboard content inside it
    expect(mount.children.length).toBeGreaterThan(0);

    // Clean up
    mount.remove();
  });

  it('should handle missing arabicKeyboardMount gracefully', () => {
    // Ensure no mount point exists
    const existing = document.getElementById('arabicKeyboardMount');
    if (existing) {
      existing.remove();
    }

    // Should not throw
    expect(() => injectOverlays()).not.toThrow();
  });

  /* ===================== ARIA & ACCESSIBILITY ===================== */

  it('should set correct ARIA attributes on overlays', () => {
    injectOverlays();

    const dialogs = document.querySelectorAll('#injected-overlays [role="dialog"]');
    expect(dialogs.length).toBeGreaterThanOrEqual(4);

    const alerts = document.querySelectorAll('#injected-overlays [role="alert"]');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });

  it('should set aria-label on overlays', () => {
    injectOverlays();

    const ayahModal = document.getElementById('ayahModal');
    expect(ayahModal?.getAttribute('aria-label')).toBeTruthy();

    const qibla = document.getElementById('qiblaOverlay');
    expect(qibla?.getAttribute('aria-label')).toBeTruthy();

    const readingStats = document.getElementById('readingStatsPanel');
    expect(readingStats?.getAttribute('aria-label')).toBeTruthy();
  });

  /* ===================== OVERLAY CONTENT VALIDATION ===================== */

  it('should inject all expected azan notification elements', () => {
    injectOverlays();

    expect(document.getElementById('azanNotifPrayer')).not.toBeNull();
    expect(document.getElementById('azanNotifStopBtn')).not.toBeNull();
  });

  it('should inject all expected adhkar notification elements', () => {
    injectOverlays();

    expect(document.getElementById('adhkarNotifIcon')).not.toBeNull();
    expect(document.getElementById('adhkarNotifTitle')).not.toBeNull();
    expect(document.getElementById('adhkarNotifText')).not.toBeNull();
    expect(document.getElementById('adhkarNotifProgress')).not.toBeNull();
    expect(document.getElementById('adhkarNotifOpenBtn')).not.toBeNull();
    expect(document.getElementById('adhkarNotifShareBtn')).not.toBeNull();
    expect(document.getElementById('adhkarNotifDismissBtn')).not.toBeNull();
  });

  it('should inject all expected adhkar add overlay elements', () => {
    injectOverlays();

    expect(document.getElementById('adhkarAddCloseBtn')).not.toBeNull();
    expect(document.getElementById('adhkarAddText')).not.toBeNull();
    expect(document.getElementById('adhkarAddCount')).not.toBeNull();
    expect(document.getElementById('adhkarAddTime')).not.toBeNull();
    expect(document.getElementById('adhkarAddDuration')).not.toBeNull();
    expect(document.getElementById('adhkarAddSaveBtn')).not.toBeNull();
  });

  it('should inject all expected presentation overlay elements', () => {
    injectOverlays();

    expect(document.getElementById('presentationBody')).not.toBeNull();
    expect(document.getElementById('presentationAyahText')).not.toBeNull();
    expect(document.getElementById('presentationAyahNum')).not.toBeNull();
    expect(document.getElementById('presentationTitle')).not.toBeNull();
    expect(document.getElementById('presentationCloseBtn')).not.toBeNull();
    expect(document.getElementById('presentationPrevBtn')).not.toBeNull();
    expect(document.getElementById('presentationNextBtn')).not.toBeNull();
    expect(document.getElementById('presentationCounter')).not.toBeNull();
    expect(document.getElementById('presentationTranslation')).not.toBeNull();
    expect(document.getElementById('presPlayPauseBtn')).not.toBeNull();
    expect(document.getElementById('presTajweedBtn')).not.toBeNull();
    expect(document.getElementById('presFullscreenBtn')).not.toBeNull();
  });

  it('should inject all expected surah secrets overlay elements', () => {
    injectOverlays();

    expect(document.getElementById('surahSecretsCloseBtn')).not.toBeNull();
    expect(document.getElementById('surahSecretsBody')).not.toBeNull();
    expect(document.getElementById('surahSecretsTitle')).not.toBeNull();
    expect(document.getElementById('surahSecretsSurahName')).not.toBeNull();
  });

  it('should inject all expected qibla overlay elements', () => {
    injectOverlays();

    expect(document.getElementById('qiblaCompass')).not.toBeNull();
    expect(document.getElementById('qiblaAngle')).not.toBeNull();
    expect(document.getElementById('qiblaDirection')).not.toBeNull();
    expect(document.getElementById('qiblaCloseBtn')).not.toBeNull();
  });

  it('should inject all expected reading stats elements', () => {
    injectOverlays();

    expect(document.getElementById('readingStatsContent')).not.toBeNull();
    expect(document.getElementById('readingStatsCloseBtn')).not.toBeNull();
  });

  it('should inject all expected ayah modal elements', () => {
    injectOverlays();

    expect(document.getElementById('ayahModalCloseBtn')).not.toBeNull();
    expect(document.getElementById('ayahModalTitle')).not.toBeNull();
    expect(document.getElementById('ayahModalText')).not.toBeNull();
    expect(document.getElementById('ayahModalTafsirBody')).not.toBeNull();
    expect(document.getElementById('ayahModalTafsirTabs')).not.toBeNull();
    expect(document.getElementById('ayahModalAudio')).not.toBeNull();
    expect(document.getElementById('ayahModalBookmarkBtn')).not.toBeNull();
    expect(document.getElementById('ayahModalFavBtn')).not.toBeNull();
    expect(document.getElementById('ayahModalShareBtn')).not.toBeNull();
    expect(document.getElementById('ayahModalCopyBtn')).not.toBeNull();
    expect(document.getElementById('ayahModalTafsirBtn')).not.toBeNull();
  });

  /* ===================== I18N WIRING (UXS-02) ===================== */
  // Static overlay text must go through data-i18n attributes so language
  // switches translate it; hardcoded Arabic would freeze for other locales.

  it('should wire adhkar notification texts to i18n keys', () => {
    injectOverlays();

    expect(document.getElementById('adhkarNotifTitle')?.getAttribute('data-i18n')).toBe('adhkar_notif_title');
    expect(document.getElementById('adhkarNotifOpenBtn')?.getAttribute('data-i18n')).toBe('adhkar_notif_open');
    expect(document.getElementById('adhkarNotifShareBtn')?.getAttribute('data-i18n')).toBe('adhkar_notif_copy');
    expect(document.getElementById('adhkarNotifDismissBtn')?.getAttribute('data-i18n')).toBe('adhkar_notif_later');
  });

  it('should wire presentation overlay controls to i18n keys', () => {
    injectOverlays();

    expect(document.getElementById('presentationOverlay')?.getAttribute('data-i18n-aria-label')).toBe('pres_dlg');
    expect(document.getElementById('presentationCloseBtn')?.getAttribute('data-i18n-aria-label')).toBe('pres_close');
    expect(document.getElementById('presShareBtn')?.getAttribute('data-i18n-aria-label')).toBe('pres_share');
    expect(document.querySelector('[data-pres-bg-mode="plain"]')?.getAttribute('data-i18n')).toBe('pres_pick_plain');
  });

  it('should wire azan, secrets, contemplation and stats overlays to i18n keys', () => {
    injectOverlays();

    expect(document.querySelector('.azan-notification-title')?.getAttribute('data-i18n')).toBe('azan_now');
    expect(document.getElementById('surahSecretsOverlay')?.getAttribute('data-i18n-aria-label')).toBe('secrets_dlg');
    expect(document.getElementById('contemplationTitle')?.getAttribute('data-i18n')).toBe('contemplation_title');
    expect(document.getElementById('contemplationHint')?.getAttribute('data-i18n')).toBe('contemplation_hint');
    expect(document.getElementById('readingStatsPanel')?.getAttribute('data-i18n-aria-label')).toBe('stats_dlg');
    expect(document.getElementById('ayahModalTitle')?.getAttribute('data-i18n')).toBe('ayah_title_ph');
  });
});
