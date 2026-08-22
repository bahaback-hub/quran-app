import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDom = {
  presShareBtn: document.createElement('button'),
  presentationOverlay: document.createElement('div'),
};

vi.mock('../dom.js', () => ({ dom: mockDom }));
vi.mock('../i18n.js', () => ({ __: (key: string) => key }));
vi.mock('../ui.js', () => ({ showToast: vi.fn() }));
vi.mock('../pres-backgrounds.js', () => ({
  getAutoBackground: () => ({ src: 'backgrounds/dawn.jpg' }),
  getNatureBgByMood: () => ({ src: 'backgrounds/dawn.jpg' }),
}));
vi.mock('../state.js', () => ({
  state: {
    currentSurah: 1,
    currentAyahIndex: 0,
    presBgMode: 'plain',
    presBgNature: 'dawn',
    surahList: [{ number: 1, englishName: 'Al-Faatiha' }],
    surahData: { name: 'سُورَةُ ٱلْفَاتِحَةِ', ayahs: [{ text: 'بِسْمِ ٱللَّهِ', numberInSurah: 1 }] },
  },
}));

function mountPreview(): void {
  document.body.innerHTML = `
    <div id="presentationSharePreview" class="presentation-share-preview hidden">
      <h3 id="presentationShareHeading"></h3>
      <button id="presentationShareCloseBtn"></button>
      <img id="presentationShareImage" />
      <p id="presentationShareStatus"></p>
      <button id="presentationShareNativeBtn"></button>
      <button id="presentationShareDownloadBtn"></button>
    </div>`;
  mockDom.presShareBtn = document.createElement('button');
  mockDom.presentationOverlay = document.createElement('div');
}

describe('presentation image sharing', () => {
  beforeEach(() => {
    vi.resetModules();
    mountPreview();
  });

  it('localises and labels the share trigger on initialisation', async () => {
    const { initPresentationShare } = await import('../presentation-share.js');
    initPresentationShare();
    expect(mockDom.presShareBtn.getAttribute('aria-label')).toBe('presentation_share_image');
    expect(document.getElementById('presentationShareHeading')?.textContent).toBe('presentation_share_preview');
  });

  it('closes the preview and clears its visible state', async () => {
    const { closePresentationSharePreview } = await import('../presentation-share.js');
    const preview = document.getElementById('presentationSharePreview')!;
    preview.classList.remove('hidden');
    preview.style.display = 'flex';
    closePresentationSharePreview();
    expect(preview.classList.contains('hidden')).toBe(true);
    expect(preview.style.display).toBe('none');
  });
});
