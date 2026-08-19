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
      'cdn.islamic.network',
      'server1.mp3quran.net',
      'server2.mp3quran.net',
      'server3.mp3quran.net',
      'server4.mp3quran.net',
      'server5.mp3quran.net',
      'server6.mp3quran.net',
      'server7.mp3quran.net',
      'server8.mp3quran.net',
      'raw.githubusercontent.com',
      'api.quran.com',
    ],
  },
  android: {
    backgroundColor: '#1a1a2e',
    allowMixedContent: true,
  },
  plugins: {
    // IMPORTANT: CapacitorHttp is DISABLED because it intercepts ALL fetch() calls
    // and corrupts binary data (woff2 fonts). The WebView's native fetch() handles
    // CORS correctly with the permissive CSP and network_security_config.xml.
    CapacitorHttp: {
      enabled: false,
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
