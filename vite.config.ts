import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Recovery Tracker',
        short_name: 'Recovery',
        description: 'Track your wellbeing, medications, and habits',
        theme_color: '#0d1424',
        background_color: '#0d1424',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell and assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Network-first for API calls (never cache auth/data requests)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/anthropic/, ''),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
