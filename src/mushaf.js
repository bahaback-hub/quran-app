import { state } from "./state.js";
import { CONFIG, JUZ_PAGES } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast, loadingBar } from "./ui.js";
import { escapeHtml, toArabicNumeral } from "./utils.js";
import { SURAH_SECRETS, SURAH_SECRETS_AUTH_KEYS } from "./surahs-data.js";
import { loadSurah, updatePlayerInfo, renderSurah, highlightCurrentAyah } from "./app.js";
import { prepareAudioForNewSurah, playCurrentAyah, updatePlayPauseBtn } from "./audio.js";
import { loadTafsirForSurahAyah } from "./tafsir.js";
import { handlePageClick, getAyahHighlightRects, getPageLayout } from "./ayah-click.js";

/** Toggle between mushaf mode and surah mode. */
export async function toggleMushafMode() {
  const wasPlaying = state.isPlaying;
  state.mushafMode = !state.mushafMode;
  if (state.mushafMode) {
    dom.modeToggleBtn.innerHTML = '📖 وضع السورة';
    dom.modeToggleBtn.classList.add('mushaf-active');
    if (dom.pageIndicator) dom.pageIndicator.style.display = 'inline';
    populatePageSelect();
    
    if (state.currentSurah) {
      const currentAyah = (state.surahData?.number === state.currentSurah && state.surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah) || 1;
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${state.currentSurah}:${currentAyah}/quran-uthmani`);
        const data = await res.json();
        const page = data?.data?.page;
        if (page && page >= 1 && page <= 604) {
          state.currentPage = page;
        }
      } catch (e) {
        console.warn('Failed to get page for ayah:', e);
      }
    }
    
    updatePageIndicator(state.currentPage);
    populateSurahOverlay();
    loadPage(state.currentPage);
    if (wasPlaying && dom.audioPlayer?.paused) {
      dom.audioPlayer.play().catch(() => {});
      state.isPlaying = true;
      updatePlayPauseBtn();
    }
  } else {
    dom.modeToggleBtn.innerHTML = '<img src="mushaf-icon.png" alt="" class="mode-toggle-icon"> وضع المصحف';
    dom.modeToggleBtn.classList.remove('mushaf-active');
    if (dom.pageIndicator) dom.pageIndicator.style.display = 'none';

    if (state.surahData && state.surahData.number === state.currentSurah) {
      renderSurah(state.surahData);
      highlightCurrentAyah();
      updatePlayerInfo();
    } else {
      let surahToLoad = state.currentSurah && state.currentSurah > 0 ? state.currentSurah : 1;
      dom.surahContent.innerHTML = '<p class="loading">⏳ جاري تحميل السورة...</p>';
      setTimeout(() => loadSurah(surahToLoad), 50);
    }
  }
  storage.set('mushaf_mode', state.mushafMode);
}

function populatePageSelect() {
  if (!dom.pageSelect) return;
  dom.pageSelect.innerHTML = '';
  for (let i = 1; i <= 604; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `صفحة ${i}`;
    dom.pageSelect.appendChild(opt);
  }
  dom.pageSelect.value = String(state.currentPage);
  if (dom.pageSlider) dom.pageSlider.value = state.currentPage;
}

function updatePageIndicator(pageNum) {
  if (dom.pageIndicator) {
    const arabic = pageNum.toLocaleString('ar-SA');
    dom.pageIndicator.textContent = `صفحة ${arabic} من ٦٠٤`;
  }
}

/** Load and render a mushaf page image with flip animation. */
export async function loadPage(pageNum) {
  if (!pageNum) return;
  const hasContainer = !!dom.surahContent?.querySelector('.mushaf-container');
  if (hasContainer && pageNum === state.currentPage) return;
  const prevPage = state.currentPage;
  const direction = pageNum > prevPage ? 'left' : 'right';
  state.currentPage = pageNum;
  storage.set('current_page', pageNum);
  updatePageIndicator(pageNum);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    loadingBar.show(`⏳ جاري تحميل الصفحة ${pageNum}...`);
    renderMushafPageImage(pageNum);
    return;
  }

  const oldContainer = dom.surahContent?.querySelector('.mushaf-container');
  if (oldContainer) {
    const flipOut = direction === 'left' ? 'mushaf-flip-out-left' : 'mushaf-flip-out-right';
    oldContainer.style.perspective = '1500px';
    oldContainer.classList.add('mushaf-flipping', flipOut);
    await new Promise(r => setTimeout(r, 300));
  }

  loadingBar.show(`⏳ جاري تحميل الصفحة ${pageNum}...`);
  renderMushafPageImage(pageNum);

  requestAnimationFrame(() => {
    const newContainer = dom.surahContent?.querySelector('.mushaf-container');
    if (newContainer) {
      const flipIn = direction === 'left' ? 'mushaf-flip-in-right' : 'mushaf-flip-in-left';
      newContainer.style.perspective = '1500px';
      newContainer.classList.add('mushaf-flipping', flipIn);
      newContainer.addEventListener('animationend', () => {
        newContainer.classList.remove('mushaf-flipping', flipIn);
      }, { once: true });
    }
  });
}

function getJuzForPage(pageNum) {
  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) { juz = i + 1; break; }
  }
  return juz;
}

function renderMushafPageImage(pageNum) {
  if (!dom.surahContent) return;
  const juz = getJuzForPage(pageNum);
  const padded = String(pageNum).padStart(3, '0');
  const imgUrl = `https://cdn.jsdelivr.net/gh/bahaback-hub/quran-app@main/public/pages/page${padded}.png`;

  const container = document.createElement('div');
  container.className = 'mushaf-container';

  const header = document.createElement('div');
  header.className = 'mushaf-header';
  header.innerHTML = `
    <div class="mushaf-header-row">
      <div class="mushaf-surah-names" id="mushafSurahNames"></div>
      <div class="mushaf-juz">الجزء ${toArabicNumeral(juz)}</div>
    </div>
  `;

  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'mushaf-image-wrapper';

  const skeleton = document.createElement('div');
  skeleton.className = 'mushaf-image-skeleton';

  const img = new Image();
  img.className = 'mushaf-page-img';
  img.alt = `صفحة ${pageNum} من المصحف`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.fetchPriority = 'low';

  img.onerror = () => {
    img.classList.add('loaded');
    skeleton.remove();
    loadingBar.hide();
  };
  img.onload = () => {
    img.classList.add('loaded');
    skeleton.remove();
    loadingBar.hide();
    if (state.mushafMode) highlightMushafAyah();
  };
  img.src = imgUrl;

  const navRight = document.createElement('div');
  navRight.className = 'mushaf-page-nav mushaf-page-nav-right';
  navRight.setAttribute('aria-label', 'الصفحة السابقة');
  navRight.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage > 1) loadPage(state.currentPage - 1);
  });

  const navLeft = document.createElement('div');
  navLeft.className = 'mushaf-page-nav mushaf-page-nav-left';
  navLeft.setAttribute('aria-label', 'الصفحة التالية');
  navLeft.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage < 604) loadPage(state.currentPage + 1);
  });

  imgWrapper.appendChild(skeleton);
  imgWrapper.appendChild(img);
  imgWrapper.appendChild(navRight);
  imgWrapper.appendChild(navLeft);

  imgWrapper.addEventListener('click', async function (e) {
    const target = /** @type {Element} */ (e.target);
    if (target.closest('.mushaf-page-nav')) return;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = await handlePageClick(pageNum, x, y, rect.width, rect.height);
    if (result) {
      const bar = document.getElementById('mushafAyahBar');
      if (bar) {
        bar.querySelectorAll('.mushaf-ayah-btn').forEach(b => {
          b.classList.toggle('current', parseInt(b.dataset.surah, 10) === result.surah && parseInt(b.dataset.ayah, 10) === result.ayah);
        });
      }
      playMushafAyah(result.surah, result.ayah);
      loadTafsirForSurahAyah(result.surah, result.ayah);
      highlightMushafAyah();
    }
  });

  const footer = document.createElement('div');
  footer.className = 'mushaf-footer';
  footer.innerHTML = `${toArabicNumeral(pageNum)}`;

  container.appendChild(header);
  container.appendChild(imgWrapper);
  container.appendChild(footer);

  const ayahBar = document.createElement('div');
  ayahBar.className = 'mushaf-ayah-bar';
  ayahBar.id = 'mushafAyahBar';
  ayahBar.innerHTML = '<div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-loading">جاري تحميل الآيات...</div>';

  dom.surahContent.innerHTML = '';
  dom.surahContent.appendChild(container);
  dom.surahContent.appendChild(ayahBar);

  preloadAdjacentPages(pageNum);

  fetch(`${CONFIG.API_BASE}/page/${pageNum}/quran-uthmani`)
    .then(res => res.json())
    .then(json => {
      const ayahs = json?.data?.ayahs;
      if (!ayahs?.length) return;

      const surahNamesEl = document.getElementById('mushafSurahNames');
      if (surahNamesEl) {
        const seen = {};
        ayahs.forEach(a => { if (!seen[a.surah.number]) seen[a.surah.number] = a.surah.name; });
        surahNamesEl.innerHTML = Object.values(seen).map(n => `<span class="mushaf-surah-name">${escapeHtml(n)}</span>`).join(' ');
      }

      const bar = document.getElementById('mushafAyahBar');
      if (!bar) return;
      let itemsHtml = '<div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-grid">';
      for (const ayah of ayahs) {
        const sn = ayah.surah.number;
        const an = ayah.numberInSurah;
        const surahInfo = state.surahList.find(s => s.number === sn);
        const surahName = surahInfo ? surahInfo.name : `سورة ${sn}`;
        itemsHtml += `<button class="mushaf-ayah-btn" data-surah="${sn}" data-ayah="${an}">
          <span class="mushaf-ayah-btn-surah">${escapeHtml(surahName)}</span>
          <span class="mushaf-ayah-btn-num">${toArabicNumeral(an)}</span>
        </button>`;
      }
      itemsHtml += '</div>';
      bar.innerHTML = itemsHtml;

      bar.querySelectorAll('.mushaf-ayah-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          bar.querySelectorAll('.mushaf-ayah-btn').forEach(b => b.classList.remove('current'));
          this.classList.add('current');
          playMushafAyah(parseInt(this.dataset.surah, 10), parseInt(this.dataset.ayah, 10));
          loadTafsirForSurahAyah(parseInt(this.dataset.surah, 10), parseInt(this.dataset.ayah, 10));
        });
      });
    })
    .catch(() => { });
}

function preloadAdjacentPages(pageNum) {
  const conn = navigator.connection;
  if (conn && (conn.saveData || conn.effectiveType?.startsWith('2g'))) return;

  const toPreload = [];
  if (pageNum > 1) toPreload.push(pageNum - 1);
  if (pageNum < 604) toPreload.push(pageNum + 1);

  for (const p of toPreload) {
    const padded = String(p).padStart(3, '0');
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `https://cdn.jsdelivr.net/gh/bahaback-hub/quran-app@main/public/pages/page${padded}.png`;
    link.as = 'image';
    document.head.appendChild(link);
  }
}

export function populateSurahOverlay() {
  if (!dom.mushafSurahOverlayList || !state.surahList.length) return;
  dom.mushafSurahOverlayList.innerHTML = '';
  for (const s of state.surahList) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const btn = document.createElement('button');
    btn.className = 'mushaf-surah-overlay-btn';
    btn.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    btn.style.flex = '1';
    btn.dataset.surah = String(s.number);
    btn.addEventListener('click', async () => {
      dom.mushafSurahOverlay.style.display = 'none';
      loadingBar.show(`⏳ البحث عن أول صفحة لسورة ${s.name}...`);
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${s.number}:1`);
        const data = await res.json();
        const page = data?.data?.page || 1;
        if (dom.pageSelect) dom.pageSelect.value = page;
        if (dom.pageSlider) dom.pageSlider.value = page;
        state.currentPage = page;
        loadPage(page);
      } catch {
        showToast('تعذّر العثور على الصفحة', 'error');
      } finally {
        loadingBar.hide();
      }
    });
    row.appendChild(btn);
    if (SURAH_SECRETS[s.number]) {
      const secretBtn = document.createElement('button');
      secretBtn.className = 'surah-secret-btn';
      secretBtn.textContent = 'ℹ️';
      secretBtn.title = 'معلومات عن السورة';
      secretBtn.setAttribute('aria-label', `معلومات عن سورة ${s.name}`);
      secretBtn.dataset.surah = String(s.number);
      secretBtn.dataset.surahName = s.name;
      secretBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSurahSecret(parseInt(secretBtn.dataset.surah, 10), secretBtn.dataset.surahName);
      });
      row.appendChild(secretBtn);
    }
    dom.mushafSurahOverlayList.appendChild(row);
  }
}

export function showSurahSecret(surahNum, surahName) {
  if (!dom.surahSecretsOverlay || !dom.surahSecretsBody || !dom.surahSecretsTitle || !dom.surahSecretsSurahName) return;
  const secret = SURAH_SECRETS[surahNum];
  if (!secret) {
    showToast('لا يوجد سر مسجل لهذه السورة', 'error');
    return;
  }
  dom.surahSecretsSurahName.textContent = `ℹ️ ${surahNum}. ${surahName}`;
  dom.surahSecretsTitle.textContent = `ℹ️ معلومات عن السورة`;
  let html = `<p>${secret}</p>`;
  const authKeys = SURAH_SECRETS_AUTH_KEYS[surahNum];
  if (authKeys && authKeys.length) {
    html += `<div class="secret-source">📚 المصادر: ${authKeys.map(k => `<span>${k}</span>`).join(' ')}</div>`;
  }
  dom.surahSecretsBody.innerHTML = html;
  dom.surahSecretsOverlay.style.display = 'flex';
}

/** Update the mushaf page highlight overlay to mark the current ayah. */
export async function highlightMushafAyah() {
  if (!state.mushafMode) return;
  const wrapper = dom.surahContent?.querySelector('.mushaf-image-wrapper');
  const img = wrapper?.querySelector('.mushaf-page-img');
  if (!wrapper || !img || !img.complete || !img.naturalWidth) return;

  const surah = state.surahData?.number;
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah;
  if (!surah || !ayah) return;

  // Check if current ayah is on the displayed page
  const layout = await getPageLayout(state.currentPage);
  if (layout) {
    const isOnPage = layout.lines.some(line =>
      (line.type === 'text' || line.type === 'basmalah') &&
      line.words?.some(w => {
        const parts = w.location.split(':');
        return parts.length >= 2 && parseInt(parts[0], 10) === surah && parseInt(parts[1], 10) === ayah;
      })
    );
    if (!isOnPage) {
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
        const data = await res.json();
        const page = data?.data?.page;
        if (page && page !== state.currentPage) {
          state.currentPage = page;
          loadPage(page);
          return;
        }
      } catch (e) {
        console.warn('Failed to find page for ayah:', e);
      }
    }
  }

  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const rects = await getAyahHighlightRects(state.currentPage, surah, ayah, rect.width, rect.height);
  if (!rects.length) return;

  const wrapperRect = wrapper.getBoundingClientRect();
  const imgLeft = rect.left - wrapperRect.left;
  const imgTop = rect.top - wrapperRect.top;

  let overlay = wrapper.querySelector('.mushaf-highlight-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mushaf-highlight-overlay';
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:5;';
    wrapper.appendChild(overlay);
  }
  overlay.style.left = `${imgLeft}px`;
  overlay.style.top = `${imgTop}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  overlay.innerHTML = '';
  for (const r of rects) {
    const bar = document.createElement('div');
    bar.className = 'mushaf-ayah-highlight';
    bar.style.cssText = `position:absolute;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;`;
    overlay.appendChild(bar);
  }
}

function playMushafAyah(surahNum, ayahNum) {
  if (state.isPlaying) prepareAudioForNewSurah();
  const loadAndPlay = () => {
    const idx = state.surahData.ayahs.findIndex(a => a.numberInSurah === ayahNum);
    if (idx !== -1) {
      state.currentAyahIndex = idx;
      updatePlayerInfo();
      playCurrentAyah();
    }
  };
  if (state.currentSurah !== surahNum || !state.surahData) {
    const tempSurahList = state.surahList;
    fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentReciter}`)
      .then(res => res.json())
      .then(json => {
        if (json?.data?.ayahs) {
          state.ayahsAudios = json.data.ayahs.map(a => a.audio);
          if (tempSurahList.length) {
            const s = tempSurahList.find(s => s.number === surahNum);
            if (s) state.surahData = { name: s.name, englishName: s.englishName, number: surahNum, ayahs: json.data.ayahs };
          }
          loadAndPlay();
        }
      })
      .catch(() => showToast('تعذّر تحميل الصوت', 'error'));
  } else {
    loadAndPlay();
  }
}
