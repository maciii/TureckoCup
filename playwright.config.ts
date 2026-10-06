import { defineConfig, devices } from '@playwright/test'
import type { PlaywrightTestConfig } from '@playwright/test'

/**
 * E2E v místním (ukázkovém) režimu na telefonech - na hřišti se hraje
 * z iPhonu i z Androidu, nic jiného se netestuje.
 *
 *   iOS      WebKit (engine Safari), iPhone 13 a malý iPhone SE
 *   Android  Chromium, Pixel 7 a úzký Galaxy S9+ (320 px)
 *
 * Bez WebKitu (vývojový kontejner má jen předinstalované Chromium, cesta
 * v `PW_CHROMIUM`) běží iOS profily v Chromiu se stejným displejem, dotykem
 * a user agentem; skutečný WebKit pouští CI (`npx playwright install webkit`).
 */
const PORT = 5174
const chromiumPath = process.env.PW_CHROMIUM
const chromiumOnly = Boolean(chromiumPath)

const chromium: PlaywrightTestConfig['use'] = {
  browserName: 'chromium',
  ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
}

function ios(device: string): PlaywrightTestConfig['use'] {
  return chromiumOnly ? { ...devices[device], ...chromium } : { ...devices[device] }
}

export default defineConfig({
  testDir: './e2e',
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'cs-CZ',
    timezoneId: 'Europe/Istanbul',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'ios-iphone13', use: ios('iPhone 13') },
    { name: 'ios-iphone-se', use: ios('iPhone SE (3rd gen)') },
    { name: 'android-pixel7', use: { ...devices['Pixel 7'], ...chromium } },
    { name: 'android-narrow', use: { ...devices['Galaxy S9+'], ...chromium } },
  ],
})
