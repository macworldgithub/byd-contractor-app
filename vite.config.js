import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: 'BYD Contractor Hub — Fairfield',
        short_name: 'BYD Contractor',
        description: 'BYD Fairfield Contractor Job Management, Timer Tracking & Evidence Capture',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'automotive'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'My Jobs',
            short_name: 'Jobs',
            description: 'View active and assigned jobs',
            url: '/jobs',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Kanban Board',
            short_name: 'Board',
            description: 'Track vehicle job workflow',
            url: '/kanban',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
      }
    })
  ],
});
