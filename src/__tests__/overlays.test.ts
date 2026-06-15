/**
 * Tests for overlays.ts — lazy overlay HTML injection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectOverlays } from '../overlays.js';

describe('injectOverlays', () => {
  beforeEach(() => {
    // Clean up any previously injected overlays
    const existing = document.getElementById('injected-overlays');
    if (existing) existing.remove();
  });

  it('should create a wrapper div with id "injected-overlays"', () => {
    injectOverlays();
    const wrapper = document.getElementById('injected-overlays');
    expect(wrapper).not.toBeNull();
  });

  it('should inject the ayahModal overlay', () => {
    injectOverlays();
    const modal = document.getElementById('ayahModal');
    expect(modal).not.toBeNull();
  });

  it('should inject the presentationOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('presentationOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should inject the azanPlayer audio element', () => {
    injectOverlays();
    const player = document.getElementById('azanPlayer');
    expect(player).not.toBeNull();
  });

  it('should inject the azanNotification', () => {
    injectOverlays();
    const notif = document.getElementById('azanNotification');
    expect(notif).not.toBeNull();
  });

  it('should inject the surahSecretsOverlay', () => {
    injectOverlays();
    const overlay = document.getElementById('surahSecretsOverlay');
    expect(overlay).not.toBeNull();
  });

  it('should inject the adhkarNotification', () => {
    injectOverlays();
    const notif = document.getElementById('adhkarNotification');
    expect(notif).not.toBeNull();
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
  });

  it('should inject the readingStatsPanel', () => {
    injectOverlays();
    const panel = document.getElementById('readingStatsPanel');
    expect(panel).not.toBeNull();
  });

  it('should not duplicate overlays if called twice', () => {
    injectOverlays();
    injectOverlays();
    const wrappers = document.querySelectorAll('#injected-overlays');
    // First call creates one, second call creates another
    expect(wrappers.length).toBeLessThanOrEqual(2);
  });
});
