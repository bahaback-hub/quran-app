import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';

vi.mock('../adhkar-data.js', () => ({
  ADHKAR_DATA: {
    categories: [
      {
        id: 'morning',
        name: 'أذكار الصباح',
        icon: '🌅',
        defaultTime: '06:00',
        defaultDuration: 30,
        items: [
          { id: 'm1', text: 'سبحان الله', count: 33, reference: 'متفق عليه' },
          { id: 'm2', text: 'الحمد لله', count: 33, reference: 'متفق عليه' }
        ]
      },
      {
        id: 'evening',
        name: 'أذكار المساء',
        icon: '🌆',
        defaultTime: '18:00',
        defaultDuration: 30,
        items: [
          { id: 'e1', text: 'آية الكرسي', count: 1, reference: 'البقرة 255' }
        ]
      }
    ]
  }
}));

import { loadAdhkarSettings, checkAdhkarNotifications, toggleAdhkarPanel } from '../adhkar.js';

describe('loadAdhkarSettings', () => {
  beforeEach(() => {
    state.adhkarSettings = null;
    dom.adhkarEnabledToggle = document.createElement('div');
    dom.adhkarSoundToggle = document.createElement('div');
  });

  it('should initialize settings with defaults when none saved', () => {
    loadAdhkarSettings();
    expect(state.adhkarSettings).toBeTruthy();
    expect(state.adhkarSettings.adhkar_enabled).toBe(false);
    expect(state.adhkarSettings.morning.enabled).toBe(true);
    expect(state.adhkarSettings.evening.enabled).toBe(true);
  });

  it('should reset daily counters on new day', () => {
    loadAdhkarSettings();
    state.adhkarSettings.item_m1 = 10;
    state.adhkarSettings._resetDate = 'yesterday';
    loadAdhkarSettings();
    expect(state.adhkarSettings.item_m1).toBe(0);
  });

  it('should sync toggle UI with loaded state', () => {
    loadAdhkarSettings();
    expect(dom.adhkarEnabledToggle.classList.contains('on')).toBe(false);
    state.adhkarSettings.adhkar_enabled = true;
    storage.set('adhkar_settings', state.adhkarSettings);
    loadAdhkarSettings();
    expect(dom.adhkarEnabledToggle.classList.contains('on')).toBe(true);
  });
});

describe('checkAdhkarNotifications', () => {
  beforeEach(() => {
    state.adhkarSettings = {
      adhkar_enabled: true,
      morning: { enabled: true, time: '06:00', duration: 30 },
      evening: { enabled: false, time: '18:00', duration: 30 },
      item_m1: 0, item_m2: 0, item_e1: 0,
      personal_adhkar: [],
      _resetDate: new Date().toDateString()
    };
    state.lastAdhkarFired = null;
    dom.adhkarNotification = document.createElement('div');
    dom.adhkarNotifIcon = document.createElement('div');
    dom.adhkarNotifTitle = document.createElement('div');
    dom.adhkarNotifText = document.createElement('div');
    dom.adhkarNotifProgress = document.createElement('div');
    dom.adhkarNotifShareBtn = document.createElement('button');
    // Mock style.display
    dom.adhkarNotification.style = {};
  });

  it('should fire notification when time matches for enabled category', () => {
    vi.setSystemTime(new Date('2025-01-01T06:00:00'));
    checkAdhkarNotifications();
    expect(dom.adhkarNotification.style.display).toBe('flex');
  });

  it('should not fire notification for disabled category', () => {
    state.adhkarSettings.morning.enabled = false;
    state.adhkarSettings.evening.enabled = false;
    vi.setSystemTime(new Date('2025-01-01T06:00:00'));
    checkAdhkarNotifications();
    expect(dom.adhkarNotification.style.display).toBeFalsy();
  });

  it('should not fire if adhkar is disabled globally', () => {
    state.adhkarSettings.adhkar_enabled = false;
    vi.setSystemTime(new Date('2025-01-01T06:00:00'));
    checkAdhkarNotifications();
    expect(dom.adhkarNotification.style.display).toBeFalsy();
  });
});

describe('toggleAdhkarPanel', () => {
  beforeEach(() => {
    state.adhkarPanelOpen = false;
    dom.adhkarPanel = document.createElement('div');
    dom.adhkarTabs = document.createElement('div');
    dom.adhkarContent = document.createElement('div');
  });

  it('should open the panel', () => {
    toggleAdhkarPanel();
    expect(state.adhkarPanelOpen).toBe(true);
    expect(dom.adhkarPanel.classList.contains('open')).toBe(true);
  });

  it('should close the panel', () => {
    toggleAdhkarPanel();
    toggleAdhkarPanel();
    expect(state.adhkarPanelOpen).toBe(false);
    expect(dom.adhkarPanel.classList.contains('open')).toBe(false);
  });
});
