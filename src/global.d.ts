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
  result?: unknown;
  tagName?: string;
  blur?(): void;
}

// Build-time app version injected by Vite (see vite.config.js `define`).
// Single source of truth: package.json "version".
declare const __APP_VERSION__: string;

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
