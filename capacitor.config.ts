import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sulaimani.quranapp',
  appName: 'القرآن الكريم',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'api.alquran.cloud',
      'api.aladhan.com',
      'cdn.jsdelivr.net',
      'fastly.jsdelivr.net',
      'gcore.jsdelivr.net',
      'cdn.islamic.network',
      // Audio hosts, mirroring the CSP media-src list: the per-reciter
      // servers (server6..13, as configured in RECITERS) plus the CDN they
      // 301-redirect audio to. server1..5 were listed but no reciter uses
      // them; server9..13 and the CDN were missing.
      'server6.mp3quran.net',
      'server7.mp3quran.net',
      'server8.mp3quran.net',
      'server9.mp3quran.net',
      'server10.mp3quran.net',
      'server11.mp3quran.net',
      'server12.mp3quran.net',
      'server13.mp3quran.net',
      'cdn.mp3quran.net',
      'raw.githubusercontent.com',
      'api.quran.com',
    ],
  },
  android: {
    backgroundColor: '#1a1a2e',
    // Deliberately left true pending on-device verification: the network
    // security config already forbids cleartext traffic, so this only affects
    // local dev servers. Flip it only after confirming dev live-reload still
    // works on a real device.
    allowMixedContent: true,
  },
  plugins: {
    // IMPORTANT: CapacitorHttp is DISABLED because it intercepts ALL fetch() calls
    // and corrupts binary data (woff2 fonts). The WebView's native fetch() handles
    // CORS correctly with the permissive CSP and network_security_config.xml.
    CapacitorHttp: {
      enabled: false,
    },
    App: {
      // The reader owns Android Back navigation and asks before closing at root.
      disableBackButtonHandler: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#5c2e2e',
      // Keep the WebView below Android's clock, signal, and battery area.
      overlaysWebView: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      showSpinner: true,
      spinnerColor: '#d97706',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
