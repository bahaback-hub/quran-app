import { state } from "./state.js";
import { CONFIG, JUZ_PAGES } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast, loadingBar } from "./ui.js";
import { escapeHtml, toArabicNumeral } from "./utils.js";
import { SURAH_SECRETS, SURAH_SECRETS_AUTH_KEYS } from "./surahs-data.js";
import { loadSurah, updatePlayerInfo, renderSurah, highlightCurrentAyah } from "./app.js";
import { prepareAudioForNewSurah, playCurrentAyah, updatePlayPauseBtn } from "./audio.js";
import { handlePageClick, getAyahHighlightRects } from "./ayah-click.js";
import { renderPage, loadPageData } from "./mushaf-renderer.js";

/** Toggle between mushaf mode and surah mode. */
export async function toggleMushafMode() {
  const wasPlaying = state.isPlaying;
  state.mushafMode = !state.mushafMode;
  document.querySelectorAll('.view-mode-btn').forEach(b => {
    if (state.mushafMode) {
      b.classList.toggle('active', b.dataset.mode === 'mushaf');
    } else {
      b.classList.toggle('active', b.dataset.mode === 'surah');
    }
  });
  if (state.mushafMode) {
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

/** Update the page indicator text to show current page. */
export function updatePageIndicator(pageNum) {
  if (dom.pageIndicator) {
    const arabic = pageNum.toLocaleString('ar-SA');
    dom.pageIndicator.textContent = `صفحة ${arabic} من ٦٠٤`;
  }
}

let _mushafLoadCounter = 0;

/** Load and render a mushaf page image. */
export async function loadPage(pageNum, skipNav, force) {
  if (!pageNum) return;
  _mushafLoadCounter++;
  const currentLoad = _mushafLoadCounter;
  const hasContainer = !!dom.surahContent?.querySelector('.mushaf-container');
  if (!force && hasContainer && pageNum === state.currentPage) return;
  const prevPage = state.currentPage;
  const direction = pageNum > prevPage ? 'left' : 'right';
  state.currentPage = pageNum;
  storage.set('current_page', pageNum);
  updatePageIndicator(pageNum);
  loadingBar.show(`⏳ جاري تحميل الصفحة ${pageNum}...`);

  const oldContainer = dom.surahContent?.querySelector('.mushaf-container');
  if (oldContainer) {
    oldContainer.classList.add('mushaf-flipping');
    const flipOut = direction === 'left' ? 'mushaf-flip-out-left' : 'mushaf-flip-out-right';
    oldContainer.classList.add(flipOut);
    await new Promise(r => setTimeout(r, 300));
  }

  renderMushafPageImage(pageNum, skipNav);

  requestAnimationFrame(() => {
    const newContainer = dom.surahContent?.querySelector('.mushaf-container');
    if (newContainer) {
      newContainer.classList.add('mushaf-flipping');
      const flipIn = direction === 'left' ? 'mushaf-flip-in-right' : 'mushaf-flip-in-left';
      newContainer.classList.add(flipIn);
      newContainer.addEventListener('animationend', () => {
        newContainer.classList.remove('mushaf-flipping', flipIn);
      }, { once: true });
    }
  });
}

/** Get the Juz number for a given page number (1-604). */
export function getJuzForPage(pageNum) {
  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) { juz = i + 1; break; }
  }
  return juz;
}

function renderMushafPageImage(pageNum, skipNav) {
  if (!dom.surahContent) return;
  const juz = getJuzForPage(pageNum);

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

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'mushaf-image-wrapper';

  const canvas = document.createElement('canvas');
  canvas.className = 'mushaf-page-canvas';
  canvas.width = 1080;
  canvas.height = 1540;

  canvasWrapper.appendChild(canvas);

  let pageLayout = null;

  const clickHandler = async (e) => {
    const target = /** @type {Element} */ (e.target);
    if (target.closest('.mushaf-page-nav')) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = await handlePageClick(pageNum, x, y, rect.width, rect.height, pageLayout);
    if (result) {
      const bar = document.getElementById('mushafAyahBar');
      if (bar) {
        bar.querySelectorAll('.mushaf-ayah-btn').forEach(b => {
          b.classList.toggle('current', parseInt(b.dataset.surah, 10) === result.surah && parseInt(b.dataset.ayah, 10) === result.ayah);
        });
      }
      playMushafAyah(result.surah, result.ayah);
      import('./tafsir.js').then(m => m.loadTafsirForSurahAyah(result.surah, result.ayah));
      highlightMushafAyah();
    }
  };
  canvasWrapper.addEventListener('click', clickHandler);

  const footer = document.createElement('div');
  footer.className = 'mushaf-footer';
  footer.innerHTML = `${toArabicNumeral(pageNum)}`;

  const navPrev = document.createElement('button');
  navPrev.className = 'mushaf-page-nav-btn mushaf-page-nav-prev';
  navPrev.textContent = '▶';
  navPrev.setAttribute('aria-label', 'الصفحة السابقة');
  navPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage > 1) loadPage(state.currentPage - 1, true);
  });

  const navNext = document.createElement('button');
  navNext.className = 'mushaf-page-nav-btn mushaf-page-nav-next';
  navNext.textContent = '◀';
  navNext.setAttribute('aria-label', 'الصفحة التالية');
  navNext.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage < 604) loadPage(state.currentPage + 1, true);
  });

  container.appendChild(header);
  container.appendChild(canvasWrapper);
  container.appendChild(footer);
  container.appendChild(navPrev);
  container.appendChild(navNext);

  const ayahBar = document.createElement('div');
  ayahBar.className = 'mushaf-ayah-bar';
  ayahBar.id = 'mushafAyahBar';
  ayahBar.innerHTML = '<div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-loading">جاري تحميل الآيات...</div>';

  dom.surahContent.innerHTML = '';
  dom.surahContent.appendChild(container);
  dom.surahContent.appendChild(ayahBar);

  renderPage(pageNum, canvas).then(({ canvas: renderedCanvas, layout: layoutData }) => {
    pageLayout = layoutData;
    state.currentPageLayout = layoutData;
    if (renderedCanvas && layoutData) {
      loadingBar.hide();
      if (state.mushafMode) highlightMushafAyah(skipNav);
    } else {
      showToast('تعذّر عرض الصفحة', 'error');
      loadingBar.hide();
    }
  });

  preloadAdjacentLayouts(pageNum);

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
          import('./tafsir.js').then(m => m.loadTafsirForSurahAyah(parseInt(this.dataset.surah, 10), parseInt(this.dataset.ayah, 10)));
        });
      });
    })
    .catch(() => { });
}

function preloadAdjacentLayouts(pageNum) {
  const toPreload = [];
  if (pageNum > 1) toPreload.push(pageNum - 1);
  if (pageNum < 604) toPreload.push(pageNum + 1);

  for (const p of toPreload) {
    loadPageData(p).catch(() => {});
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
    btn.dataset.surahName = s.name;
    row.appendChild(btn);
    if (SURAH_SECRETS[s.number]) {
      const secretBtn = document.createElement('button');
      secretBtn.className = 'surah-secret-btn';
      secretBtn.textContent = 'ℹ️';
      secretBtn.title = 'معلومات عن السورة';
      secretBtn.setAttribute('aria-label', `معلومات عن سورة ${s.name}`);
      secretBtn.dataset.surah = String(s.number);
      secretBtn.dataset.surahName = s.name;
      row.appendChild(secretBtn);
    }
    dom.mushafSurahOverlayList.appendChild(row);
  }

  if (!dom.mushafSurahOverlayList._delegationBound) {
    dom.mushafSurahOverlayList._delegationBound = true;
    dom.mushafSurahOverlayList.addEventListener('click', async (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.classList.contains('mushaf-surah-overlay-btn')) {
        const surahNum = parseInt(target.dataset.surah, 10);
        const surahName = target.dataset.surahName || '';
        dom.mushafSurahOverlay.style.display = 'none';
        state.currentSurah = surahNum;
        state.currentAyahIndex = 0;
        state.surahData = null;
        loadingBar.show(`⏳ البحث عن أول صفحة لسورة ${surahName}...`);
        try {
          const res = await fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`);
          const data = await res.json();
          const page = data?.data?.page || 1;
          if (dom.pageSelect) dom.pageSelect.value = page;
          if (dom.pageSlider) dom.pageSlider.value = page;
          loadPage(page, true);
        } catch {
          showToast('تعذّر العثور على الصفحة', 'error');
        } finally {
          loadingBar.hide();
        }
        return;
      }
      if (target.classList.contains('surah-secret-btn')) {
        e.stopPropagation();
        showSurahSecret(parseInt(target.dataset.surah, 10), target.dataset.surahName);
      }
    });
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
export async function highlightMushafAyah(skipNav) {
  if (!state.mushafMode) return;
  const wrapper = dom.surahContent?.querySelector('.mushaf-image-wrapper');
  const canvasEl = wrapper?.querySelector('.mushaf-page-canvas');
  if (!wrapper || !canvasEl || !canvasEl.width) return;

  const surah = state.surahData?.number;
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah;
  if (!surah || !ayah) return;

  if (!skipNav) {
    const layout = state.currentPageLayout;
    if (layout) {
      const isOnPage = layout.lines.some(line =>
        line.words?.some(w => {
          const key = w.verse_key || w.location || '';
          const parts = key.split(':');
          return parts.length >= 2 && parseInt(parts[0], 10) === surah && parseInt(parts[1], 10) === ayah;
        })
      );
      if (!isOnPage) {
        try {
          const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
          const data = await res.json();
          const page = data?.data?.page;
          if (page && page !== state.currentPage) {
            loadPage(page);
            return;
          }
        } catch (e) {
          console.warn('Failed to find page for ayah:', e);
        }
      }
    }
  }

  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const rects = await getAyahHighlightRects(state.currentPage, surah, ayah, rect.width, rect.height, state.currentPageLayout);
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
