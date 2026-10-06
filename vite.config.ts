import { readFileSync } from 'node:fs'
// defineConfig z vitest/config, aby prošla i sekce `test`.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Firebase Hosting servíruje aplikaci z kořene domény (<projekt>.web.app).
// BASE_PATH zůstává pro případ hostingu pod podcestou.
const base = process.env.BASE_PATH ?? '/'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as {
  version: string
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // Firebase chunk má 700 kB a je záměrně jeden - předcachuje se celý.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Firebase má vlastní chunk: načítá se dynamicky až s datovou vrstvou,
        // ale service worker ho předcachuje - bez něj by aplikace bez signálu
        // nenaběhla (na rozdíl od Golfgames je tu Firebase celá datová vrstva).
        codeSplitting: {
          groups: [{ name: 'firebase', test: /node_modules[\\/]@?firebase/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Turecko Cup 26',
        short_name: 'Turecko Cup',
        description: 'Živé výsledky golfového turnaje Turecko Cup 26',
        lang: 'cs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#faf9f5',
        theme_color: '#0a5c32',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Firebase chunk je přes 700 kB; výchozí limit 2 MB stačí, ale ať je
        // to vidět: offline start bez SDK by znamenal prázdnou obrazovku.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
