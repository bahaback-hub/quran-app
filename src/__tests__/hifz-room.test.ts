import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  close: 'إغلاق',
  hifz_room: 'غرفة الحفظ',
  hifz_room_eyebrow: 'مساحتك الهادئة',
  hifz_room_tagline: 'وردك يتقدم بثبات.',
  hifz_room_today: '',
  hifz_room_session_hint: 'استخدم أدوات المشغل.',
  hifz_room_start: 'ابدأ جلسة الحفظ',
  hifz_room_review: 'المراجعة التالية',
  hifz_room_session_active: 'فُعّل الحفظ والتكرار.',
  hifz_room_footnote: 'مساحة هادئة للحفظ.',
  hifz_room_step_portion: 'اختر السورة',
  hifz_room_step_repeat: 'اضبط التكرار بشكل صحيح',
  hifz_room_step_start: 'ابدأ',
  hifz_room_surah: 'السورة',
  hifz_room_surah_search_placeholder: 'اكتب اسم السورة للبحث',
  hifz_room_from_ayah: 'من آية',
  hifz_room_to_ayah: 'إلى آية',
  hifz_room_repeat: 'عدد التكرارات',
  hifz_room_custom_repeat: 'عدد مخصص (1–100)',
  hifz_room_summary: '{0} — الآيات {1}–{2} — {3} مرات',
  hifz_room_return_reader: 'العودة إلى القراءة',
  hifz_room_review_today: 'مساء اليوم',
  hifz_room_review_tomorrow: 'غداً',
  hifz_room_review_later: 'لاحقاً',
  hifz_room_review_custom: 'حدد التاريخ والوقت',
  hifz_room_loading: 'جارٍ تجهيز الورد في القارئ…',
  hifz_room_load_failed: 'تعذر تجهيز الورد. حاول مرة أخرى.',
  hifz_room_session_title: 'جلسة الحفظ',
  hifz_room_reciter: 'المقرئ',
  hifz_room_speed: 'سرعة التلاوة',
  hifz_room_ayahs: 'الآيات {0}–{1}',
  hifz_room_restart: 'إعادة المقطع',
  hifz_room_repeat_progress: 'التكرار {0} من {1}',
  hifz_room_hide_text: 'إخفاء الآيات',
  hifz_room_show_text: 'إظهار الآيات',
  hifz_room_show_range: 'عرض المقطع كاملاً',
  hifz_room_show_one: 'عرض آية واحدة',
  hifz_room_end: 'إنهاء الجلسة',
  hifz_room_download: 'تنزيل الجلسة',
  hifz_room_download_working: 'جارٍ تنزيل الجلسة…',
  hifz_room_download_hint: 'احفظ الآيات المختارة لتعمل الجلسة دون إنترنت.',
  hifz_room_download_preparing: 'جارٍ تجهيز ملفات الجلسة…',
  hifz_room_download_progress: 'جارٍ تنزيل الجلسة: {0}/{1}',
  hifz_room_download_ready: 'الجلسة جاهزة للاستماع دون إنترنت.',
  hifz_room_download_cached: 'هذه الجلسة محفوظة بالفعل وتعمل دون إنترنت.',
  hifz_room_download_failed: 'تعذر تنزيل الجلسة. تحقق من الاتصال ثم أعد المحاولة.',
};

const {
  mockState,
  mockStorage,
  mockLoadSurah,
  mockLoadAudioUrlsForSession,
  mockHighlightCurrentAyah,
  mockCacheSurahAudio,
  mockIsSurahCached,
  mockPlayCurrentAyah,
  mockTogglePlayPause,
  mockCloseTafsir,
  mockCloseAdhkarPanel,
  mockCloseFavorites,
  mockCloseSettings,
  mockHideQiblaCompass,
  mockTogglePrayerBar,
} = vi.hoisted(() => ({
  mockState: {
    currentSurah: 1,
    currentAyahIndex: 0,
    currentReciter: 'ar.alafasy',
    repeatCounter: 0,
    hifdhMode: false,
    repeatMode: false,
    isPlaying: false,
    ayahsAudios: [] as string[],
    surahData: null as { name: string; ayahs: { numberInSurah: number; text: string }[] } | null,
    surahList: [] as { number: number; name: string; numberOfAyahs: number }[],
  },
  mockStorage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  mockLoadSurah: vi.fn(),
  mockLoadAudioUrlsForSession: vi.fn(),
  mockHighlightCurrentAyah: vi.fn(),
  mockCacheSurahAudio: vi.fn(),
  mockIsSurahCached: vi.fn(),
  mockPlayCurrentAyah: vi.fn().mockResolvedValue(undefined),
  mockTogglePlayPause: vi.fn(),
  mockCloseTafsir: vi.fn(),
  mockCloseAdhkarPanel: vi.fn(),
  mockCloseFavorites: vi.fn(),
  mockCloseSettings: vi.fn(),
  mockHideQiblaCompass: vi.fn(),
  mockTogglePrayerBar: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) =>
    (translations[key] || key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] || ''),
}));
vi.mock('../state.js', () => ({ state: mockState }));
vi.mock('../storage.js', () => ({ storage: mockStorage }));
vi.mock('../surah-loader.js', () => ({
  loadSurah: mockLoadSurah,
  loadAudioUrlsForSession: mockLoadAudioUrlsForSession,
  highlightCurrentAyah: mockHighlightCurrentAyah,
}));
vi.mock('../audio.js', () => ({ playCurrentAyah: mockPlayCurrentAyah, togglePlayPause: mockTogglePlayPause }));
vi.mock('../audio-cache.js', () => ({ cacheSurahAudio: mockCacheSurahAudio, isSurahCached: mockIsSurahCached }));
vi.mock('../tafsir.js', () => ({ closeTafsir: mockCloseTafsir }));
vi.mock('../adhkar.js', () => ({ closeAdhkarPanel: mockCloseAdhkarPanel }));
vi.mock('../favorites.js', () => ({ closeFavorites: mockCloseFavorites }));
vi.mock('../settings.js', () => ({ closeSettings: mockCloseSettings }));
vi.mock('../prayer.js', () => ({ hideQiblaCompass: mockHideQiblaCompass, togglePrayerBar: mockTogglePrayerBar }));
vi.mock('../reciters.js', () => ({
  RECITERS: [{ id: 'ar.alafasy' }, { id: 'ar.husary' }],
  getReciterDisplayName: (reciter: { id: string }) => (reciter.id === 'ar.husary' ? 'الحصري' : 'العفاسي'),
}));

import { closeHifzRoom, initHifzRoom, isHifzRoomOpen, openHifzRoom } from '../hifz-room.js';

function dispatchPointer(target: HTMLElement, type: string, clientX: number, pointerType = 'mouse', button = 0): void {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    button: { value: button },
  });
  target.dispatchEvent(event);
}

function addPlayerControls(): { hifdhClick: ReturnType<typeof vi.fn>; repeatClick: ReturnType<typeof vi.fn> } {
  const hifdh = document.createElement('button');
  hifdh.id = 'hifdhBtn';
  const repeat = document.createElement('button');
  repeat.id = 'repeatBtn';
  const player = document.createElement('section');
  player.id = 'player';
  player.classList.add('collapsed');
  const from = document.createElement('select');
  from.id = 'repeatFrom';
  const to = document.createElement('select');
  to.id = 'repeatTo';
  const times = document.createElement('select');
  times.id = 'repeatTimes';
  for (let i = 1; i <= 7; i++) {
    from.append(new Option(String(i), String(i)));
    to.append(new Option(String(i), String(i)));
  }
  for (const value of [2, 3, 5, 10, 20]) times.append(new Option(String(value), String(value)));
  const hifdhClick = vi.fn(() => hifdh.classList.add('active'));
  const repeatClick = vi.fn(() => repeat.classList.add('active'));
  hifdh.addEventListener('click', hifdhClick);
  repeat.addEventListener('click', repeatClick);
  document.body.append(hifdh, repeat, player, from, to, times);
  return { hifdhClick, repeatClick };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  document.body.className = '';
  document.documentElement.className = '';
  document.documentElement.dir = 'rtl';
  mockState.currentSurah = 1;
  mockState.currentAyahIndex = 1;
  mockState.currentReciter = 'ar.alafasy';
  mockState.repeatCounter = 0;
  mockState.hifdhMode = false;
  mockState.repeatMode = false;
  mockState.isPlaying = false;
  mockState.ayahsAudios = [];
  mockState.surahData = {
    name: 'الفاتحة',
    ayahs: Array.from({ length: 7 }, (_, index) => ({ numberInSurah: index + 1, text: `آية ${index + 1}` })),
  };
  mockState.surahList = [
    { number: 1, name: 'الفاتحة', numberOfAyahs: 7 },
    { number: 67, name: 'الملك', numberOfAyahs: 30 },
  ];
  mockStorage.get.mockReturnValue(null);
  mockStorage.set.mockReturnValue(true);
  mockLoadSurah.mockResolvedValue(undefined);
  mockPlayCurrentAyah.mockResolvedValue(undefined);
  mockLoadAudioUrlsForSession.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => `https://audio.test/${index + 1}.mp3`),
  );
  mockCacheSurahAudio.mockResolvedValue(undefined);
  mockIsSurahCached.mockResolvedValue(false);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Hifz Room', () => {
  it('injects a web-only inert session form exactly once', () => {
    initHifzRoom();
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    expect(document.querySelectorAll('#hifzRoom')).toHaveLength(1);
    expect(room.getAttribute('aria-hidden')).toBe('true');
    expect(room.hasAttribute('inert')).toBe(true);
    expect(room.querySelectorAll('.hifz-room-steps li')).toHaveLength(3);
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomSurah')!.value).toBe('1');
    expect(room.querySelector<HTMLInputElement>('#hifzRoomSurahSearch')!.value).toBe('الفاتحة');
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value).toBe('2');
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('الفاتحة');
    expect(room.querySelector('#hifzRoomToday')).toBeNull();
    expect(room.querySelector<HTMLInputElement>('#hifzRoomCustomRepeat')!.max).toBe('100');
    expect(room.querySelector<HTMLInputElement>('#hifzRoomReviewAt')).not.toBeNull();
    expect(document.getElementById('hifzRoomToggle')!.textContent).toBe('غرفة الحفظ');
    expect(document.getElementById('hifzRoomToggle')!.textContent).not.toContain('📖');
  });

  it('places the memorization trigger inside the reader tools rail when available', () => {
    const rail = document.createElement('aside');
    rail.id = 'readerSideTools';
    document.body.append(rail);

    initHifzRoom();

    expect(rail.querySelector('#hifzRoomToggle')).not.toBeNull();
  });

  it('does not inject inside the Capacitor-native container', () => {
    document.body.classList.add('capacitor-native');
    initHifzRoom();
    expect(document.getElementById('hifzRoom')).toBeNull();
    expect(document.getElementById('hifzRoomToggle')).toBeNull();
  });

  it('opens and closes while synchronizing accessibility state', () => {
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    const toggle = document.getElementById('hifzRoomToggle')!;
    openHifzRoom();
    expect(isHifzRoomOpen()).toBe(true);
    expect(room.getAttribute('aria-hidden')).toBe('false');
    expect(room.hasAttribute('inert')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    closeHifzRoom();
    expect(isHifzRoomOpen()).toBe(false);
    expect(room.getAttribute('aria-hidden')).toBe('true');
    expect(room.hasAttribute('inert')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes competing side surfaces before opening the Hifz Room', () => {
    document.body.classList.add('prayer-curtain-active');
    initHifzRoom();

    openHifzRoom();

    expect(mockCloseTafsir).toHaveBeenCalledTimes(1);
    expect(mockCloseAdhkarPanel).toHaveBeenCalledTimes(1);
    expect(mockCloseFavorites).toHaveBeenCalledTimes(1);
    expect(mockCloseSettings).toHaveBeenCalledTimes(1);
    expect(mockHideQiblaCompass).toHaveBeenCalledTimes(1);
    expect(mockTogglePrayerBar).toHaveBeenCalledTimes(1);
    expect(isHifzRoomOpen()).toBe(true);
  });

  it('uses H and Escape without capturing editable field input', () => {
    initHifzRoom();
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    expect(isHifzRoomOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    expect(isHifzRoomOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isHifzRoomOpen()).toBe(false);
  });

  it('opens from a drag on the left-edge handle', () => {
    initHifzRoom();
    const toggle = document.getElementById('hifzRoomToggle') as HTMLButtonElement;
    toggle.setPointerCapture = vi.fn();
    vi.spyOn(document.getElementById('hifzRoom')!, 'getBoundingClientRect').mockReturnValue({ width: 420 } as DOMRect);
    dispatchPointer(toggle, 'pointerdown', 24);
    dispatchPointer(toggle, 'pointermove', 204);
    dispatchPointer(toggle, 'pointerup', 204);
    expect(toggle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(isHifzRoomOpen()).toBe(true);
    expect(mockStorage.set).toHaveBeenCalledWith('hifz_curtain_reveal', 180);
    expect(document.documentElement.style.getPropertyValue('--hifz-curtain-reveal')).toBe('180px');
  });

  it('ignores a secondary mouse press on the curtain handle', () => {
    initHifzRoom();
    const toggle = document.getElementById('hifzRoomToggle')!;
    const revealBefore = document.documentElement.style.getPropertyValue('--hifz-curtain-reveal');
    dispatchPointer(toggle, 'pointerdown', 120, 'mouse', 2);
    dispatchPointer(toggle, 'pointermove', 24, 'mouse', 2);
    dispatchPointer(toggle, 'pointerup', 24, 'mouse', 2);
    expect(isHifzRoomOpen()).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--hifz-curtain-reveal')).toBe(revealBefore);
  });

  it('updates the live summary and keeps the review choice locally', () => {
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="15"]')!.click();
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '5';
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.dispatchEvent(new Event('change'));
    room.querySelector<HTMLButtonElement>('[data-hifz-review="tomorrow"]')!.click();
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('2–5');
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('15 مرات');
    expect(mockStorage.set).toHaveBeenCalledWith('hifz_plan_v1', expect.objectContaining({ review: 'tomorrow' }));
  });

  it('finds a surah by typing its name in the hifz room', () => {
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    const search = room.querySelector<HTMLInputElement>('#hifzRoomSurahSearch')!;
    search.value = 'المل';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomSurah')!.value).toBe('67');
    expect(search.value).toBe('الملك');
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.options).toHaveLength(30);
  });

  it('uses a custom repeat count up to 100 and supplies it to the existing repeat control', async () => {
    addPlayerControls();
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    const customRepeat = room.querySelector<HTMLInputElement>('#hifzRoomCustomRepeat')!;
    customRepeat.value = '37';
    customRepeat.dispatchEvent(new Event('change'));
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('37 مرات');
    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect((document.getElementById('repeatTimes') as HTMLSelectElement).value).toBe('37');
  });

  it('stores a selected custom review date and time locally', () => {
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    const reviewAt = room.querySelector<HTMLInputElement>('#hifzRoomReviewAt')!;
    reviewAt.value = '2026-08-25T19:30';
    reviewAt.dispatchEvent(new Event('change'));
    expect(mockStorage.set).toHaveBeenCalledWith(
      'hifz_plan_v1',
      expect.objectContaining({ review: 'custom', reviewAt: '2026-08-25T19:30' }),
    );
    room.querySelector<HTMLButtonElement>('[data-hifz-review="tomorrow"]')!.click();
    expect(reviewAt.value).toBe('');
  });

  it('loads the chosen portion before activating current Hifdh and repeat controls', async () => {
    const { hifdhClick, repeatClick } = addPlayerControls();
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value = '2';
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '5';
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="15"]')!.click();
    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLoadSurah).toHaveBeenCalledWith(1, { startAyah: 2 });
    expect(hifdhClick).toHaveBeenCalledTimes(1);
    expect(repeatClick).toHaveBeenCalledTimes(1);
    expect((document.getElementById('repeatFrom') as HTMLSelectElement).value).toBe('2');
    expect((document.getElementById('repeatTo') as HTMLSelectElement).value).toBe('5');
    expect((document.getElementById('repeatTimes') as HTMLSelectElement).value).toBe('15');
    expect(room.querySelector('#hifzRoomStatus')!.textContent).toContain('فُعّل الحفظ والتكرار.');
  });

  it('does not persist player preferences when loading the hifz session fails', async () => {
    addPlayerControls();
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLSelectElement>('#hifzRoomReciter')!.value = 'ar.husary';
    room.querySelector<HTMLSelectElement>('#hifzRoomSpeed')!.value = '1.25';
    mockStorage.set.mockClear();
    mockLoadSurah.mockRejectedValueOnce(new Error('offline'));

    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockStorage.set).not.toHaveBeenCalledWith('reciter', 'ar.husary');
    expect(mockStorage.set).not.toHaveBeenCalledWith('playback_speed', '1.25');
    expect(room.querySelector('#hifzRoomStatus')!.textContent).toContain('تعذر تجهيز الورد');
  });

  it('reactivates a full-surah range when a previous session left only stale active button styles', async () => {
    const { hifdhClick, repeatClick } = addPlayerControls();
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    const hifdh = document.getElementById('hifdhBtn')!;
    const repeat = document.getElementById('repeatBtn')!;
    hifdh.classList.add('active');
    repeat.classList.add('active');
    room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value = '1';
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '7';
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="3"]')!.click();

    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(hifdhClick).toHaveBeenCalledTimes(1);
    expect(repeatClick).toHaveBeenCalledTimes(1);
    expect((document.getElementById('repeatFrom') as HTMLSelectElement).value).toBe('1');
    expect((document.getElementById('repeatTo') as HTMLSelectElement).value).toBe('7');
  });

  it('downloads only the selected session range and marks it ready for offline listening', async () => {
    mockIsSurahCached.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value = '2';
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '5';
    room.querySelector<HTMLButtonElement>('#hifzRoomDownload')!.click();
    await vi.waitFor(() =>
      expect(mockCacheSurahAudio).toHaveBeenCalledWith(
        [
          'https://audio.test/2.mp3',
          'https://audio.test/3.mp3',
          'https://audio.test/4.mp3',
          'https://audio.test/5.mp3',
        ],
        1,
        'ar.alafasy',
        expect.any(Function),
      ),
    );
    await vi.waitFor(() =>
      expect(room.querySelector('#hifzRoomDownloadStatus')!.textContent).toContain('جاهزة للاستماع دون إنترنت'),
    );
    expect(mockStorage.set).toHaveBeenCalledWith('hifz_session_downloads_v1', expect.any(Object));
  });

  it('reuses a fully cached selected session instead of downloading it again', async () => {
    mockIsSurahCached.mockResolvedValue(true);
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLButtonElement>('#hifzRoomDownload')!.click();
    await vi.waitFor(() =>
      expect(room.querySelector('#hifzRoomDownloadStatus')!.textContent).toContain('محفوظة بالفعل'),
    );
    expect(mockCacheSurahAudio).not.toHaveBeenCalled();
  });

  it('runs a focused in-room session with ayah display, audio preferences, and manual hiding', async () => {
    addPlayerControls();
    const audio = document.createElement('audio');
    audio.id = 'audioPlayer';
    document.body.append(audio);
    initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value = '2';
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '3';
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="3"]')!.click();
    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();
    const stage = document.getElementById('hifzRoomStage')!;
    expect(room.classList.contains('hifz-room-focused')).toBe(true);
    expect(stage.getAttribute('aria-hidden')).toBe('false');
    expect(stage.textContent).toContain('آية 2');
    room.querySelector<HTMLButtonElement>('#hifzRoomHideText')!.click();
    expect(stage.textContent).toContain('۞');
    room.querySelector<HTMLButtonElement>('#hifzRoomHideText')!.click();
    room.querySelector<HTMLButtonElement>('#hifzRoomToggleRange')!.click();
    expect(stage.textContent).toContain('آية 3');
    room.querySelector<HTMLSelectElement>('#hifzRoomSpeed')!.value = '1.5';
    room.querySelector<HTMLSelectElement>('#hifzRoomSpeed')!.dispatchEvent(new Event('change'));
    expect(audio.playbackRate).toBe(1.5);
    expect(mockStorage.set).toHaveBeenCalledWith('playback_speed', '1.5');
    room.querySelector<HTMLSelectElement>('#hifzRoomReciter')!.value = 'ar.husary';
    room.querySelector<HTMLSelectElement>('#hifzRoomReciter')!.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockState.currentReciter).toBe('ar.husary');
    expect(mockLoadSurah).toHaveBeenCalledWith(1, { startAyah: 2 });
    room.querySelector<HTMLButtonElement>('#hifzRoomPlay')!.click();
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
    room.querySelector<HTMLButtonElement>('#hifzRoomRestart')!.click();
    expect(mockPlayCurrentAyah).toHaveBeenCalledTimes(2);
    room.querySelector<HTMLButtonElement>('#hifzRoomEnd')!.click();
    expect(room.classList.contains('hifz-room-focused')).toBe(false);
    expect(stage.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the focused session controls visible and closes on X', async () => {
    addPlayerControls();
    initHifzRoom();
    openHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(3_000);
    expect(document.body.classList.contains('hifz-room-tools-hidden')).toBe(false);
    expect(document.getElementById('player')?.classList.contains('collapsed')).toBe(true);

    document.dispatchEvent(new Event('pointermove'));
    expect(document.body.classList.contains('hifz-room-tools-hidden')).toBe(false);
    room.querySelector<HTMLButtonElement>('#hifzRoomClose')!.click();

    expect(room.classList.contains('is-open')).toBe(false);
    expect(room.classList.contains('hifz-room-focused')).toBe(false);
    expect(document.body.classList.contains('hifz-room-focused-active')).toBe(false);
    expect(document.body.classList.contains('hifz-room-tools-hidden')).toBe(false);
  });

  it('retains the room on the physical right edge when the language changes', () => {
    initHifzRoom();
    document.documentElement.dir = 'ltr';
    window.dispatchEvent(new Event('app:langchange'));
    const room = document.getElementById('hifzRoom')!;
    expect(room.dir).toBe('ltr');
    expect(room.classList.contains('hifz-room--rtl')).toBe(false);
    expect(document.getElementById('hifzRoomToggle')!.classList.contains('hifz-room-toggle--rtl')).toBe(false);
    expect(document.getElementById('hifzRoomClose')!.getAttribute('aria-label')).toBe('إغلاق غرفة الحفظ');
  });
});
