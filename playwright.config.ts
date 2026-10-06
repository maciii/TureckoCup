import { defineConfig, devices } from '@playwright/test'

/**
 * E2E v místním (ukázkovém) režimu: dvě stránky ve stejném kontextu jsou
 * dva flighty (sdílí localStorage), oddělený kontext je visitor. Testuje se
 * jediný telefonní profil - na hřišti se hraje z telefonu.
 */
const PORT = 5174

export default defineConfig({
  testDir: './e2e',
  retries: 0,
  fullyParallel: false,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'cs-CZ',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        // Vývojové prostředí má Chromium předinstalované mimo verzi Playwrightu.
        ...(process.env.PW_CHROMIUM
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
          : {}),
      },
    },
  ],
})
