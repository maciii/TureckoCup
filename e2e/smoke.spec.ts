import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Kouřový test v místním (ukázkovém) režimu na telefonu:
 *  - visitor vidí přehled a kolo bez přihlášení,
 *  - admin spustí kolo, zapisovatel zapíše flight bez rolování,
 *  - druhá stránka (druhý flight) a visitor vidí změnu.
 */

async function open(page: Page, hash = '#/') {
  await page.goto(`/?demo=1${hash}`)
  await page.waitForSelector('.screen')
}

async function setIdentity(page: Page, role: 'admin' | 'writer' | 'visitor') {
  await page.evaluate(
    (value) => localStorage.setItem('tc26.demoIdentity.v1', value),
    role,
  )
  await page.reload()
  await page.waitForSelector('.screen')
}

test.beforeEach(async ({ page }) => {
  await open(page)
  await page.evaluate(() => localStorage.clear())
})

test('přehled ukazuje turnaj a kola bez přihlášení', async ({ page }) => {
  await open(page)
  await expect(page.locator('.score-hero').first()).toBeVisible()
  await expect(page.locator('.list .row')).toHaveCount(5)
  await page.locator('.list .row').first().click()
  await expect(page.locator('h1')).toContainText('Kolo 1')
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(page.locator('table.scorecard').first()).toBeVisible()
  // Žádné vodorovné přetečení stránky.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('admin spustí kolo, zapisovatel zapíše a visitor vidí výsledek', async ({
  page,
  context,
}) => {
  await setIdentity(page, 'admin')
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: 'Živě' }).click()

  // Zápis skóre pro flight 1.
  await open(page, '#/play/r1/0')
  await expect(page.locator('.player-row')).toHaveCount(4)

  // Čtyři hráči se vejdou na displej bez rolování obsahu.
  const fits = await page.evaluate(() => {
    const content = document.querySelector('.content')
    return content ? content.scrollHeight <= content.clientHeight + 1 : false
  })
  expect(fits).toBe(true)

  const rows = page.locator('.player-row')
  // Klepnutí vloží par, plus přidá ránu, zvednutí přes ×.
  await rows.nth(0).locator('.score-value').click()
  await rows.nth(1).locator('.step-button').last().click()
  await rows.nth(2).locator('.score-value').click()
  await rows.nth(3).locator('.score-value').click()
  await expect(rows.nth(0).locator('.mark')).toHaveText('4')
  await expect(rows.nth(1).locator('.mark')).toHaveText('5')

  // Druhá stránka ve stejném kontextu = druhý flight, vidí stejná data.
  const second = await context.newPage()
  await open(second, '#/round/r1')
  await second.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(second.locator('table.scorecard .mark.par').first()).toBeVisible()

  // Přehled ukazuje kolo jako živé a Stableford s body.
  await open(second)
  await expect(second.locator('.row.live').first()).toBeVisible()
  await expect(second.locator('.pill.team-a').first()).toBeVisible()
})

test('visitor nemůže zapisovat', async ({ page }) => {
  await open(page, '#/play/r1/0')
  await expect(page.locator('.notice').first()).toContainText('přihlas')
  await expect(page.locator('.player-row .step-button').first()).toBeDisabled()
})
