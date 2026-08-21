import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  close: 'إغلاق', hifz_room: 'غرفة الحفظ', hifz_room_eyebrow: 'مساحتك الهادئة', hifz_room_tagline: 'وردك يتقدم بثبات.',
  hifz_room_today: 'وردك الآن', hifz_room_session_hint: 'استخدم أدوات المشغل.', hifz_room_start: 'ابدأ جلسة الحفظ',
  hifz_room_review: 'المراجعة التالية', hifz_room_session_active: 'فُعّل الحفظ والتكرار.', hifz_room_footnote: 'مساحة هادئة للحفظ.',
  hifz_room_step_portion: 'اختر الورد', hifz_room_step_repeat: 'اضبط التكرار', hifz_room_step_start: 'ابدأ',
  hifz_room_surah: 'السورة', hifz_room_from_ayah: 'من آية', hifz_room_to_ayah: 'إلى آية', hifz_room_repeat: 'عدد التكرارات',
  hifz_room_summary: '{0} — الآيات {1}–{2} — {3} مرات', hifz_room_return_reader: 'العودة إلى القراءة',
  hifz_room_review_today: 'مساء اليوم', hifz_room_review_tomorrow: 'غداً', hifz_room_review_later: 'لاحقاً',
  hifz_room_loading: 'جارٍ تجهيز الورد في القارئ…', hifz_room_load_failed: 'تعذر تجهيز الورد. حاول مرة أخرى.',
};

const { mockState, mockStorage, mockLoadSurah } = vi.hoisted(() => ({
  mockState: {
    currentSurah: 1,
    currentAyahIndex: 0,
    surahData: null as { name: string; ayahs: { numberInSurah: number }[] } | null,
    surahList: [] as { number: number; name: string; numberOfAyahs: number }[],
  },
  mockStorage: { get: vi.fn(), set: vi.fn() },
  mockLoadSurah: vi.fn(),
}));

vi.mock('../i18n.js', () => ({ __: (key: string, ...args: string[]) => (translations[key] || key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] || '') }));
vi.mock('../state.js', () => ({ state: mockState }));
vi.mock('../storage.js', () => ({ storage: mockStorage }));
vi.mock('../surah-loader.js', () => ({ loadSurah: mockLoadSurah }));

import { closeHifzRoom, initHifzRoom, isHifzRoomOpen, openHifzRoom } from '../hifz-room.js';

function dispatchPointer(target: HTMLElement, type: string, clientX: number, pointerType = 'mouse'): void {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, { clientX: { value: clientX }, pointerId: { value: 1 }, pointerType: { value: pointerType } });
  target.dispatchEvent(event);
}

function addPlayerControls(): { hifdhClick: ReturnType<typeof vi.fn>; repeatClick: ReturnType<typeof vi.fn> } {
  const hifdh = document.createElement('button'); hifdh.id = 'hifdhBtn';
  const repeat = document.createElement('button'); repeat.id = 'repeatBtn';
  const player = document.createElement('section'); player.id = 'player'; player.classList.add('collapsed');
  const from = document.createElement('select'); from.id = 'repeatFrom';
  const to = document.createElement('select'); to.id = 'repeatTo';
  const times = document.createElement('select'); times.id = 'repeatTimes';
  for (let i = 1; i <= 7; i++) { from.append(new Option(String(i), String(i))); to.append(new Option(String(i), String(i))); }
  for (const value of [2, 3, 5, 10, 20]) times.append(new Option(String(value), String(value)));
  const hifdhClick = vi.fn(() => hifdh.classList.add('active'));
  const repeatClick = vi.fn(() => repeat.classList.add('active'));
  hifdh.addEventListener('click', hifdhClick); repeat.addEventListener('click', repeatClick);
  document.body.append(hifdh, repeat, player, from, to, times);
  return { hifdhClick, repeatClick };
}

beforeEach(() => {
  document.body.innerHTML = ''; document.body.className = ''; document.documentElement.className = ''; document.documentElement.dir = 'rtl';
  mockState.currentSurah = 1; mockState.currentAyahIndex = 1;
  mockState.surahData = { name: 'الفاتحة', ayahs: Array.from({ length: 7 }, (_, index) => ({ numberInSurah: index + 1 })) };
  mockState.surahList = [
    { number: 1, name: 'الفاتحة', numberOfAyahs: 7 },
    { number: 67, name: 'الملك', numberOfAyahs: 30 },
  ];
  mockStorage.get.mockReturnValue(null); mockStorage.set.mockReturnValue(true); mockLoadSurah.mockResolvedValue(undefined);
  vi.clearAllMocks();
});

afterEach(() => { document.body.innerHTML = ''; });

describe('Hifz Room', () => {
  it('injects a web-only inert session form exactly once', () => {
    initHifzRoom(); initHifzRoom();
    const room = document.getElementById('hifzRoom')!;
    expect(document.querySelectorAll('#hifzRoom')).toHaveLength(1);
    expect(room.getAttribute('aria-hidden')).toBe('true'); expect(room.hasAttribute('inert')).toBe(true);
    expect(room.querySelectorAll('.hifz-room-steps li')).toHaveLength(3);
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomSurah')!.value).toBe('1');
    expect(room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value).toBe('2');
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('الفاتحة');
  });

  it('does not inject inside the Capacitor-native container', () => {
    document.body.classList.add('capacitor-native'); initHifzRoom();
    expect(document.getElementById('hifzRoom')).toBeNull(); expect(document.getElementById('hifzRoomToggle')).toBeNull();
  });

  it('opens and closes while synchronizing accessibility state', () => {
    initHifzRoom(); const room = document.getElementById('hifzRoom')!; const toggle = document.getElementById('hifzRoomToggle')!;
    openHifzRoom(); expect(isHifzRoomOpen()).toBe(true); expect(room.getAttribute('aria-hidden')).toBe('false'); expect(room.hasAttribute('inert')).toBe(false); expect(toggle.getAttribute('aria-expanded')).toBe('true');
    closeHifzRoom(); expect(isHifzRoomOpen()).toBe(false); expect(room.getAttribute('aria-hidden')).toBe('true'); expect(room.hasAttribute('inert')).toBe(true); expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses H and Escape without capturing editable field input', () => {
    initHifzRoom(); const input = document.createElement('input'); document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true })); expect(isHifzRoomOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true })); expect(isHifzRoomOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(isHifzRoomOpen()).toBe(false);
  });

  it('opens from a drag on the right-edge handle', () => {
    initHifzRoom(); const toggle = document.getElementById('hifzRoomToggle') as HTMLButtonElement;
    toggle.setPointerCapture = vi.fn(); vi.spyOn(document.getElementById('hifzRoom')!, 'getBoundingClientRect').mockReturnValue({ width: 420 } as DOMRect);
    dispatchPointer(toggle, 'pointerdown', 900); dispatchPointer(toggle, 'pointermove', 720); dispatchPointer(toggle, 'pointerup', 720);
    expect(toggle.setPointerCapture).toHaveBeenCalledWith(1); expect(isHifzRoomOpen()).toBe(true);
  });

  it('updates the live summary and keeps the review choice locally', () => {
    initHifzRoom(); const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="10"]')!.click();
    room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '5'; room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.dispatchEvent(new Event('change'));
    room.querySelector<HTMLButtonElement>('[data-hifz-review="tomorrow"]')!.click();
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('2–5');
    expect(room.querySelector('#hifzRoomSummary')!.textContent).toContain('10 مرات');
    expect(mockStorage.set).toHaveBeenCalledWith('hifz_plan_v1', expect.objectContaining({ review: 'tomorrow' }));
  });

  it('loads the chosen portion before activating current Hifdh and repeat controls', async () => {
    const { hifdhClick, repeatClick } = addPlayerControls(); initHifzRoom(); const room = document.getElementById('hifzRoom')!;
    room.querySelector<HTMLSelectElement>('#hifzRoomFrom')!.value = '2'; room.querySelector<HTMLSelectElement>('#hifzRoomTo')!.value = '5';
    room.querySelector<HTMLButtonElement>('[data-hifz-repeat="10"]')!.click(); room.querySelector<HTMLButtonElement>('#hifzRoomStart')!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(mockLoadSurah).toHaveBeenCalledWith(1, { startAyah: 2 }); expect(hifdhClick).toHaveBeenCalledTimes(1); expect(repeatClick).toHaveBeenCalledTimes(1);
    expect((document.getElementById('repeatFrom') as HTMLSelectElement).value).toBe('2'); expect((document.getElementById('repeatTo') as HTMLSelectElement).value).toBe('5'); expect((document.getElementById('repeatTimes') as HTMLSelectElement).value).toBe('10');
    expect(room.querySelector('#hifzRoomStatus')!.textContent).toContain('فُعّل الحفظ والتكرار.');
  });

  it('retains the room on the physical right edge when the language changes', () => {
    initHifzRoom(); document.documentElement.dir = 'ltr'; window.dispatchEvent(new Event('app:langchange'));
    const room = document.getElementById('hifzRoom')!;
    expect(room.dir).toBe('ltr'); expect(room.classList.contains('hifz-room--rtl')).toBe(true); expect(document.getElementById('hifzRoomClose')!.getAttribute('aria-label')).toBe('إغلاق غرفة الحفظ');
  });
});
