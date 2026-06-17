/**
 * Tests for translations/ directory — basic import and structure tests.
 * Ensures each translation bundle can be loaded and has the expected shape.
 */

import { describe, it, expect } from 'vitest';

describe('Arabic translation bundle', () => {
  it('should import and have a default export', async () => {
    const mod = await import('../translations/ar');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('should contain required string keys', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.error_title).toBe('حدث خطأ');
    expect(bundle.error_server_unreachable).toBe('خادم غير متاح');
    expect(bundle.error_unexpected).toBe('خطأ غير متوقع');
  });

  it('should contain prayer keys', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.prayer_fajr).toBe('الفجر');
    expect(bundle.prayer_dhuhr).toBe('الظهر');
    expect(bundle.prayer_asr).toBe('العصر');
    expect(bundle.prayer_maghrib).toBe('المغرب');
    expect(bundle.prayer_isha).toBe('العشاء');
    expect(bundle.prayer_sunrise).toBe('الشروق');
  });

  it('should contain weekdays array', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(Array.isArray(bundle.weekdays)).toBe(true);
    expect(bundle.weekdays).toHaveLength(7);
    expect(bundle.weekdays[0]).toBe('الأحد');
    expect(bundle.weekdays[6]).toBe('السبت');
  });

  it('should contain reciters object', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.reciters).toBeDefined();
    expect(typeof bundle.reciters).toBe('object');
    expect(bundle.reciters['ar.alafasy']).toBe('مشاري العفاسي');
  });

  it('should contain tafsir_names object', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.tafsir_names).toBeDefined();
    expect(typeof bundle.tafsir_names).toBe('object');
  });

  it('should contain cities object', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.cities).toBeDefined();
    expect(typeof bundle.cities).toBe('object');
    expect(bundle.cities.makkah).toBe('مكة المكرمة');
  });

  it('should contain calc_methods object', async () => {
    const mod = await import('../translations/ar');
    const bundle = mod.default;
    expect(bundle.calc_methods).toBeDefined();
    expect(typeof bundle.calc_methods).toBe('object');
    expect(bundle.calc_methods['4']).toBe('أم القرى');
  });
});

describe('English translation bundle', () => {
  it('should import and have a default export', async () => {
    const mod = await import('../translations/en');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('should contain required string keys', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(bundle.error_title).toBe('An error occurred');
    expect(bundle.error_server_unreachable).toBe('Server unreachable');
    expect(bundle.error_unexpected).toBe('Unexpected error');
  });

  it('should contain prayer keys', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(bundle.prayer_fajr).toBe('Fajr');
    expect(bundle.prayer_dhuhr).toBe('Dhuhr');
    expect(bundle.prayer_maghrib).toBe('Maghrib');
  });

  it('should contain weekdays array', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(Array.isArray(bundle.weekdays)).toBe(true);
    expect(bundle.weekdays).toHaveLength(7);
    expect(bundle.weekdays[0]).toBe('Sunday');
    expect(bundle.weekdays[6]).toBe('Saturday');
  });

  it('should contain reciters object', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(bundle.reciters).toBeDefined();
    expect(bundle.reciters['ar.alafasy']).toBe('Mishary Alafasy');
  });

  it('should contain cities object', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(bundle.cities).toBeDefined();
    expect(bundle.cities.makkah).toBe('Makkah');
  });

  it('should contain calc_methods object', async () => {
    const mod = await import('../translations/en');
    const bundle = mod.default;
    expect(bundle.calc_methods).toBeDefined();
    expect(bundle.calc_methods['4']).toBe('Umm Al-Qura');
  });
});

describe('Turkish translation bundle', () => {
  it('should import and have a default export', async () => {
    const mod = await import('../translations/tr');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('should contain required string keys', async () => {
    const mod = await import('../translations/tr');
    const bundle = mod.default;
    expect(bundle.error_title).toBeTruthy();
    expect(typeof bundle.error_title).toBe('string');
  });

  it('should contain weekdays array', async () => {
    const mod = await import('../translations/tr');
    const bundle = mod.default;
    expect(Array.isArray(bundle.weekdays)).toBe(true);
    expect(bundle.weekdays).toHaveLength(7);
  });

  it('should contain structured sub-objects', async () => {
    const mod = await import('../translations/tr');
    const bundle = mod.default;
    expect(bundle.reciters).toBeDefined();
    expect(bundle.tafsir_names).toBeDefined();
    expect(bundle.cities).toBeDefined();
    expect(bundle.calc_methods).toBeDefined();
  });
});

describe('Malay translation bundle', () => {
  it('should import and have a default export', async () => {
    const mod = await import('../translations/ms');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('should contain required string keys', async () => {
    const mod = await import('../translations/ms');
    const bundle = mod.default;
    expect(bundle.error_title).toBeTruthy();
    expect(typeof bundle.error_title).toBe('string');
  });

  it('should contain weekdays array', async () => {
    const mod = await import('../translations/ms');
    const bundle = mod.default;
    expect(Array.isArray(bundle.weekdays)).toBe(true);
    expect(bundle.weekdays).toHaveLength(7);
  });

  it('should contain structured sub-objects', async () => {
    const mod = await import('../translations/ms');
    const bundle = mod.default;
    expect(bundle.reciters).toBeDefined();
    expect(bundle.tafsir_names).toBeDefined();
    expect(bundle.cities).toBeDefined();
    expect(bundle.calc_methods).toBeDefined();
  });
});

describe('Indonesian translation bundle', () => {
  it('should import and have a default export', async () => {
    const mod = await import('../translations/id');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('should contain required string keys', async () => {
    const mod = await import('../translations/id');
    const bundle = mod.default;
    expect(bundle.error_title).toBeTruthy();
    expect(typeof bundle.error_title).toBe('string');
  });

  it('should contain weekdays array', async () => {
    const mod = await import('../translations/id');
    const bundle = mod.default;
    expect(Array.isArray(bundle.weekdays)).toBe(true);
    expect(bundle.weekdays).toHaveLength(7);
  });

  it('should contain structured sub-objects', async () => {
    const mod = await import('../translations/id');
    const bundle = mod.default;
    expect(bundle.reciters).toBeDefined();
    expect(bundle.tafsir_names).toBeDefined();
    expect(bundle.cities).toBeDefined();
    expect(bundle.calc_methods).toBeDefined();
  });
});

describe('Translation bundle consistency', () => {
  it('all bundles should have the same top-level string keys', async () => {
    const [ar, en, tr, ms, id] = await Promise.all([
      import('../translations/ar'),
      import('../translations/en'),
      import('../translations/tr'),
      import('../translations/ms'),
      import('../translations/id'),
    ]);

    const bundles = [ar.default, en.default, tr.default, ms.default, id.default];
    const names = ['ar', 'en', 'tr', 'ms', 'id'];

    // All should have weekdays
    for (let i = 0; i < bundles.length; i++) {
      expect(Array.isArray(bundles[i].weekdays), `${names[i]} should have weekdays array`).toBe(true);
      expect(bundles[i].weekdays.length, `${names[i]} weekdays should have 7 entries`).toBe(7);
    }

    // All should have reciters
    for (let i = 0; i < bundles.length; i++) {
      expect(typeof bundles[i].reciters, `${names[i]} should have reciters object`).toBe('object');
    }

    // All should have tafsir_names
    for (let i = 0; i < bundles.length; i++) {
      expect(typeof bundles[i].tafsir_names, `${names[i]} should have tafsir_names object`).toBe('object');
    }

    // All should have cities
    for (let i = 0; i < bundles.length; i++) {
      expect(typeof bundles[i].cities, `${names[i]} should have cities object`).toBe('object');
    }

    // All should have calc_methods
    for (let i = 0; i < bundles.length; i++) {
      expect(typeof bundles[i].calc_methods, `${names[i]} should have calc_methods object`).toBe('object');
    }
  });

  it('all bundles should have prayer keys', async () => {
    const [ar, en, tr, ms, id] = await Promise.all([
      import('../translations/ar'),
      import('../translations/en'),
      import('../translations/tr'),
      import('../translations/ms'),
      import('../translations/id'),
    ]);

    const prayerKeys = ['prayer_fajr', 'prayer_sunrise', 'prayer_dhuhr', 'prayer_asr', 'prayer_maghrib', 'prayer_isha'];
    const bundles = [ar.default, en.default, tr.default, ms.default, id.default];
    const names = ['ar', 'en', 'tr', 'ms', 'id'];

    for (let i = 0; i < bundles.length; i++) {
      for (const key of prayerKeys) {
        expect(bundles[i][key], `${names[i]} should have ${key}`).toBeTruthy();
      }
    }
  });

  it('all bundles should have offline and a11y keys', async () => {
    const [ar, en, tr, ms, id] = await Promise.all([
      import('../translations/ar'),
      import('../translations/en'),
      import('../translations/tr'),
      import('../translations/ms'),
      import('../translations/id'),
    ]);

    const a11yKeys = [
      'offline_banner',
      'a11y_you_are_offline',
      'a11y_you_are_online',
      'a11y_panel_opened',
      'a11y_panel_closed',
      'a11y_skip_to_content',
      'a11y_offline_notice',
      'a11y_reading_progress',
      'reduced_motion_enabled',
    ];
    const bundles = [ar.default, en.default, tr.default, ms.default, id.default];
    const names = ['ar', 'en', 'tr', 'ms', 'id'];

    for (let i = 0; i < bundles.length; i++) {
      for (const key of a11yKeys) {
        expect(bundles[i][key], `${names[i]} should have ${key}`).toBeTruthy();
        expect(typeof bundles[i][key], `${names[i]}.${key} should be string`).toBe('string');
      }
    }
  });
});
