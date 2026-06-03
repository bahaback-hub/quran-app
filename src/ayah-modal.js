import { state } from "./state.js";
import { dom } from "./dom.js";
import { showToast } from "./ui.js";
import { escapeHtml, stripTashkeel } from "./utils.js";
import { CONFIG } from "./config.js";
import { copyToClipboard } from "./utils.js";
import { loadSurah } from "./app.js";
import { storage } from "./storage.js";
import { RECITERS, getReciterById, buildAudioUrl } from "./reciters.js";
import { fetchTafsirText } from "./tafsir.js";
import { apiFetch } from "./api-client.js";

/** @type {Element} */
let modalEl;

/** @type {Object<string, Element>} */
const M = {};

/** @type {{surah:number, ayah:number, text:string, surahName:string, index:number}|null} */
let current = null;

/** @type {string[]} */
let ayahAudios = [];

/** @type {number|null} */
let audioLoadSurah = null;

function cache() {
  modalEl = document.getElementById('ayahModal');
  const ids = [
    'ayahModalCloseBtn','ayahModalTitle','ayahModalBookmarkBtn','ayahModalFavBtn',
    'ayahModalNav','ayahModalNextBtn','ayahModalText','ayahModalPage','ayahModalJuz',
    'ayahModalSurahAyah','ayahModalTafsirBtn','ayahModalShareBtn',
    'ayahModalCopyBtn','ayahModalCopySimpleBtn','ayahModalCopyTafsirBtn',
    'ayahModalQariSelect','ayahModalPlayBtn','ayahModalAudioCurrent',
    'ayahModalAudioSlider','ayahModalAudioDuration','ayahModalRepeatChk',
    'ayahModalDownloadBtn','ayahModalAudioPlayer','ayahModalTafsirTabs','ayahModalTafsirBody'
  ];
  for (const id of ids) M[id] = document.getElementById(id);
}

export function initAyahModal() {
  cache();
  bind();
  populateQaris();
}

/* ===================== OPEN / CLOSE ===================== */

export function openAyahModal(data) {
  if (!modalEl || !data) return;
  let idx = data.index;
  if (idx === -1 && state.fullQuranText) {
    idx = state.fullQuranText.findIndex(a => a.surah === data.surah && a.ayah === data.ayah);
  }
  current = { ...data, index: idx };
  modalEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  M.ayahModalTitle.textContent = `الآية ${data.ayah} من سورة ${data.surahName}`;
  M.ayahModalText.textContent = data.text;
  M.ayahModalSurahAyah.textContent = `${data.surahName} — آية ${data.ayah}`;
  updateNav();
  updateFavBtn();
  loadMeta();
  loadTafsirTab('ar-tafsir-muyassar');
  resetAudio();
  activateTab('ar-tafsir-muyassar');
}

export function closeAyahModal() {
  if (!modalEl) return;
  modalEl.style.display = 'none';
  document.body.style.overflow = '';
  pauseModalAudio();
  current = null;
}

function bind() {
  M.ayahModalCloseBtn?.addEventListener('click', closeAyahModal);
  modalEl?.addEventListener('click', e => { if (e.target === modalEl) closeAyahModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalEl?.style.display !== 'none') closeAyahModal();
  });
  M.ayahModalNextBtn?.addEventListener('click', goToNextAyah);
  M.ayahModalBookmarkBtn?.addEventListener('click', saveBookmark);
  M.ayahModalFavBtn?.addEventListener('click', toggleModalFav);
  M.ayahModalTafsirBtn?.addEventListener('click', () => {
    if (current) { closeAyahModal(); loadSurah(current.surah, { startAyah: current.ayah }); }
  });
  M.ayahModalShareBtn?.addEventListener('click', shareModalAyah);
  M.ayahModalCopyBtn?.addEventListener('click', () => copyModalAyah(false));
  M.ayahModalCopySimpleBtn?.addEventListener('click', () => copyModalAyah(true));
  M.ayahModalCopyTafsirBtn?.addEventListener('click', copyModalWithTafsir);
  M.ayahModalPlayBtn?.addEventListener('click', toggleModalAudio);
  M.ayahModalQariSelect?.addEventListener('change', resetAudio);
  const audioPlayer = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  const audioSlider = /** @type {HTMLInputElement} */ (M.ayahModalAudioSlider);
  audioPlayer?.addEventListener('timeupdate', onAudioTime);
  audioPlayer?.addEventListener('loadedmetadata', () => {
    if (audioSlider) audioSlider.max = String(Math.floor(audioPlayer.duration || 0));
    M.ayahModalAudioDuration.textContent = formatTime(audioPlayer?.duration || 0);
  });
  audioPlayer?.addEventListener('ended', onAudioEnded);
  audioSlider?.addEventListener('input', () => {
    if (audioPlayer) audioPlayer.currentTime = parseFloat(audioSlider.value);
  });
  M.ayahModalDownloadBtn?.addEventListener('click', downloadModalAyah);
  M.ayahModalTafsirTabs?.addEventListener('click', e => {
    const tab = /** @type {HTMLElement} */ (e.target).closest('.ayah-modal-tafsir-tab');
    if (tab) loadTafsirTab(/** @type {string} */ (tab.dataset.edition));
  });
}

/* ===================== NAVIGATION ===================== */

function goToNextAyah() {
  if (!current || !state.fullQuranText) return;
  const idx = current.index + 1;
  if (idx >= state.fullQuranText.length) { showToast('هذه آخر آية في القرآن', 'error'); return; }
  const next = state.fullQuranText[idx];
  current = { surah: next.surah, ayah: next.ayah, text: next.text, surahName: next.surahName, index: idx };
  M.ayahModalTitle.textContent = `الآية ${next.ayah} من سورة ${next.surahName}`;
  M.ayahModalText.textContent = next.text;
  M.ayahModalSurahAyah.textContent = `${next.surahName} — آية ${next.ayah}`;
  updateNav();
  updateFavBtn();
  loadMeta();
  loadTafsirTab(document.querySelector('.ayah-modal-tafsir-tab.active')?.dataset?.edition || 'ar-tafsir-muyassar');
  resetAudio();
}

function updateNav() {
  if (!current || !state.fullQuranText) return;
  const next = current.index + 1;
  if (next < state.fullQuranText.length) {
    const n = state.fullQuranText[next];
    M.ayahModalNextBtn.textContent = `← الآية التالية: الآية ${n.ayah} - ${n.surahName}`;
    M.ayahModalNav.style.display = '';
  } else {
    M.ayahModalNav.style.display = 'none';
  }
}

/* ===================== META ===================== */

async function loadMeta() {
  if (!current) return;
  M.ayahModalPage.textContent = '📄 الصفحة: جاري...';
  M.ayahModalJuz.textContent = '📖 الجزء: جاري...';
  try {
    const d = await apiFetch(`/ayah/${current.surah}:${current.ayah}`, { silent: true });
    if (d?.data) {
      M.ayahModalPage.textContent = `📄 الصفحة: ${d.data.page || '--'}`;
      M.ayahModalJuz.textContent = `📖 الجزء: ${d.data.juz || '--'}`;
    }
  } catch {
    M.ayahModalPage.textContent = '📄 الصفحة: --';
    M.ayahModalJuz.textContent = '📖 الجزء: --';
  }
}

/* ===================== BOOKMARK & FAVORITE ===================== */

function saveBookmark() {
  if (!current) return;
  storage.set('bookmark', {
    surah: current.surah, surahName: current.surahName,
    ayah: current.ayah, text: current.text, timestamp: Date.now()
  });
  showToast('✅ تم حفظ موضع الوقوف', 'success');
}

function toggleModalFav() {
  if (!current) return;
  const key = `${current.surah}:${current.ayah}`;
  const idx = state.favorites.findIndex(f => f.key === key);
  if (idx !== -1) {
    state.favorites.splice(idx, 1);
    showToast('💔 تمت إزالة من المفضلة', '');
  } else {
    state.favorites.push({
      key, surah: current.surah, surahName: current.surahName,
      ayah: current.ayah, text: current.text, timestamp: Date.now()
    });
    showToast('⭐ أضيفت إلى المفضلة', '');
  }
  updateFavBtn();
  storage.set('favorites', state.favorites);
}

function updateFavBtn() {
  if (!current) return;
  const key = `${current.surah}:${current.ayah}`;
  const isFav = state.favorites.some(f => f.key === key);
  M.ayahModalFavBtn.textContent = isFav ? '⭐ في المفضلة' : '⭐ إضافة للمفضلة';
  M.ayahModalFavBtn.classList.toggle('active', isFav);
}

/* ===================== COPY & SHARE ===================== */

function copyModalAyah(simple) {
  if (!current) return;
  const text = simple ? stripTashkeel(current.text) : current.text;
  copyToClipboard(text);
  showToast(simple ? '📋 نُسخ بدون تشكيل' : '📋 نُسخ النص', 'success');
}

async function copyModalWithTafsir() {
  if (!current) return;
  const edition = document.querySelector('.ayah-modal-tafsir-tab.active')?.dataset?.edition || 'ar-tafsir-muyassar';
  const tafsir = await fetchTafsirText(edition, current.surah, current.ayah);
  const text = `${current.text}\n\n${tafsir || ''}`;
  copyToClipboard(text);
  showToast('📋 نُسخ مع التفسير', 'success');
}

function shareModalAyah() {
  if (!current) return;
  const text = `﴿${current.text}﴾ — ${current.surahName}، آية ${current.ayah}`;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => {});
  } else {
    copyToClipboard(text);
    showToast('📤 نُسخ للمشاركة', 'success');
  }
}

/* ===================== AUDIO ===================== */

function populateQaris() {
  if (!M.ayahModalQariSelect) return;
  M.ayahModalQariSelect.innerHTML = RECITERS.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join('');
}

async function ensureModalAudio() {
  if (!current) return;
  const reciterId = /** @type {HTMLSelectElement} */ (M.ayahModalQariSelect)?.value || CONFIG.DEFAULT_RECITER;
  if (audioLoadSurah === current.surah && ayahAudios.length) return;
  const reciterInfo = getReciterById(reciterId);
  if (reciterInfo.source === 'mp3quran') {
    ayahAudios = [buildAudioUrl(reciterInfo, current.surah)];
    audioLoadSurah = current.surah;
    return;
  }
  try {
    const d = await apiFetch(`/surah/${current.surah}/${reciterId}`, { silent: true });
    if (d?.data?.ayahs) {
      ayahAudios = d.data.ayahs.map(a => a.audio);
      audioLoadSurah = current.surah;
    }
  } catch { ayahAudios = []; audioLoadSurah = null; }
}

function toggleModalAudio() {
  if (!current) return;
  const player = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  if (!player) return;
  if (!player.paused) { player.pause(); M.ayahModalPlayBtn.textContent = '▶️ تشغيل'; return; }

  // Use existing state audio if same surah is loaded
  if (state.surahData?.number === current.surah && state.ayahsAudios?.length) {
    const url = state.ayahsAudios[current.index >= 0 ? current.index : (current.ayah - 1)];
    if (url) {
      player.src = url;
      player.play().then(() => { M.ayahModalPlayBtn.textContent = '⏸️ إيقاف'; })
        .catch(() => showToast('تعذر تشغيل الصوت', 'error'));
      return;
    }
  }

  ensureModalAudio().then(() => {
    if (!current) return;
    const url = ayahAudios[0];
    if (!url) { showToast('لا يوجد صوت لهذه الآية', 'error'); return; }
    player.src = url;
    player.play().then(() => {
      M.ayahModalPlayBtn.textContent = '⏸️ إيقاف';
    }).catch(() => showToast('تعذر تشغيل الصوت', 'error'));
  });
}

function pauseModalAudio() {
  const player = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  if (player) {
    player.pause();
    M.ayahModalPlayBtn.textContent = '▶️ تشغيل';
  }
}

function resetAudio() {
  const player = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  const slider = /** @type {HTMLInputElement} */ (M.ayahModalAudioSlider);
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  M.ayahModalPlayBtn.textContent = '▶️ تشغيل';
  M.ayahModalAudioCurrent.textContent = '0:00';
  M.ayahModalAudioDuration.textContent = '0:00';
  if (slider) { slider.value = '0'; slider.max = '100'; }
  audioLoadSurah = null;
  ayahAudios = [];
}

function onAudioTime() {
  const p = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  const slider = /** @type {HTMLInputElement} */ (M.ayahModalAudioSlider);
  if (!p || !p.duration) return;
  M.ayahModalAudioCurrent.textContent = formatTime(p.currentTime);
  if (slider) slider.value = String(Math.floor(p.currentTime));
}

function onAudioEnded() {
  const player = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  const chk = /** @type {HTMLInputElement} */ (M.ayahModalRepeatChk);
  M.ayahModalPlayBtn.textContent = '▶️ تشغيل';
  if (chk?.checked && player) {
    player.currentTime = 0;
    player.play().catch(() => {});
  }
}

function formatTime(secs) {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function downloadModalAyah() {
  if (!current) return;
  const player = /** @type {HTMLAudioElement} */ (M.ayahModalAudioPlayer);
  if (!player || !player.src) { showToast('شغّل الآية أولاً', 'error'); return; }
  const a = document.createElement('a');
  a.href = player.src;
  a.download = `ayah-${current.surah}-${current.ayah}.mp3`;
  a.click();
}

/* ===================== TAFSIR TABS ===================== */

async function loadTafsirTab(edition) {
  if (!current || !edition) return;
  activateTab(edition);
  M.ayahModalTafsirBody.innerHTML = '<p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>';
  try {
    const text = await fetchTafsirText(edition, current.surah, current.ayah);
    if (text) {
      M.ayahModalTafsirBody.innerHTML = `<p class="tafsir-text">${escapeHtml(text)}</p>`;
    } else {
      M.ayahModalTafsirBody.innerHTML = '<p class="tafsir-error">⚠️ لا يوجد تفسير متاح</p>';
    }
  } catch {
    M.ayahModalTafsirBody.innerHTML = '<p class="tafsir-error">⚠️ تعذر تحميل التفسير</p>';
  }
}

function activateTab(edition) {
  M.ayahModalTafsirTabs?.querySelectorAll('.ayah-modal-tafsir-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.edition === edition);
  });
}
