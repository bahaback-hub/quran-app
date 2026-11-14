/**
 * Behavioral tests for the voice-search routes in search-ui-voice.ts:
 * the Android native recognition flow (Capacitor SpeechRecognition) and the
 * cleanup/error handling shared with the Web Speech API path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: 'web',
  available: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

const voiceState = vi.hoisted(() => ({
  listening: false,
  recognition: null as unknown,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform },
}));

vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {
    available: native.available,
    checkPermissions: native.checkPermissions,
    requestPermissions: native.requestPermissions,
    start: native.start,
    stop: native.stop,
  },
}));

vi.mock('../internal-state.js', () => ({
  getVoiceListening: () => voiceState.listening,
  setVoiceListening: (value: boolean) => {
    voiceState.listening = value;
  },
  getVoiceRecognition: () => voiceState.recognition,
  setVoiceRecognition: (value: unknown) => {
    voiceState.recognition = value;
  },
}));

vi.mock('../dom.js', () => ({
  dom: {
    searchInput: null as HTMLInputElement | null,
    searchBtn: null as HTMLElement | null,
    voiceSearchBtn: null as HTMLElement | null,
  },
}));

vi.mock('../ui.js', () => ({ showToast: vi.fn() }));

vi.mock('../i18n.js', () => ({ __: (key: string) => key }));

import { startVoiceSearch } from '../features/search/search-ui-voice.js';
import { dom } from '../dom.js';
import { showToast } from '../ui.js';

interface MockRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

/** Install a Web Speech API mock and expose the created instance. */
function installWebRecognition(): { getInstance: () => MockRecognition | null } {
  let instance: MockRecognition | null = null;
  function MockSpeechRecognition(this: MockRecognition) {
    this.lang = '';
    this.interimResults = false;
    this.maxAlternatives = 0;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.start = vi.fn();
    this.stop = vi.fn();
    instance = this;
  }
  (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
  return { getInstance: () => instance };
}

function setDom(): {
  input: HTMLInputElement;
  button: HTMLButtonElement;
  click: ReturnType<typeof vi.fn>;
} {
  const input = document.createElement('input');
  const button = document.createElement('button');
  document.body.append(input, button);
  const click = vi.fn();
  button.addEventListener('click', click);
  const writableDom = dom as unknown as Record<string, unknown>;
  writableDom.searchInput = input;
  writableDom.searchBtn = button;
  return { input, button, click };
}

beforeEach(() => {
  vi.clearAllMocks();
  voiceState.listening = false;
  voiceState.recognition = null;
  native.platform = 'android';
  native.available.mockResolvedValue({ available: true });
  native.checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  native.requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  native.start.mockResolvedValue({ matches: ['بسم الله'] });
  native.stop.mockResolvedValue(undefined);
  const writableDom = dom as unknown as Record<string, unknown>;
  writableDom.searchInput = null;
  writableDom.searchBtn = null;
  writableDom.voiceSearchBtn = null;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  document.body.replaceChildren();
});

describe('startVoiceSearch on Android', () => {
  it('submits the native transcript, clicks search, and clears listening state', async () => {
    const { input, click } = setDom();

    startVoiceSearch();

    await vi.waitFor(() => expect(input.value).toBe('بسم الله'));
    expect(click).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'ar-SA', maxResults: 1, partialResults: false }),
    );
    await vi.waitFor(() => expect(voiceState.listening).toBe(false));
    expect(native.stop).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('voice_search_speaking', 'success');
  });

  it('does nothing when a native listening session is already active', async () => {
    voiceState.listening = true;

    startVoiceSearch();
    await Promise.resolve();

    expect(native.available).not.toHaveBeenCalled();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('reports an unavailable native service without asking for permission', async () => {
    native.available.mockResolvedValue({ available: false });

    startVoiceSearch();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('voice_search_service_unavailable', 'error'));
    expect(native.checkPermissions).not.toHaveBeenCalled();
    expect(voiceState.listening).toBe(false);
  });

  it('requests permission and proceeds when the user grants it', async () => {
    const { input } = setDom();
    native.checkPermissions.mockResolvedValue({ speechRecognition: 'denied' });
    native.requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });

    startVoiceSearch();

    await vi.waitFor(() => expect(input.value).toBe('بسم الله'));
    expect(native.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('reports denied permission and never starts recognition', async () => {
    native.checkPermissions.mockResolvedValue({ speechRecognition: 'denied' });
    native.requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });

    startVoiceSearch();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('voice_search_permission_denied', 'error'));
    expect(native.start).not.toHaveBeenCalled();
    expect(voiceState.listening).toBe(false);
  });

  it('reports an unrecognized phrase when the native result is empty', async () => {
    setDom();
    native.start.mockResolvedValue({ matches: [] });

    startVoiceSearch();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('voice_search_not_recognized', 'error'));
    expect(voiceState.listening).toBe(false);
  });

  it('surfaces native failures as an error toast and still cleans up', async () => {
    native.checkPermissions.mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    startVoiceSearch();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('voice_search_error', 'error'));
    expect(voiceState.listening).toBe(false);
    expect(native.stop).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores a rejected native stop after a completed recognition', async () => {
    const { input } = setDom();
    native.stop.mockRejectedValue(new Error('already stopped'));

    startVoiceSearch();

    await vi.waitFor(() => expect(input.value).toBe('بسم الله'));
    await vi.waitFor(() => expect(native.stop).toHaveBeenCalled());
    expect(voiceState.listening).toBe(false);
  });
});

describe('startVoiceSearch cleanup (Web Speech API)', () => {
  beforeEach(() => {
    native.platform = 'web';
  });

  it('ignores empty transcripts and still stops listening', () => {
    const { getInstance } = installWebRecognition();
    startVoiceSearch();

    const instance = getInstance();
    expect(instance?.onresult).toBeTypeOf('function');
    instance?.onresult?.({ results: { 0: { 0: { transcript: '   ' } } } });

    expect(voiceState.listening).toBe(false);
  });

  it('survives a recognition whose stop() throws during onend', () => {
    let instance: MockRecognition | null = null;
    function MockSpeechRecognition(this: MockRecognition) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
      instance = this;
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    startVoiceSearch();
    voiceState.recognition = {
      stop: () => {
        throw new Error('already ended');
      },
    };

    const created = instance as MockRecognition | null;
    expect(created?.onend).toBeTypeOf('function');
    expect(() => created?.onend?.()).not.toThrow();
    expect(voiceState.listening).toBe(false);
    expect(voiceState.recognition).toBeNull();
  });
});
