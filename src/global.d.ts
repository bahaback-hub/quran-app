/* eslint-disable @typescript-eslint/no-explicit-any */
// Window extensions (non-standard browser APIs)
interface Window {
  toastTimeout?: ReturnType<typeof setTimeout>;
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
  webkitAudioContext?: typeof AudioContext;
}
interface Navigator {
  connection?: { effectiveType?: string; saveData?: boolean };
  userLanguage?: string;
}

// DOM type widening — querySelector returns Element, but we use HTMLElement properties
interface Element {
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
}
interface EventTarget {
  result?: any;
  tagName?: string;
  blur?(): void;
}

// Cross-module functions - hoisted in concat build
declare function loadSurah(surahNum: number, opts?: Record<string, any>): Promise<void>;
declare function highlightCurrentAyah(): void;
declare function playCurrentAyah(): void;
declare function updatePlayerInfo(): void;
declare function prepareAudioForNewSurah(): void;
declare function updatePlayPauseBtn(): void;
declare function expandPlayer(): void;
declare function prevSurah(): void;
declare function nextSurah(): void;
declare function closeTafsir(): void;
declare function hideAzanNotification(): void;
declare function stopClock(): void;
declare function loadTafsirForSurahAyah(surahNum: number, ayahNum: number): Promise<void>;
declare function showSurahSecret(surahNum: number, surahName: string): void;
declare function initKeyboardShortcuts(): void;
declare function initNavigation(): void;
declare function initCapacitorBackButton(): void;

// Capacitor (Android/iOS) — available via <script> tag at runtime
interface Window {
  Capacitor?: {
    Plugins: {
      App: {
        addListener(event: string, callback: () => void): void;
      };
    };
  };
  installPWA?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
