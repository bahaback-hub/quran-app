import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// When building for Capacitor Android, disable PWA/Service Worker entirely
const isCapacitorBuild = process.env.BUILD_TARGET === 'capacitor';

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    cssMinify: 'lightningcss',
    modulePreload: { polyfill: false },
    target: 'es2020',
    rollupOptions: {
      input: './index.html',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
              if (id.includes('ajv') || id.includes('json-schema')) return 'vendor-json';
            return 'vendor';
          }
          // Split translation bundles for lazy loading
          if (id.includes('/translations/')) return 'i18n-translations';
          // Split large feature modules for lazy loading
          if (id.includes('/mushaf-') || id.includes('/mushaf.js')) return 'feature-mushaf';
          if (id.includes('/presentation') || id.includes('/pres-')) return 'feature-presentation';
          if (id.includes('/tajweed')) return 'feature-tajweed';
          if (id.includes('/search-')) return 'feature-search';
          if (id.includes('adhan') || id.includes('/prayer-local')) return 'feature-prayer-local';
        }
      }
    }
  },
  server: {
    port: 3000,
    open: false,
    hmr: {
      overlay: true
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  plugins: [
    // Disable PWA entirely for Capacitor builds — SW breaks Android WebView
    ...(isCapacitorBuild ? [] : [VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['azan.mp3', 'icon-192.png', 'icon-512.png', 'fonts/*.ttf', 'fonts/fonts.css', 'data/*.json'],
      manifest: {
        name: 'القرآن الكريم',
        short_name: 'القرآن',
        description: 'تطبيق ويب للقرآن الكريم مع الصوت والتفسير والمصحف',
        theme_color: '#5c2e2e',
        background_color: '#faf5f2',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ar',
        dir: 'rtl',
        categories: ['education', 'lifestyle'],
        iarc_rating_id: '',
        prefer_related_applications: false,
        screenshots: [],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,ttf}'],
        offlineGoogleAnalytics: false,
        navigateFallback: 'index.html',
        // Don't intercept same-origin requests — let Capacitor handle them
        navigateFallbackDenylist: [/^\/assets\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.alquran\.cloud\/v1\/quran\/quran-uthmani/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-full-text',
              expiration: { maxEntries: 2, maxAgeSeconds: 86400 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/api\.alquran\.cloud\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'quran-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 }
            }
          },
          {
            urlPattern: /^https:\/\/api\.aladhan\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'prayer-api',
              expiration: { maxEntries: 10, maxAgeSeconds: 3600 }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/spa5k\/tafsir_api/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tafsir-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/server\d+\.mp3quran\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-audio',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.islamic\.network\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'islamic-cdn',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*quran-qcf4\/.*\/pages\/.*\.json/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mushaf-layout',
              expiration: { maxEntries: 700, maxAgeSeconds: 86400 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/MohamadHajjRabee\/quran-qcf4.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mushaf-fonts',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 365 }
            }
          },
          // Cache self-hosted fonts locally (precache covers this, but runtime cache ensures freshness)
          {
            urlPattern: /\/fonts\/.*\.(ttf|css)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 86400 * 365 }
            }
          }
        ]
      }
    })])
  ]
});
