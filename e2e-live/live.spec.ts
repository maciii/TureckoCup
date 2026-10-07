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
    await expect(page.locator('.list > button.row')).toHaveCount(5)
    await page.locator('.list > button.row').first().click()
    await expect(page).toHaveURL(/#\/round\/r1$/)
    await expect(page.getByRole('heading', { level: 1, name: /Kolo 1/ })).toBeVisible()
    await page.getByRole('button', { name: 'Scorekarta' }).click()
    await expect(page.locator('table.scorecard').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  expect(errors()).toEqual([])
})

test('PWA: manifest, service worker a hlavičky cache', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.screen')
  // Stahuje se v prohlížeči stejně jako na telefonu (a přes stejnou síť),
  // ne HTTP klientem testovacího běhu.
  const files = await page.evaluate(async () => {
    const manifest = await fetch('/manifest.webmanifest', { cache: 'no-store' })
    const sw = await fetch('/sw.js', { cache: 'no-store' })
    return {
      manifestOk: manifest.ok,
      name: manifest.ok ? ((await manifest.json()) as { name?: string }).name : null,
      swOk: sw.ok,
      swCache: sw.headers.get('cache-control') ?? '',
    }
  })
  expect(files.manifestOk).toBe(true)
  expect(files.name).toBe('Turecko Cup 26')
  expect(files.swOk).toBe(true)
  expect(files.swCache).toContain('no-cache')

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

test('všech pět kol jde otevřít a mají scorekartu', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.waitForSelector('.screen')
  await expect(page.getByText('Načítám…')).toHaveCount(0, { timeout: 30_000 })
  test.skip(
    !(await page.locator('.score-hero').first().isVisible()),
    'Turnaj ještě není založený',
  )
  for (let number = 1; number <= 5; number += 1) {
    await page.goto(`/#/round/r${number}`)
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(`Kolo ${number}`) }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Scorekarta' }).click()
    // Dva flighty, každý se svou tabulkou.
    await expect(page.locator('table.scorecard').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  expect(errors()).toEqual([])
})

test('přihlášení Googlem je připravené', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/#/admin')
  await page.waitForSelector('.screen')
  // Tlačítko se odemkne, až se načte přihlašovací SDK (preloadAuth). Když
  // zůstane „Připravuji přihlášení…“, popup na iPhonu nepůjde otevřít.
  await expect(page.getByRole('button', { name: 'Přihlásit se Googlem' })).toBeEnabled({
    timeout: 30_000,
  })
  // Přihlásit se smějí jen hráči a admin: žádné anonymní přihlášení.
  await expect(page.getByText(/Přihlas se Google účtem, který má admin/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Nemám Google účet/ })).toHaveCount(0)
  expect(errors()).toEqual([])
})

test('ukázkový režim běží i na produkci', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?demo=1#/')
  await page.waitForSelector('.screen')
  await expect(page.locator('.score-hero').first()).toBeVisible()
  await expect(page.locator('.list > button.row')).toHaveCount(5)
  expect(errors()).toEqual([])
})

test('testovací verze ukáže vymyšlený turnaj po čtyřech dnech', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?demo=4dny#/')
  await page.waitForSelector('.screen')
  await expect(page.getByTestId('preview-notice')).toBeVisible()
  await expect(page.locator('.app-header .preview-tag')).toBeVisible()
  const rows = page.locator('.list > button.row')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(3)).toContainText('Živě')
  for (let i = 0; i < 4; i += 1) await expect(rows.nth(i).locator('.pill')).toHaveCount(2)
  await page.goto('/?demo=4dny#/round/r3')
  await expect(page.getByRole('heading', { name: 'Four-ball dvojic' })).toBeVisible()
  // Odkaz zpět vede na ostrý turnaj bez parametru.
  await page.goto('/?demo=4dny#/')
  await expect(
    page.getByTestId('preview-notice').getByRole('link', { name: /Ostrý turnaj/ }),
  ).toHaveAttribute('href', '/')
  expect(errors()).toEqual([])
})
