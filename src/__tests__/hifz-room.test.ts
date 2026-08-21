import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  close: 'إغلاق',
  hifz_room: 'غرفة الحفظ',
  hifz_room_eyebrow: 'مساحتك الهادئة',
  hifz_room_tagline: 'وردك يتقدم بثبات.',
  hifz_room_today: 'وردك الآن',
  hifz_room_current_range: 'ابدأ من موضعك الحالي',
  hifz_room_session_hint: 'استخدم أدوات المشغل.',
  hifz_room_start: 'ابدأ جلسة الحفظ',
  hifz_room_review: 'المراجعة التالية',
  hifz_room_review_empty: 'حدّد النطاق للبدء.',
  hifz_room_session_active: 'فُعّل الحفظ والتكرار.',
  hifz_room_footnote: 'مساحة هادئة للحفظ.',
};

vi.mock('../i18n.js', () => ({
  __: (key: string) => translations[key] || key,
}));

import { closeHifzRoom, initHifzRoom, isHifzRoomOpen, openHifzRoom } from '../hifz-room.js';

function dispatchPointer(target: HTMLElement, type: string, clientX: number, pointerType = 'mouse'): void {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  });
  target.dispatchEvent(event);
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  document.documentElement.className = '';
  document.documentElement.dir = 'rtl';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Hifz Room', () => {
  it('injects a web-only, inert room exactly once', () => {
    initHifzRoom();
    initHifzRoom();

    const room = document.getElementById('hifzRoom');
    expect(room).not.toBeNull();
    expect(document.querySelectorAll('#hifzRoom')).toHaveLength(1);
    expect(room!.getAttribute('aria-hidden')).toBe('true');
    expect(room!.hasAttribute('inert')).toBe(true);
    expect(room!.classList.contains('hifz-room--rtl')).toBe(true);
    expect(document.getElementById('hifzRoomToggle')!.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('hifzRoomBackdrop')).not.toBeNull();
    expect(isHifzRoomOpen()).toBe(false);
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
    expect(document.body.classList.contains('hifz-room-active')).toBe(true);

    closeHifzRoom();
    expect(isHifzRoomOpen()).toBe(false);
    expect(room.getAttribute('aria-hidden')).toBe('true');
    expect(room.hasAttribute('inert')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('hifz-room-active')).toBe(false);
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

  it('toggles from a click and opens when dragged left from the right-edge handle', () => {
    initHifzRoom();
    const toggle = document.getElementById('hifzRoomToggle') as HTMLButtonElement;
    toggle.setPointerCapture = vi.fn();
    vi.spyOn(document.getElementById('hifzRoom')!, 'getBoundingClientRect').mockReturnValue({
      width: 420,
    } as DOMRect);

    toggle.click();
    expect(isHifzRoomOpen()).toBe(true);
    toggle.click();
    expect(isHifzRoomOpen()).toBe(false);

    dispatchPointer(toggle, 'pointerdown', 900);
    dispatchPointer(toggle, 'pointermove', 720);
    dispatchPointer(toggle, 'pointerup', 720);
    expect(toggle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(isHifzRoomOpen()).toBe(true);
  });

  it('activates existing Hifdh and repeat controls only when they are inactive', () => {
    const hifdhButton = document.createElement('button');
    hifdhButton.id = 'hifdhBtn';
    const repeatButton = document.createElement('button');
    repeatButton.id = 'repeatBtn';
    const player = document.createElement('section');
    player.id = 'player';
    player.classList.add('collapsed');
    const hifdhClick = vi.fn();
    const repeatClick = vi.fn();
    hifdhButton.addEventListener('click', hifdhClick);
    repeatButton.addEventListener('click', repeatClick);
    document.body.append(hifdhButton, repeatButton, player);
    initHifzRoom();

    (document.getElementById('hifzRoomStart') as HTMLButtonElement).click();
    expect(hifdhClick).toHaveBeenCalledTimes(1);
    expect(repeatClick).toHaveBeenCalledTimes(1);
    expect(player.classList.contains('collapsed')).toBe(false);
    expect(document.body.classList.contains('player-expanded')).toBe(true);
    expect(document.getElementById('hifzRoomSessionHint')!.textContent).toContain('فُعّل الحفظ والتكرار.');

    hifdhButton.classList.add('active');
    repeatButton.classList.add('active');
    (document.getElementById('hifzRoomStart') as HTMLButtonElement).click();
    expect(hifdhClick).toHaveBeenCalledTimes(1);
    expect(repeatClick).toHaveBeenCalledTimes(1);
  });

  it('updates its text direction on a language-change event while remaining on the right', () => {
    initHifzRoom();
    document.documentElement.dir = 'ltr';
    window.dispatchEvent(new Event('app:langchange'));

    const room = document.getElementById('hifzRoom')!;
    expect(room.dir).toBe('ltr');
    expect(room.classList.contains('hifz-room--rtl')).toBe(true);
    expect(document.getElementById('hifzRoomClose')!.getAttribute('aria-label')).toBe('إغلاق غرفة الحفظ');
  });
});
