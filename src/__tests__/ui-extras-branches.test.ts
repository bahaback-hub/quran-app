import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const domMock = {
  networkBanner: null as HTMLElement | null,
  surahContent: null as HTMLElement | null,
  surahSelect: null as HTMLSelectElement | null,
};
const stateMock = { mushafMode: false, currentAyahIndex: 0, surahData: null as any, currentPage: 1, currentSurah: 1 };
let adhkarInterval: any = null;
const setAdhkarInterval = vi.fn((v: any) => {
  adhkarInterval = v;
});
const getAdhkarInterval = vi.fn(() => adhkarInterval);
const loadSurahMock = vi.fn();
const stopClockMock = vi.fn();
const startClockMock = vi.fn();
const checkAdhkarMock = vi.fn();
const announceMock = vi.fn();
const recordReadingMock = vi.fn();
let lang = 'ar';

vi.mock('../dom.js', () => ({ dom: domMock }));
vi.mock('../state.js', () => ({ state: stateMock }));
vi.mock('../i18n.js', () => ({
  __: (k: string, ...a: any[]) => (a.length ? `${k}:${a.join(',')}` : k),
  getLang: () => lang,
}));
vi.mock('../internal-state.js', () => ({
  getAdhkarIntervalId: () => getAdhkarInterval(),
  setAdhkarIntervalId: (v: any) => setAdhkarInterval(v),
}));
vi.mock('../surah-loader.js', () => ({ loadSurah: (...a: any[]) => (loadSurahMock as any)(...a) }));
vi.mock('../features/prayer/prayer.js', () => ({
  stopClock: (...a: any[]) => (stopClockMock as any)(...a),
  startClock: (...a: any[]) => (startClockMock as any)(...a),
}));
vi.mock('../adhkar-notifications.js', () => ({
  checkAdhkarNotifications: (...a: any[]) => (checkAdhkarMock as any)(...a),
}));
vi.mock('../a11y.js', () => ({ announceToScreenReader: (...a: any[]) => (announceMock as any)(...a) }));
vi.mock('../reading-plans.js', () => ({ recordReading: (...a: any[]) => (recordReadingMock as any)(...a) }));

async function loadModule() {
  vi.resetModules();
  return await import('../ui-extras.js');
}

describe('ui-extras branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    domMock.networkBanner = null;
    domMock.surahContent = null;
    domMock.surahSelect = null;
    stateMock.mushafMode = false;
    stateMock.currentAyahIndex = 0;
    stateMock.surahData = null;
    stateMock.currentPage = 1;
    stateMock.currentSurah = 1;
    adhkarInterval = null;
    lang = 'ar';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showContinueWidget handles close, restored, and english names', async () => {
    const { showContinueWidget } = await loadModule();
    domMock.surahSelect = document.createElement('select');
    domMock.surahSelect.innerHTML = '<option value="2">2</option>';

    lang = 'en';
    showContinueWidget({
      surah: 2,
      surahName: 'البقرة',
      englishSurahName: 'Al-Baqarah',
      ayahNumberInSurah: 3,
      timestamp: Date.now(),
    });
    let widget = document.getElementById('continueWidget')!;
    expect(widget.dir).toBe('ltr');
    expect(widget.textContent).toContain('Al-Baqarah');

    widget.querySelector<HTMLButtonElement>('.continue-widget-close')!.click();
    expect(document.getElementById('continueWidget')).toBeNull();
    expect(loadSurahMock).not.toHaveBeenCalled();

    showContinueWidget({
      surah: 2,
      surahName: 'البقرة',
      englishSurahName: 'Al-Baqarah',
      ayahNumberInSurah: 3,
      restored: true,
    });
    document.getElementById('continueWidget')!.click();
    expect(loadSurahMock).not.toHaveBeenCalled();

    showContinueWidget({ surah: 2, surahName: 'البقرة', englishSurahName: 'Al-Baqarah', ayahNumberInSurah: 0 });
    document.getElementById('continueWidget')!.click();
    expect(loadSurahMock).toHaveBeenCalledWith(2, { startAyah: 1 });
  });

  it('handleVisibilityChange manages clock and adhkar interval', async () => {
    const { handleVisibilityChange } = await loadModule();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    adhkarInterval = 123 as any;
    handleVisibilityChange();
    await new Promise((r) => setTimeout(r, 0));
    expect(stopClockMock).toHaveBeenCalled();
    expect(setAdhkarInterval).toHaveBeenCalledWith(null);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    adhkarInterval = null;
    handleVisibilityChange();
    await new Promise((r) => setTimeout(r, 0));
    expect(startClockMock).toHaveBeenCalled();
    expect(setAdhkarInterval).toHaveBeenCalled();
  });

  it('updateNetworkBanner announces transitions and handles announce errors', async () => {
    const { updateNetworkBanner } = await loadModule();
    const banner = document.createElement('div');
    domMock.networkBanner = banner;

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    updateNetworkBanner();
    expect(announceMock).not.toHaveBeenCalled();

    announceMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(() => updateNetworkBanner()).not.toThrow();
    expect(banner.hidden).toBe(false);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    updateNetworkBanner();
    expect(announceMock).toHaveBeenCalled();
  });

  it('updateReadingProgress handles pending guard, missing bar, mushaf and normal modes', async () => {
    const { updateReadingProgress } = await loadModule();
    updateReadingProgress(); // no progressBar
    await new Promise((r) => setTimeout(r, 30));

    const bar = document.createElement('div');
    bar.id = 'readingProgress';
    document.body.appendChild(bar);

    stateMock.mushafMode = true;
    stateMock.currentPage = 302;
    updateReadingProgress();
    updateReadingProgress(); // pending guard
    await new Promise((r) => setTimeout(r, 30));
    expect(bar.style.transform).toContain('scaleX');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round((302 / 604) * 100)));

    stateMock.mushafMode = false;
    domMock.surahContent = document.createElement('main');
    stateMock.surahData = { ayahs: [{}, {}, {}, {}] };
    stateMock.currentAyahIndex = 1;
    stateMock.currentSurah = 9;
    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 30));
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(recordReadingMock).toHaveBeenCalledWith(9, 2);
  });
});
