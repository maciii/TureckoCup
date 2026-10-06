import { defineConfig, devices } from '@playwright/test'
import type { PlaywrightTestConfig } from '@playwright/test'

/**
 * E2E proti emulátorům Firebase (Auth + Firestore s ostrými `firestore.rules`).
 * Ověřuje produkční datovou vrstvu (`fireStore.ts`), kterou ukázkový režim
 * nepokrývá: přihlášení, zápis přes rules, živou synchronizaci mezi telefony.
 *
 *   npm run test:e2e:firebase
 *
 * Skript spouští emulátory (`firebase emulators:exec`) a vývojový server
 * s falešnou konfigurací projektu `demo-tc26` (projekt `demo-*` nikdy
 * nesahá na skutečný Firebase).
 */
const PORT = 5175
const LONG_POLLING_PORT = 5176
const chromiumPath = process.env.PW_CHROMIUM
const chromium: PlaywrightTestConfig['use'] = {
  browserName: 'chromium',
  ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
}

export default defineConfig({
  testDir: './e2e-firebase',
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'cs-CZ',
  },
  // Dva vývojové servery: Android proti výchozímu přenosu Firestoru, iOS
  // (WebKit) přes long polling - viz komentář v src/data/firebase.ts.
  webServer: [PORT, LONG_POLLING_PORT].map((port) => ({
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
      VITE_FIREBASE_PROJECT_ID: 'demo-tc26',
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_FIREBASE_EMULATOR: '127.0.0.1',
      ...(port === LONG_POLLING_PORT ? { VITE_FIREBASE_LONG_POLLING: '1' } : {}),
    },
  })),
  projects: [
    {
      name: 'ios-iphone13',
      use: {
        ...(chromiumPath
          ? { ...devices['iPhone 13'], ...chromium }
          : { ...devices['iPhone 13'] }),
        baseURL: `http://localhost:${LONG_POLLING_PORT}`,
      },
    },
    { name: 'android-pixel7', use: { ...devices['Pixel 7'], ...chromium } },
  ],
})
