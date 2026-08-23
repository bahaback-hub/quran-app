import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  currentSurah: 1,
  currentAyahIndex: 0,
  presBgMode: 'plain',
  presBgNature: 'dawn',
  surahList: [{ number: 1, englishName: 'Al-Faatiha' }],
  surahData: { name: 'سُورَةُ ٱلْفَاتِحَةِ', ayahs: [{ text: 'بِسْمِ ٱللَّهِ', numberInSurah: 1 }] },
};

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
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: vi.fn() } }));
vi.mock('@capacitor/share', () => ({ Share: { canShare: vi.fn(), share: vi.fn() } }));
vi.mock('../state.js', () => ({ state: mockState }));

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
  let fillText: ReturnType<typeof vi.fn>;
  let renderedCanvasSize: [number, number] | null;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockState.presBgMode = 'plain';
    renderedCanvasSize = null;
    mountPreview();
    const NativeURL = globalThis.URL;
    class TestURL extends NativeURL {}
    Object.defineProperty(TestURL, 'createObjectURL', { value: vi.fn(() => 'blob:share-preview') });
    Object.defineProperty(TestURL, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', TestURL);
    const gradient = { addColorStop: vi.fn() };
    fillText = vi.fn();
    const context = {
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText,
      drawImage: vi.fn(),
      measureText: vi.fn(() => ({ width: 80 })),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => context),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: function (this: HTMLCanvasElement, callback: BlobCallback) {
        renderedCanvasSize = [this.width, this.height];
        callback(new Blob(['image'], { type: 'image/png' }));
      },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(() => Promise.resolve()) });
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

  it('renders a preview image and enables its sharing and download actions', async () => {
    const { openPresentationSharePreview } = await import('../presentation-share.js');

    await openPresentationSharePreview();

    expect(document.getElementById('presentationSharePreview')?.style.display).toBe('flex');
    expect((document.getElementById('presentationShareImage') as HTMLImageElement).src).toContain('blob:share-preview');
    expect((document.getElementById('presentationShareNativeBtn') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('presentationShareDownloadBtn') as HTMLButtonElement).disabled).toBe(false);
    expect(document.getElementById('presentationShareStatus')?.dataset['state']).toBe('ready');
  });

  it('uses the browser share sheet from both share actions after preparing the image', async () => {
    const { initPresentationShare, openPresentationSharePreview } = await import('../presentation-share.js');
    const share = vi.mocked(navigator.share);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await openPresentationSharePreview();
    initPresentationShare();

    mockDom.presShareBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.getElementById('presentationShareNativeBtn')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.getElementById('presentationShareDownloadBtn')?.click();

    expect(share).toHaveBeenCalledTimes(2);
    expect(anchorClick).toHaveBeenCalled();
  });

  it('adds the discreet Sulaimani signature to wide video-background shares', async () => {
    mockState.presBgMode = 'video';
    const { openPresentationSharePreview } = await import('../presentation-share.js');

    await openPresentationSharePreview();

    expect(fillText).toHaveBeenCalledWith('المصحف السليماني', expect.any(Number), expect.any(Number));
    expect(renderedCanvasSize).toEqual([1920, 1080]);
  });
});
