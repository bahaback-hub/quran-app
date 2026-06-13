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
      'api.quran.com'
    ]
  },
  android: {
    backgroundColor: '#1a1a2e',
    allowMixedContent: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#5c2e2e'
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1a1a2e',
      showSpinner: true,
      spinnerColor: '#d97706'
    }
  }
};

export default config;
