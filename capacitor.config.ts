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
      'server*.mp3quran.net',
      'raw.githubusercontent.com',
      'api.quran.com'
    ]
  },
  android: {
    backgroundColor: '#1a1a2e'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
