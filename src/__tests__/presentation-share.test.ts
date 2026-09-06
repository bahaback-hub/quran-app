import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  currentSurah: 1,
  currentAyahIndex: 0,
  currentReciter: 'ar.alafasy',
  presBgMode: 'plain',
  presBgNature: 'dawn',
  presBgScene: 'stars',
  surahList: [{ number: 1, englishName: 'Al-Faatiha' }],
  surahData: { name: 'سُورَةُ ٱلْفَاتِحَةِ', ayahs: [{ text: 'بِسْمِ ٱللَّهِ', numberInSurah: 1 }] },
};

const mockDom = {
  presShareBtn: document.createElement('button'),
  presVideoShareBtn: document.createElement('button'),
  presentationOverlay: document.createElement('div'),
};

vi.mock('../dom.js', () => ({ dom: mockDom }));
vi.mock('../i18n.js', () => ({ __: (key: string) => key }));
vi.mock('../ui.js', () => ({ showToast: vi.fn() }));
vi.mock('../pres-backgrounds.js', () => ({
  getAutoBackground: () => ({ src: 'backgrounds/dawn.jpg' }),
  getNatureBgByMood: () => ({ src: 'backgrounds/dawn.jpg' }),
}));
const capacitorMock = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false) }));
const filesystemMock = vi.hoisted(() => ({
  writeFile: vi.fn(() => Promise.resolve({ uri: 'file:///cache/shared/x.png' })),
}));
const capacitorShareMock = vi.hoisted(() => ({
  canShare: vi.fn(() => Promise.resolve({ value: true })),
  share: vi.fn(() => Promise.resolve()),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: capacitorMock.isNativePlatform } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: filesystemMock.writeFile },
}));
vi.mock('@capacitor/share', () => ({ Share: { canShare: capacitorShareMock.canShare, share: capacitorShareMock.share } }));
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
      <button id="presentationShareVideoBtn"></button>
      <button id="presentationShareVideoDownloadBtn"></button>
    </div>`;
  mockDom.presShareBtn = document.createElement('button');
  mockDom.presVideoShareBtn = document.createElement('button');
  mockDom.presentationOverlay = document.createElement('div');
}

describe('presentation image sharing', () => {
  it('switches the primary share action to video after video generation completes', async () => {
    const { getPresentationShareActionKind } = await import('../presentation-share.js');
    expect(getPresentationShareActionKind(false)).toBe('image');
    expect(getPresentationShareActionKind(true)).toBe('video');
  });

  let fillText: ReturnType<typeof vi.fn>;
  let strokeRect: ReturnType<typeof vi.fn>;
  let renderedCanvasSize: [number, number] | null;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    capacitorMock.isNativePlatform.mockImplementation(() => false);
    capacitorShareMock.canShare.mockImplementation(() => Promise.resolve({ value: true }));
    capacitorShareMock.share.mockImplementation(() => Promise.resolve());
    filesystemMock.writeFile.mockImplementation(() => Promise.resolve({ uri: 'file:///cache/shared/x.png' }));
    mockState.presBgMode = 'plain';
    mockState.currentReciter = 'ar.alafasy';
    renderedCanvasSize = null;
    mountPreview();
    const NativeURL = globalThis.URL;
    class TestURL extends NativeURL {}
    Object.defineProperty(TestURL, 'createObjectURL', { value: vi.fn(() => 'blob:share-preview') });
    Object.defineProperty(TestURL, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', TestURL);
    const gradient = { addColorStop: vi.fn() };
    fillText = vi.fn();
    strokeRect = vi.fn();
    const context = {
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      strokeRect,
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

  it('shows local video creation only for Mishary Alafasy when the browser supports recording', async () => {
    class MediaRecorderMock {}
    Object.defineProperty(MediaRecorderMock, 'isTypeSupported', { value: vi.fn(() => true) });
    vi.stubGlobal('MediaRecorder', MediaRecorderMock);
    vi.stubGlobal('AudioContext', class AudioContextMock {});
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      value: vi.fn(),
    });
    const { initPresentationShare } = await import('../presentation-share.js');
    initPresentationShare();
    const videoButton = document.getElementById('presentationShareVideoBtn')!;

    expect(videoButton.classList.contains('hidden')).toBe(false);
    expect(videoButton.textContent).toContain('presentation_share_video');
    expect(mockDom.presVideoShareBtn.classList.contains('hidden')).toBe(false);

    mockState.currentReciter = 'ar.husary';
    window.dispatchEvent(new Event('app:langchange'));
    expect(videoButton.classList.contains('hidden')).toBe(true);
    expect(mockDom.presVideoShareBtn.classList.contains('hidden')).toBe(true);
  });

  it('closes the preview, revokes its object URL and clears its visible state', async () => {
    const { openPresentationSharePreview, closePresentationSharePreview } = await import('../presentation-share.js');
    const preview = document.getElementById('presentationSharePreview')!;
    await openPresentationSharePreview();
    preview.classList.remove('hidden');
    preview.style.display = 'flex';
    closePresentationSharePreview();
    expect(preview.classList.contains('hidden')).toBe(true);
    expect(preview.style.display).toBe('none');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:share-preview');
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

  it('renders wide video-background shares without a frame and with the discreet Sulaimani signature', async () => {
    mockState.presBgMode = 'video';
    const { openPresentationSharePreview } = await import('../presentation-share.js');

    await openPresentationSharePreview();

    expect(fillText).toHaveBeenCalledWith('المصحف السليماني', expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith('بِسْمِ ٱللَّهِ', 595, expect.any(Number), 800);
    expect(fillText).toHaveBeenCalledWith('سُورَةُ ٱلْفَاتِحَةِ — ayah 1', 595, expect.any(Number), 800);
    expect(renderedCanvasSize).toEqual([1920, 1080]);
    expect(strokeRect).not.toHaveBeenCalled();
  });

  it('prepares the share image in advance without opening any UI', async () => {
    const { preparePresentationShareImage } = await import('../presentation-share.js');
    preparePresentationShareImage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('presentationSharePreview')?.classList.contains('hidden')).toBe(true);
  });

it('marks the video creating status as failed when the timing service is unavailable', async () => {
    // Recording is advertised as supported so the video button stays enabled;
    // the Alafasy timing request then fails (503) and the status must degrade.
    class MediaRecorderMock {}
    Object.defineProperty(MediaRecorderMock, 'isTypeSupported', { value: vi.fn(() => true) });
    vi.stubGlobal('MediaRecorder', MediaRecorderMock);
    vi.stubGlobal('AudioContext', class AudioContextMock {});
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    const { initPresentationShare, openPresentationSharePreview } = await import('../presentation-share.js');
    await openPresentationSharePreview();
    initPresentationShare();
    const videoButton = document.getElementById('presentationShareVideoBtn') as HTMLButtonElement;

    videoButton.click();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(document.getElementById('presentationShareStatus')?.dataset['state']).toBe('video-failed');
    expect(videoButton.disabled).toBe(false);
  });

  it('falls back to the preview with a download hint when no native share sheet exists', async () => {
    const { initPresentationShare } = await import('../presentation-share.js');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    initPresentationShare();

    mockDom.presShareBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('presentationSharePreview')?.style.display).toBe('flex');
    expect(document.getElementById('presentationShareStatus')?.dataset['state']).toBe('download');
  });

  it('treats a user cancellation of the native share sheet as cancelled', async () => {
    const { initPresentationShare } = await import('../presentation-share.js');
    vi.mocked(navigator.share).mockRejectedValue(Object.assign(new Error('denied'), { name: 'AbortError' }));
    initPresentationShare();

    mockDom.presShareBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('presentationSharePreview')?.classList.contains('hidden')).toBe(true);
  });

it('shares through the Capacitor bridge when running inside the native wrapper', async () => {
    capacitorMock.isNativePlatform.mockImplementation(() => true);
    const { initPresentationShare } = await import('../presentation-share.js');
    initPresentationShare();

    mockDom.presShareBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(capacitorShareMock.canShare).toHaveBeenCalled();
    expect(filesystemMock.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'shared/quran-1-1-portrait.png', directory: 'CACHE', recursive: true }),
    );
    expect(capacitorShareMock.share).toHaveBeenCalledTimes(1);
  });

  it('guards against double initialisation', async () => {
    const { initPresentationShare } = await import('../presentation-share.js');
    initPresentationShare();
    initPresentationShare();
    expect(mockDom.presShareBtn.dataset['presentationShareBound']).toBe('true');
  });
});

