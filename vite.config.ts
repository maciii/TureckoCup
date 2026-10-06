import { readFileSync } from 'node:fs'
// defineConfig z vitest/config, aby prošla i sekce `test`.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Bez vlastní domény běží aplikace na GitHub Pages pod cestou repozitáře;
// CI ji nastaví přes BASE_PATH, vlastní doména vede na '/'.
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
    rolldownOptions: {
      output: {
        // Firebase má vlastní chunk, aby ho šlo vynechat z předcachování.
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
        background_color: '#0f1c14',
        theme_color: '#0f1c14',
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
        // Firebase se stahuje až při přihlášení a jen online.
        globIgnores: ['**/firebase*.js'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
