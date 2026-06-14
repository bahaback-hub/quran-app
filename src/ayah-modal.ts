import { state, immutablePush, immutableSplice } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { escapeHtml, stripTashkeel, copyToClipboard } from './utils.js';
import { CONFIG } from './config.js';
import { loadSurah } from './app.js';
import { storage } from './storage.js';
import { RECITERS, getReciterById, buildAudioUrl } from './reciters.js';
import { fetchTafsirText } from './tafsir.js';
import { apiFetch } from './api-client.js';
import { __ } from './i18n.js';

/* ===================== TYPES ===================== */

/** Reciter entry shape. */
interface ReciterEntry {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** Cached modal ayah state. */
interface ModalAyahData {
  surah: number;
  ayah: number;
  text: string;
  surahName: string;
  index: number;
}

/** Map of modal DOM element IDs to their typed element references. */
interface ModalDomMap {
  ayahModalCloseBtn: HTMLElement | null;
  ayahModalTitle: HTMLElement | null;
  ayahModalBookmarkBtn: HTMLElement | null;
  ayahModalFavBtn: HTMLElement | null;
  ayahModalNav: HTMLElement | null;
  ayahModalNextBtn: HTMLElement | null;
  ayahModalText: HTMLElement | null;
  ayahModalPage: HTMLElement | null;
  ayahModalJuz: HTMLElement | null;
  ayahModalSurahAyah: HTMLElement | null;
  ayahModalTafsirBtn: HTMLElement | null;
  ayahModalShareBtn: HTMLElement | null;
  ayahModalCopyBtn: HTMLElement | null;
  ayahModalCopySimpleBtn: HTMLElement | null;
  ayahModalCopyTafsirBtn: HTMLElement | null;
  ayahModalQariSelect: HTMLSelectElement | null;
  ayahModalPlayBtn: HTMLElement | null;
  ayahModalAudioCurrent: HTMLElement | null;
  ayahModalAudioSlider: HTMLInputElement | null;
  ayahModalAudioDuration: HTMLElement | null;
  ayahModalRepeatChk: HTMLInputElement | null;
  ayahModalDownloadBtn: HTMLElement | null;
  ayahModalAudioPlayer: HTMLAudioElement | null;
  ayahModalTafsirTabs: HTMLElement | null;
  ayahModalTafsirBody: HTMLElement | null;
}

/* ===================== MODULE STATE ===================== */

let modalEl: HTMLElement | null;

const M: ModalDomMap = {} as ModalDomMap;

let current: ModalAyahData | null = null;

let ayahAudios: string[] = [];

let audioLoadSurah: number | null = null;

/* ===================== INIT ===================== */

function cache(): void {
  modalEl = document.getElementById('ayahModal');
  const ids: (keyof ModalDomMap)[] = [
    'ayahModalCloseBtn',
    'ayahModalTitle',
    'ayahModalBookmarkBtn',
    'ayahModalFavBtn',
    'ayahModalNav',
    'ayahModalNextBtn',
    'ayahModalText',
    'ayahModalPage',
    'ayahModalJuz',
    'ayahModalSurahAyah',
    'ayahModalTafsirBtn',
    'ayahModalShareBtn',
    'ayahModalCopyBtn',
    'ayahModalCopySimpleBtn',
    'ayahModalCopyTafsirBtn',
    'ayahModalQariSelect',
    'ayahModalPlayBtn',
    'ayahModalAudioCurrent',
    'ayahModalAudioSlider',
    'ayahModalAudioDuration',
    'ayahModalRepeatChk',
    'ayahModalDownloadBtn',
    'ayahModalAudioPlayer',
    'ayahModalTafsirTabs',
    'ayahModalTafsirBody',
  ];
  for (const id of ids) {
    (M as unknown as Record<string, HTMLElement | null>)[id] = document.getElementById(id);
  }
}

export function initAyahModal(): void {
  cache();
  bind();
  populateQaris();
}

/* ===================== OPEN / CLOSE ===================== */

export function openAyahModal(data: ModalAyahData): void {
  if (!modalEl || !data) return;
  let idx: number = data.index;
  if (idx === -1 && state.fullQuranText) {
    idx = state.fullQuranText.findIndex((a) => a.surah === data.surah && a.ayah === data.ayah);
  }
  current = { ...data, index: idx };
  modalEl.classList.remove('hidden');
  modalEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  M.ayahModalTitle!.textContent = `${__('ayah_modal_title', String(data.ayah), data.surahName)}`;
  M.ayahModalText!.textContent = data.text;
  M.ayahModalSurahAyah!.textContent = `${data.surahName} — ${__('ayah')} ${data.ayah}`;
  updateNav();
  updateFavBtn();
  loadMeta();
  loadTafsirTab('ar-tafsir-muyassar');
  resetAudio();
  activateTab('ar-tafsir-muyassar');
}

export function closeAyahModal(): void {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.style.display = 'none';
  document.body.style.overflow = '';
  pauseModalAudio();
  current = null;
}

function bind(): void {
  M.ayahModalCloseBtn?.addEventListener('click', closeAyahModal);
  modalEl?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === modalEl) closeAyahModal();
  });
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !modalEl?.classList.contains('hidden')) closeAyahModal();
  });
  M.ayahModalNextBtn?.addEventListener('click', goToNextAyah);
  M.ayahModalBookmarkBtn?.addEventListener('click', saveBookmark);
  M.ayahModalFavBtn?.addEventListener('click', toggleModalFav);
  M.ayahModalTafsirBtn?.addEventListener('click', () => {
    if (current) {
      closeAyahModal();
      loadSurah(current.surah, { startAyah: current.ayah });
    }
  });
  M.ayahModalShareBtn?.addEventListener('click', shareModalAyah);
  M.ayahModalCopyBtn?.addEventListener('click', () => copyModalAyah(false));
  M.ayahModalCopySimpleBtn?.addEventListener('click', () => copyModalAyah(true));
  M.ayahModalCopyTafsirBtn?.addEventListener('click', copyModalWithTafsir);
  M.ayahModalPlayBtn?.addEventListener('click', toggleModalAudio);
  M.ayahModalQariSelect?.addEventListener('change', resetAudio);
  const audioPlayer = M.ayahModalAudioPlayer;
  const audioSlider = M.ayahModalAudioSlider;
  audioPlayer?.addEventListener('timeupdate', onAudioTime);
  audioPlayer?.addEventListener('loadedmetadata', () => {
    if (audioSlider) audioSlider.max = String(Math.floor(audioPlayer.duration || 0));
    M.ayahModalAudioDuration!.textContent = formatTime(audioPlayer?.duration || 0);
  });
  audioPlayer?.addEventListener('ended', onAudioEnded);
  audioSlider?.addEventListener('input', () => {
    if (audioPlayer) audioPlayer.currentTime = parseFloat(audioSlider.value);
  });
  M.ayahModalDownloadBtn?.addEventListener('click', downloadModalAyah);
  M.ayahModalTafsirTabs?.addEventListener('click', (e: MouseEvent) => {
    const tab = (e.target as HTMLElement).closest('.ayah-modal-tafsir-tab') as HTMLElement | null;
    if (tab) loadTafsirTab(tab.dataset.edition as string);
  });
}

/* ===================== NAVIGATION ===================== */

function goToNextAyah(): void {
  if (!current || !state.fullQuranText) return;
  const idx: number = current.index + 1;
  if (idx >= state.fullQuranText.length) {
    showToast(__('last_ayah_in_quran'), 'error');
    return;
  }
  const next = state.fullQuranText[idx];
  current = { surah: next.surah, ayah: next.ayah, text: next.text, surahName: next.surahName, index: idx };
  M.ayahModalTitle!.textContent = `${__('ayah_modal_title', String(next.ayah), next.surahName)}`;
  M.ayahModalText!.textContent = next.text;
  M.ayahModalSurahAyah!.textContent = `${next.surahName} — ${__('ayah')} ${next.ayah}`;
  updateNav();
  updateFavBtn();
  loadMeta();
  loadTafsirTab(document.querySelector('.ayah-modal-tafsir-tab.active')?.dataset?.edition || 'ar-tafsir-muyassar');
  resetAudio();
}

function updateNav(): void {
  if (!current || !state.fullQuranText) return;
  const next: number = current.index + 1;
  if (next < state.fullQuranText.length) {
    const n = state.fullQuranText[next];
    M.ayahModalNextBtn!.textContent = `${__('next_ayah_label', String(n.ayah), n.surahName)}`;
    M.ayahModalNav!.style.display = '';
  } else {
    M.ayahModalNav!.style.display = 'none';
  }
}

/* ===================== META ===================== */

async function loadMeta(): Promise<void> {
  if (!current) return;
  M.ayahModalPage!.textContent = __('page_loading');
  M.ayahModalJuz!.textContent = __('juz_loading');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await apiFetch(`/ayah/${current.surah}:${current.ayah}`, { silent: true });
    if (d?.data) {
      M.ayahModalPage!.textContent = `${__('page_info', d.data.page || '--')}`;
      M.ayahModalJuz!.textContent = `${__('juz_info', d.data.juz || '--')}`;
    }
  } catch {
    M.ayahModalPage!.textContent = `${__('page_info', '--')}`;
    M.ayahModalJuz!.textContent = `${__('juz_info', '--')}`;
  }
}

/* ===================== BOOKMARK & FAVORITE ===================== */

function saveBookmark(): void {
  if (!current) return;
  storage.set('bookmark', {
    surah: current.surah,
    surahName: current.surahName,
    ayah: current.ayah,
    text: current.text,
    timestamp: Date.now(),
  });
  showToast(__('bookmark_position_saved'), 'success');
}

function toggleModalFav(): void {
  if (!current) return;
  const key: string = `${current.surah}:${current.ayah}`;
  const idx: number = state.favorites.findIndex((f) => f.key === key);
  if (idx !== -1) {
    immutableSplice(state, 'favorites', idx, 1);
    showToast(__('removed_from_favorites'), '');
  } else {
    immutablePush(state, 'favorites', {
      key,
      surah: current.surah,
      surahName: current.surahName,
      ayah: current.ayah,
      text: current.text,
      timestamp: Date.now(),
    });
    showToast(__('added_to_favorites'), '');
  }
  updateFavBtn();
  storage.set('favorites', state.favorites);
}

function updateFavBtn(): void {
  if (!current) return;
  const key: string = `${current.surah}:${current.ayah}`;
  const isFav: boolean = state.favorites.some((f) => f.key === key);
  M.ayahModalFavBtn!.textContent = isFav ? __('in_favorites') : __('add_to_favorites');
  M.ayahModalFavBtn!.classList.toggle('active', isFav);
}

/* ===================== COPY & SHARE ===================== */

function copyModalAyah(simple: boolean): void {
  if (!current) return;
  const text: string = simple ? stripTashkeel(current.text) : current.text;
  copyToClipboard(text);
  showToast(simple ? __('copy_simple') : __('copy_text'), 'success');
}

async function copyModalWithTafsir(): Promise<void> {
  if (!current) return;
  const edition: string =
    document.querySelector('.ayah-modal-tafsir-tab.active')?.dataset?.edition || 'ar-tafsir-muyassar';
  const tafsir: string | null = await fetchTafsirText(edition, current.surah, current.ayah);
  const text: string = `${current.text}\n\n${tafsir || ''}`;
  copyToClipboard(text);
  showToast(__('copy_with_tafsir'), 'success');
}

function shareModalAyah(): void {
  if (!current) return;
  const text: string = `﴿${current.text}﴾ — ${current.surahName}، ${__('ayah')} ${current.ayah}`;
  if (navigator.share) {
    navigator.share({ title: __('app_title'), text }).catch(() => {});
  } else {
    copyToClipboard(text);
    showToast(__('copy_for_share'), 'success');
  }
}

/* ===================== AUDIO ===================== */

function populateQaris(): void {
  if (!M.ayahModalQariSelect) return;
  M.ayahModalQariSelect.innerHTML = RECITERS.map(
    (r: ReciterEntry) => `<option value="${r.id}">${r.name}</option>`
  ).join('');
}

async function ensureModalAudio(): Promise<void> {
  if (!current) return;
  const reciterId: string = M.ayahModalQariSelect?.value || CONFIG.DEFAULT_RECITER;
  if (audioLoadSurah === current.surah && ayahAudios.length) return;
  const reciterInfo: ReciterEntry = getReciterById(reciterId) as ReciterEntry;
  if (reciterInfo.source === 'mp3quran') {
    ayahAudios = [buildAudioUrl(reciterInfo, current.surah)!];
    audioLoadSurah = current.surah;
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await apiFetch(`/surah/${current.surah}/${reciterId}`, { silent: true });
    if (d?.data?.ayahs) {
      ayahAudios = d.data.ayahs.map((a: { audio: string }) => a.audio);
      audioLoadSurah = current.surah;
    }
  } catch {
    ayahAudios = [];
    audioLoadSurah = null;
  }
}

function toggleModalAudio(): void {
  if (!current) return;
  const player: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  if (!player) return;
  if (!player.paused) {
    player.pause();
    M.ayahModalPlayBtn!.textContent = __('ayah_modal_play');
    return;
  }

  // Use existing state audio if same surah is loaded
  const cur = current; // capture to satisfy TS null check after early return above
  const surahData = state.surahData as Record<string, unknown> | null;
  if (surahData?.number === cur!.surah && state.ayahsAudios?.length) {
    // Find surah-internal index instead of using absolute Quran index
    const surahAyahs = (surahData as Record<string, unknown[]>).ayahs;
    let surahInternalIdx = -1;
    if (Array.isArray(surahAyahs)) {
      surahInternalIdx = surahAyahs.findIndex(
        (a: unknown) => (a as Record<string, unknown>)?.numberInSurah === cur!.ayah
      );
    }
    const audioIdx = surahInternalIdx >= 0 ? surahInternalIdx : cur!.ayah - 1;
    const url: string | undefined = state.ayahsAudios[audioIdx];
    if (url) {
      player.src = url;
      player
        .play()
        .then(() => {
          M.ayahModalPlayBtn!.textContent = __('ayah_modal_pause');
        })
        .catch(() => showToast(__('audio_error'), 'error'));
      return;
    }
  }

  ensureModalAudio().then(() => {
    if (!current) return;
    const url: string | undefined = ayahAudios[0];
    if (!url) {
      showToast(__('no_audio_ayah'), 'error');
      return;
    }
    player.src = url;
    player
      .play()
      .then(() => {
        M.ayahModalPlayBtn!.textContent = __('ayah_modal_pause');
      })
      .catch(() => showToast(__('audio_error'), 'error'));
  });
}

function pauseModalAudio(): void {
  const player: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  if (player) {
    player.pause();
    M.ayahModalPlayBtn!.textContent = __('ayah_modal_play');
  }
}

function resetAudio(): void {
  const player: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  const slider: HTMLInputElement | null = M.ayahModalAudioSlider;
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  M.ayahModalPlayBtn!.textContent = __('ayah_modal_play');
  M.ayahModalAudioCurrent!.textContent = '0:00';
  M.ayahModalAudioDuration!.textContent = '0:00';
  if (slider) {
    slider.value = '0';
    slider.max = '100';
  }
  audioLoadSurah = null;
  ayahAudios = [];
}

function onAudioTime(): void {
  const p: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  const slider: HTMLInputElement | null = M.ayahModalAudioSlider;
  if (!p || !p.duration) return;
  M.ayahModalAudioCurrent!.textContent = formatTime(p.currentTime);
  if (slider) slider.value = String(Math.floor(p.currentTime));
}

function onAudioEnded(): void {
  const player: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  const chk: HTMLInputElement | null = M.ayahModalRepeatChk;
  M.ayahModalPlayBtn!.textContent = __('ayah_modal_play');
  if (chk?.checked && player) {
    player.currentTime = 0;
    player.play().catch(() => {});
  }
}

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m: number = Math.floor(secs / 60);
  const s: number = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function downloadModalAyah(): void {
  if (!current) return;
  const player: HTMLAudioElement | null = M.ayahModalAudioPlayer;
  if (!player || !player.src) {
    showToast(__('play_ayah_first'), 'error');
    return;
  }
  const a: HTMLAnchorElement = document.createElement('a');
  a.href = player.src;
  a.download = `ayah-${current.surah}-${current.ayah}.mp3`;
  a.click();
}

/* ===================== TAFSIR TABS ===================== */

async function loadTafsirTab(edition: string): Promise<void> {
  if (!current || !edition) return;
  activateTab(edition);
  M.ayahModalTafsirBody!.innerHTML = `<p class="tafsir-loading">${__('tafsir_loading')}</p>`;
  try {
    const text: string | null = await fetchTafsirText(edition, current.surah, current.ayah);
    if (text) {
      M.ayahModalTafsirBody!.innerHTML = `<p class="tafsir-text">${escapeHtml(text)}</p>`;
    } else {
      M.ayahModalTafsirBody!.innerHTML = `<p class="tafsir-error">${__('no_tafsir_available')}</p>`;
    }
  } catch {
    M.ayahModalTafsirBody!.innerHTML = `<p class="tafsir-error">${__('tafsir_error')}</p>`;
  }
}

function activateTab(edition: string): void {
  M.ayahModalTafsirTabs?.querySelectorAll('.ayah-modal-tafsir-tab').forEach((t: Element) => {
    t.classList.toggle('active', t.dataset.edition === edition);
  });
}
