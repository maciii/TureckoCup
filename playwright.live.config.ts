import { defineConfig, devices } from '@playwright/test'
import type { PlaywrightTestConfig } from '@playwright/test'

/**
 * Kouřový test živé aplikace na Firebase Hosting. Jen čte: otevře aplikaci
 * jako visitor bez přihlášení a ukázkový režim, nic nezapisuje do ostré
 * databáze. CI ho pouští po každém nasazení.
 *
 *   npm run test:e2e:live
 *   LIVE_URL=https://jina-adresa.web.app npm run test:e2e:live
 */
const LIVE_URL = process.env.LIVE_URL ?? 'https://turecko-cup.web.app'
const chromiumPath = process.env.PW_CHROMIUM
const chromium: PlaywrightTestConfig['use'] = {
  browserName: 'chromium',
  ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
}

export default defineConfig({
  testDir: './e2e-live',
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: LIVE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'cs-CZ',
    // Nasazení právě proběhlo: starý service worker nesmí servírovat
    // předchozí verzi z cache.
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'ios-iphone13',
      use: chromiumPath
        ? { ...devices['iPhone 13'], ...chromium }
        : { ...devices['iPhone 13'] },
    },
    { name: 'android-pixel7', use: { ...devices['Pixel 7'], ...chromium } },
  ],
})
