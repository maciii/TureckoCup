import { expect, test } from '@playwright/test'
import { collectErrors, open, resetDemo, setIdentity, startRound } from './helpers'

/**
 * Kouřový test hlavní cesty turnaje:
 *  - visitor vidí přehled a kolo bez přihlášení,
 *  - admin spustí kolo, zapisovatel zapíše flight bez rolování,
 *  - druhá stránka (druhý flight) a visitor vidí změnu.
 */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

test('přehled ukazuje turnaj a kola bez přihlášení', async ({ page }) => {
  const errors = collectErrors(page)
  await open(page)
  await expect(page.locator('.score-hero').first()).toBeVisible()
  await expect(page.locator('.hero p')).toContainText('Belek')
  await expect(page.locator('.list .row')).toHaveCount(5)
  await page.locator('.list .row').first().click()
  // Přehled má dva nadpisy h1; čeká se na nadpis detailu kola.
  await expect(page).toHaveURL(/#\/round\/r1$/)
  await expect(page.getByRole('heading', { level: 1, name: /Kolo 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(page.locator('table.scorecard').first()).toBeVisible()
  expect(errors()).toEqual([])
})

test('admin spustí kolo, zapisovatel zapíše a visitor vidí výsledek', async ({
  page,
  context,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  await setIdentity(page, 'writer')

  await open(page, '#/play/r1/0')
  const rows = page.locator('.player-row')
  await expect(rows).toHaveCount(4)

  // Čtyři hráči se vejdou na displej bez rolování obsahu.
  const fits = await page.evaluate(() => {
    const content = document.querySelector('.content')
    return content ? content.scrollHeight <= content.clientHeight + 1 : false
  })
  expect(fits).toBe(true)

  // Klepnutí vloží par, plus přidá ránu.
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
  expect(errors()).toEqual([])
})

test('visitor nemůže zapisovat', async ({ page }) => {
  await open(page, '#/play/r1/0')
  await expect(page.locator('.notice').first()).toContainText('přihlas')
  await expect(page.locator('.player-row .step-button').first()).toBeDisabled()
})
