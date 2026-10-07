import { expect, test } from '@playwright/test'
import { collectErrors, expectNoHorizontalOverflow } from '../e2e/helpers'

/**
 * Živá aplikace https://turecko-cup.web.app - jen čtení.
 *
 * Ověřuje, že nasazený build je připojený k Firebase, data jdou číst bez
 * přihlášení, PWA má manifest a service worker a ukázkový režim funguje.
 * Nikdy se nepřihlašuje a nic nezapisuje: databáze je ostrá.
 */

test('aplikace je připojená a visitor vidí turnaj', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.waitForSelector('.screen')
  // Build bez konfigurace Firebase by ukázal blokující hlášku.
  await expect(page.getByText('Turnaj není připojený')).toHaveCount(0)
  await expect(page.getByText('Načítám…')).toHaveCount(0, { timeout: 30_000 })
  await expectNoHorizontalOverflow(page)

  // Před založením turnaje adminem je přehled prázdný - to je platný stav.
  const founded = await page
    .locator('.score-hero')
    .first()
    .isVisible()
    .catch(() => false)
  if (!founded) {
    await expect(page.getByText('Turnaj ještě není založený.')).toBeVisible()
  } else {
    await expect(page.locator('.list .row')).toHaveCount(5)
    await page.locator('.list .row').first().click()
    await expect(page).toHaveURL(/#\/round\/r1$/)
    await expect(page.getByRole('heading', { level: 1, name: /Kolo 1/ })).toBeVisible()
    await page.getByRole('button', { name: 'Scorekarta' }).click()
    await expect(page.locator('table.scorecard').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  expect(errors()).toEqual([])
})

test('PWA: manifest, service worker a hlavičky cache', async ({ page, request }) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  expect((await manifest.json()).name).toBe('Turecko Cup 26')

  const sw = await request.get('/sw.js')
  expect(sw.ok()).toBe(true)
  expect(sw.headers()['cache-control']).toContain('no-cache')

  await page.goto('/')
  await page.waitForSelector('.screen')
  const active = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported'
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
    ])
    return registration?.active ? 'active' : 'none'
  })
  expect(active).toBe('active')
})

test('ukázkový režim běží i na produkci', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?demo=1#/')
  await page.waitForSelector('.screen')
  await expect(page.locator('.score-hero').first()).toBeVisible()
  await expect(page.locator('.list .row')).toHaveCount(5)
  expect(errors()).toEqual([])
})
