import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['azan.mp3', 'icon-192.png', 'icon-512.png'],
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
        globPatterns: ['**/*.{js,css,html,json,png}'],
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
              cacheName: 'quran-audio',
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
          }
        ]
      }
    })
  ]
});
