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
    open: false
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
        theme_color: '#8b6f5a',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png}'],
        globIgnores: ['**/pages/**', '**/mushaf-icon.png'],
        navigateFallback: 'index.html',
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
            urlPattern: /\/pages\/page\d+\.png$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mushaf-pages',
              expiration: { maxEntries: 604, maxAgeSeconds: 86400 * 365 }
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
