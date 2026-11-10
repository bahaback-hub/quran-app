import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sulaimani.quranapp',
  appName: 'القرآن الكريم',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // SEC-05: allowNavigation governs NAVIGATION only — a listed host can
    // replace the whole app inside the native WebView. Every host this app
    // touches is a data/audio endpoint reached through fetch() or <audio>
    // (unaffected by this list and already pinned by the CSP and the network
    // security config), and the few real external links (API credits, repo)
    // are target="_blank" + rel="noopener" and open in the system browser —
    // exactly like github.com, which was never listed. The list used to
    // mirror the CSP and grew to 17 hosts; it is empty now, so no
    // compromised or coercing endpoint can hijack the WebView.
    allowNavigation: [],
  },
  android: {
    backgroundColor: '#1a1a2e',
    // SEC-05: false — the network security config already forbids cleartext, and
    // every remote resource (APIs, audio, mirrors) is HTTPS-only, so mixed
    // content has no legitimate use in production.
    allowMixedContent: false,
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
