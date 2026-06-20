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
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      input: './index.html',
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        compact: true,
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
      // 'autoUpdate' ensures the Service Worker updates automatically without
      // waiting for user prompt. Combined with skipWaiting + clientsClaim below,
      // users always get the latest version on next page load.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['azan.mp3', 'icon-192.png', 'icon-512.png', 'fonts/*.ttf', 'fonts/fonts.css', 'data/*.json'],
      manifest: {
        name: 'القرآن الكريم',
        short_name: 'القرآن',
        description: 'تطبيق ويب للقرآن الكريم مع الصوت والتفسير والمصحف',
        theme_color: '#5c2e2e',
        background_color: '#faf5f2',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        lang: 'ar',
        dir: 'rtl',
        categories: ['education', 'lifestyle'],
        prefer_related_applications: false,
        screenshots: [
          {
            src: 'screenshots/reading-mode.svg',
            sizes: '800x500',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'وضع قراءة القرآن'
          },
          {
            src: 'screenshots/mushaf-mode.svg',
            sizes: '800x500',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'وضع المصحف'
          },
          {
            src: 'screenshots/presentation-mode.svg',
            sizes: '800x500',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'وضع العرض'
          }
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }
        ],
        share_target: {
          action: './',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        },
        shortcuts: [
          {
            name: 'مواقيت الصلاة',
            short_name: 'الصلاة',
            description: 'عرض مواقيت الصلاة',
            url: './#prayer',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'استماع',
            short_name: 'استماع',
            description: 'الاستماع إلى القرآن الكريم',
            url: './#audio',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,ttf}'],
        offlineGoogleAnalytics: false,
        navigateFallback: 'index.html',
        // Don't intercept same-origin requests — let Capacitor handle them
        navigateFallbackDenylist: [/^\/assets\//],
        // Force the new Service Worker to take over immediately, bypassing
        // the normal "waiting" state. This ensures users get updates on
        // the very next navigation rather than waiting for all tabs to close.
        skipWaiting: true,
        clientsClaim: true,
        // Cache-bust runtime-cached responses after 24 hours so users
        // get fresh API data instead of stale offline cache forever.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/fonts\/.*\.(ttf|css)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'self-hosted-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 86400 * 365 }
            }
          },
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
