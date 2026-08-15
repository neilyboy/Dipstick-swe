import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Dipstick',
        short_name: 'Dipstick',
        description: 'Modern oil change & service tracker',
        theme_color: '#0B0F19',
        background_color: '#0B0F19',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
