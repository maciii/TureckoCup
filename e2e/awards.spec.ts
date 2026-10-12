import { expect, test } from '@playwright/test'
import {
  collectErrors,
  expectNoHorizontalOverflow,
  open,
  resetDemo,
  setIdentity,
  startRound,
} from './helpers'

/**
 * Odznaky zájezdu: medaile na úvodní obrazovce, tabulka po rozkliknutí
 * a gratulace přihlášenému hráči k novému odznaku (jen jednou).
 */

test('testovací verze: odznaky s držiteli a tabulka všech hráčů', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?demo=4dny#/')
  await page.waitForSelector('.screen')
  const awards = page.locator('section.awards')
  await expect(awards).toContainText('Odznaky zájezdu')
  await expect(awards).toContainText('po 4 kolech')
  await expect(awards.locator('.award-btn')).toHaveCount(13)
  const first = awards.locator('.award-btn').first()
  await expect(first).toContainText('STBák zájezdu')
  await expect(first).toContainText('bodů')
  await expectNoHorizontalOverflow(page)

  await first.click()
  const sheet = page.getByRole('dialog', { name: 'STBák zájezdu' })
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('li.row')).toHaveCount(8)
  await expect(sheet.locator('li.row').first()).toHaveClass(/leader/)
  await sheet.getByRole('button', { name: 'Zavřít' }).click()
  await expect(sheet).toHaveCount(0)
  expect(errors()).toEqual([])
})

test('bez zapsaných ran odznaky nejsou; po birdie hráč dostane gratulaci jen jednou', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await resetDemo(page)
  await expect(page.locator('section.awards')).toHaveCount(0)

  await startRound(page)
  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const rows = page.locator('.player-row')
  for (let i = 0; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  // Ferry (čtvrtý řádek) birdie.
  await rows.nth(3).locator('.step-button').first().click()

  // Přímé načtení (bez pomocníka, který gratulaci odklepává).
  await page.goto('/?demo=1#/')
  await page.waitForSelector('.screen')
  // Uvítání hráče jde první (jednou denně), gratulace k odznakům až po něm.
  const welcome = page.locator('.welcome-intro-close')
  if ((await welcome.count()) > 0) await welcome.click()
  const intro = page.locator('.award-intro')
  await expect(intro).toBeVisible()
  await expect(intro).toContainText('Gratulujeme, Ferry!')
  // Projít všechny nové odznaky; Birdie Man je mezi nimi.
  const names: string[] = []
  for (let i = 0; i < 13 && (await intro.count()) > 0; i += 1) {
    names.push((await intro.locator('.award-intro-name').innerText()).trim())
    await intro.locator('.award-intro-btn').click()
  }
  expect(names).toContain('Birdie Man')
  await expect(intro).toHaveCount(0)
  // Odznak je na přehledu označený jako Ferryho.
  const birdie = page.locator('.award-btn', { hasText: 'Birdie Man' })
  await expect(birdie).toContainText('Ferry')
  await expect(birdie).toHaveClass(/mine/)

  // Po obnovení už se gratulace neopakuje; návštěvník ji nevidí vůbec.
  await page.reload()
  await page.waitForSelector('.screen')
  await expect(page.locator('section.awards')).toBeVisible()
  await expect(intro).toHaveCount(0)
  await setIdentity(page, 'visitor')
  await open(page)
  await expect(intro).toHaveCount(0)
  expect(errors()).toEqual([])
})

test('Skinař: vysvětlení a rozpis skinů ve flightu netto i brutto', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?demo=4dny#/')
  await page.waitForSelector('.screen')
  await page.locator('.award-btn', { hasText: 'Skinař' }).click()
  const sheet = page.getByRole('dialog', { name: 'Skinař' })
  await expect(sheet).toContainText('dělená jamka přenáší')
  const breakdown = sheet.locator('.skins-breakdown')
  await expect(breakdown.locator('.ts-hole.win-a, .ts-hole.win-b').first()).toBeVisible()
  await expect(breakdown.locator('.ts-hole-who').first()).not.toBeEmpty()
  const net = await breakdown.getByTestId('skins-totals').innerText()
  await breakdown.getByRole('button', { name: 'Brutto', exact: true }).click()
  await expect(breakdown.getByTestId('skins-totals')).not.toHaveText(net)
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})
