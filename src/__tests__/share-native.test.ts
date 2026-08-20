/**
 * Android-native sharing contract:
 * Capacitor Share owns native Android; Web Share and clipboard remain fallbacks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockIsNativePlatform,
  mockCanShare,
  mockNativeShare,
  mockWebShare,
  mockCopyToClipboard,
  mockShowToast,
} = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  mockCanShare: vi.fn(() => Promise.resolve({ value: true })),
  mockNativeShare: vi.fn(() => Promise.resolve({ activityType: '' })),
  mockWebShare: vi.fn(() => Promise.resolve()),
  mockCopyToClipboard: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNativePlatform() },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: () => mockCanShare(),
    share: (...args: unknown[]) => mockNativeShare(...args),
  },
}));

vi.mock('../dom.js', () => ({ dom: { shareMenu: null } }));
vi.mock('../ui.js', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));
vi.mock('../utils.js', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
  stripTashkeel: (value: string) => value,
}));
vi.mock('../i18n.js', () => ({ __: (key: string) => key }));
vi.mock('../state.js', () => ({ state: { surahData: null, currentAyahIndex: 0 } }));

import { shareText } from '../share.js';

describe('shareText — Android native sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNativePlatform.mockReturnValue(false);
    mockCanShare.mockResolvedValue({ value: true });
    mockNativeShare.mockResolvedValue({ activityType: '' });
    mockWebShare.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: mockWebShare,
    });
  });

  it('opens the Capacitor Android share sheet instead of Web Share', async () => {
    mockIsNativePlatform.mockReturnValue(true);

    await shareText('﴿الْحَمْدُ لِلَّهِ﴾');

    expect(mockCanShare).toHaveBeenCalledTimes(1);
    expect(mockNativeShare).toHaveBeenCalledWith({
      title: 'app_title',
      text: '﴿الْحَمْدُ لِلَّهِ﴾',
    });
    expect(mockWebShare).not.toHaveBeenCalled();
  });

  it('keeps cancellation silent without copying text', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockNativeShare.mockRejectedValue({ message: 'User cancelled' });

    await shareText('نص آية');

    expect(mockCopyToClipboard).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('copies text with visible feedback after an unexpected native failure', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockNativeShare.mockRejectedValue(new Error('Bridge unavailable'));

    await shareText('نص آية', 'copied');

    expect(mockCopyToClipboard).toHaveBeenCalledWith('نص آية');
    expect(mockShowToast).toHaveBeenCalledWith('copied', 'success');
  });

  it('uses Web Share in a browser', async () => {
    await shareText('نص آية');

    expect(mockWebShare).toHaveBeenCalledWith({ title: 'app_title', text: 'نص آية' });
    expect(mockNativeShare).not.toHaveBeenCalled();
  });
});
