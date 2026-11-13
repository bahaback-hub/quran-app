/**
 * Voice search (Web Speech API on web, Capacitor SpeechRecognition on Android).
 *
 * Extracted from `search-ui.ts`; behavior and the exported API are unchanged.
 */
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import {
  getVoiceListening,
  getVoiceRecognition,
  setVoiceListening,
  setVoiceRecognition,
} from '../../internal-state.js';
import { dom } from '../../dom.js';
import { showToast } from '../../ui.js';
import { __ } from '../../i18n.js';

/* ===================== VOICE SEARCH ===================== */

/** SpeechRecognition API types (not in standard TS DOM lib). */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

/**
 * Start voice search using the Web Speech API (SpeechRecognition).
 * Configures recognition for Arabic (ar-SA), shows a listening indicator,
 * and auto-fills the search input with the recognized transcript.
 * Falls back to an error toast if the API is unavailable.
 *
 * @example
 * startVoiceSearch(); // typically bound to a microphone button click
 */
export function startVoiceSearch(): void {
  if (Capacitor.getPlatform() === 'android') {
    void startNativeVoiceSearch();
    return;
  }

  const SpeechRecognition =
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition ||
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast(__('voice_search_unsupported'), 'error');
    return;
  }
  if (getVoiceListening()) {
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  setVoiceListening(true);
  dom.voiceSearchBtn?.classList.add('listening');
  showToast(__('voice_search_speaking'), 'success');
  recognition.onresult = (e: SpeechRecognitionEvent) => {
    const transcript = e.results[0]![0]!.transcript;
    submitVoiceSearch(transcript);
    stopVoiceSearch();
  };
  recognition.onerror = (event: Event) => {
    const code = (event as Event & { error?: string }).error;
    showToast(
      code === 'not-allowed' || code === 'service-not-allowed'
        ? __('voice_search_permission_denied')
        : __('voice_search_not_recognized'),
      'error',
    );
    stopVoiceSearch();
  };
  recognition.onend = () => stopVoiceSearch();
  recognition.start();
  setVoiceRecognition(recognition);
}

/**
 * Start Android speech recognition through the native platform API.
 *
 * The Web Speech API does not reliably surface Android runtime permission prompts
 * inside WebView. The Capacitor plugin checks and requests RECORD_AUDIO only after
 * the user taps the microphone, then returns the recognized Arabic phrase.
 */
async function startNativeVoiceSearch(): Promise<void> {
  if (getVoiceListening()) {
    return;
  }

  try {
    const availability = await SpeechRecognition.available();
    if (!availability.available) {
      showToast(__('voice_search_service_unavailable'), 'error');
      return;
    }

    let permission = await SpeechRecognition.checkPermissions();
    if (permission.speechRecognition !== 'granted') {
      permission = await SpeechRecognition.requestPermissions();
    }
    if (permission.speechRecognition !== 'granted') {
      showToast(__('voice_search_permission_denied'), 'error');
      return;
    }

    setVoiceListening(true);
    dom.voiceSearchBtn?.classList.add('listening');
    showToast(__('voice_search_speaking'), 'success');

    const result = await SpeechRecognition.start({
      language: 'ar-SA',
      maxResults: 1,
      prompt: __('voice_search_prompt'),
      popup: true,
      partialResults: false,
    });
    const transcript = result.matches?.[0];
    if (!submitVoiceSearch(transcript)) {
      showToast(__('voice_search_not_recognized'), 'error');
    }
  } catch (error) {
    console.warn('[VoiceSearch] Native recognition failed', error);
    showToast(__('voice_search_error'), 'error');
  } finally {
    stopVoiceSearch();
  }
}

/** Apply a recognized phrase to the search input and invoke the normal search flow. */
function submitVoiceSearch(transcript: string | undefined): boolean {
  const normalizedTranscript = transcript?.trim();
  if (!normalizedTranscript || !dom.searchInput) {
    return false;
  }
  dom.searchInput.value = normalizedTranscript;
  dom.searchBtn?.click();
  return true;
}

function stopVoiceSearch(): void {
  setVoiceListening(false);
  dom.voiceSearchBtn?.classList.remove('listening');
  if (Capacitor.getPlatform() === 'android') {
    void SpeechRecognition.stop().catch(() => {
      // Recognition may already have ended after returning a final match.
    });
  }
  if (getVoiceRecognition()) {
    try {
      (getVoiceRecognition() as SpeechRecognitionInstance).stop();
    } catch {
      /* noop */
    }
    setVoiceRecognition(null);
  }
}

/* ===================== ARABIC KEYBOARD ===================== */
