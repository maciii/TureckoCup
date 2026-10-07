import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  collectErrors,
  expectNoHorizontalOverflow,
  open,
  resetDemo,
  setIdentity,
  startRound,
} from './helpers'

/**
 * Nastavení her: centrální pravidlo pro zvednutou jamku, four-ball s editorem
 * dvojic a extra body (longest, nearest, birdie …) od zápisu po výsledky.
 */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

/** Flight 1 kola 1: Ota (A1), Mac (A2), Pavlos (B1), Ferry (B2). */
async function enterPar(page: Page, rows: number[]) {
  for (const row of rows)
    await page.locator('.player-row').nth(row).locator('.score-value').click()
}

test('zvednutá jamka ve hře na rány podle pravidla turnaje', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  // Duely pozic na brutto rány, ať je počet ran vidět přímo.
  await page
    .locator('.game-card')
    .nth(3)
    .getByRole('button', { name: 'Brutto rány' })
    .click()

  await open(page, '#/admin')
  const formula = page.getByTestId('pickup-formula')
  await expect(formula).toHaveText('Zvednutá jamka = par + 2 + rány z HCP')
  await page.getByRole('button', { name: '2× par', exact: true }).click()
  await expect(formula).toHaveText('Zvednutá jamka = 2 × par')

  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  // Ota (A1) jedničku zvedl, Pavlos (B1) zahrál par 4.
  await page.locator('.player-row').nth(0).locator('.pickup-button').click()
  await enterPar(page, [2])

  await open(page, '#/round/r1')
  const duel = page
    .locator('section', { has: page.getByRole('heading', { name: 'Duely pozic' }) })
    .locator('.duel')
    .first()
  await expect(duel.locator('.duel-side .sub').first()).toHaveText('8')
  await expect(duel.locator('.duel-side .sub').last()).toHaveText('4')

  await setIdentity(page, 'admin')
  await open(page, '#/admin')
  await page.getByRole('button', { name: '2× par + 2' }).click()
  await expect(formula).toHaveText('Zvednutá jamka = 2 × par + 2')
  await open(page, '#/round/r1')
  await expect(duel.locator('.duel-side .sub').first()).toHaveText('10')

  // Vlastní vzorec: 1 × par + 3, bez ran z handicapu.
  await open(page, '#/admin')
  await page.getByRole('button', { name: 'Vlastní' }).click()
  await page.getByLabel('Násobek paru').fill('1')
  await page.getByLabel('Rány navíc').fill('3')
  await expect(formula).toHaveText('Zvednutá jamka = par + 3')
  await expectNoHorizontalOverflow(page)
  await open(page, '#/round/r1')
  await expect(duel.locator('.duel-side .sub').first()).toHaveText('7')
  expect(errors()).toEqual([])
})

test('four-ball: přidání hry, dvojice z flightů a jejich úprava', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: '+ Přidat hru' }).click()
  const card = page.locator('.game-card').nth(4)
  await expect(card.getByLabel('Hry kola')).toHaveValue('team-match')
  await expect(card.getByLabel('Zápas 1 A 1')).toHaveValue('p3')
  await expect(card.getByLabel('Zápas 1 A 2')).toHaveValue('p1')
  await expect(card.getByLabel('Zápas 1 B 1')).toHaveValue('p2')
  await expect(card.getByLabel('Zápas 2 B 2')).toHaveValue('p8')
  await expect(
    card.getByRole('switch', { name: 'Počítá se do týmového skóre' }),
  ).toHaveAttribute('aria-checked', 'true')
  await card.getByLabel('Zápas 1 A 2').selectOption('p5')
  await expectNoHorizontalOverflow(page)

  await open(page, '#/round/r1')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Four-ball' }),
  })
  await expect(section.locator('.duel')).toHaveCount(2)
  await expect(section.locator('.duel').first()).toContainText('Ota + Jarin')
  await expect(section.locator('.section-note')).toContainText('Jamkovka')

  await open(page, '#/admin/round/r1')
  await card.getByRole('button', { name: 'Dvojice z flightů' }).click()
  await expect(card.getByLabel('Zápas 1 A 2')).toHaveValue('p1')
  await open(page, '#/round/r1')
  await expect(section.locator('.duel').first()).toContainText('Ota + Mac')
  expect(errors()).toEqual([])
})

test('extra body: nastavení, zápis u jamky, scorekarta a výsledky', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: '+ Přidat hru' }).click()
  const card = page.locator('.game-card').nth(4)
  await card.getByLabel('Hry kola').selectOption('bonuses')
  await expect(card.getByLabel('Nearest')).toHaveValue('1')
  await expect(card.getByLabel('Sandie')).toHaveValue('0')
  await card.getByLabel('Sandie').fill('1')
  await expectNoHorizontalOverflow(page)

  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const rows = page.locator('.player-row')
  const mac = rows.nth(1)
  const pavlos = rows.nth(2)
  // Jamka 1 a 2 (par 4): hvězdička nabízí jen sandie, ne nearest.
  await expect(mac.getByRole('button', { name: 'Extra body: Mac' })).toHaveText('★')
  await enterPar(page, [0, 1, 2, 3])
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await enterPar(page, [0, 1, 2, 3])
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await expect(page.locator('.hole-info')).toContainText('Jamka 3 z 18')

  // Jamka 3 (par 3): Mac birdie (2) + nearest.
  await mac.locator('.score-value').click()
  await mac.locator('.step-button').first().click()
  await expect(mac.locator('.mark')).toHaveText('2')
  await mac.getByRole('button', { name: 'Extra body: Mac' }).click()
  const sheet = page.getByRole('dialog', { name: 'Extra body' })
  await expect(sheet.locator('.bonus-option')).toHaveCount(2)
  await expect(sheet.getByRole('button', { name: /Longest/ })).toHaveCount(0)
  await sheet.getByRole('button', { name: /Nearest/ }).click()
  await expect(sheet.getByRole('button', { name: /Nearest/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await sheet.getByRole('button', { name: 'Zavřít' }).click()
  await expect(mac.getByRole('button', { name: 'Extra body: Mac' })).toHaveText('NB')

  // Pavlos par a nearest: Macovi nearest zmizí, jen jeden hráč ho může mít.
  await pavlos.locator('.score-value').click()
  await pavlos.getByRole('button', { name: 'Extra body: Pavlos' }).click()
  await sheet.getByRole('button', { name: /Nearest/ }).click()
  await sheet.getByRole('button', { name: 'Zavřít' }).click()
  await expect(pavlos.getByRole('button', { name: 'Extra body: Pavlos' })).toHaveText('N')
  await expect(mac.getByRole('button', { name: 'Extra body: Mac' })).toHaveText('B')

  // Scorekarta ukazuje značku u rány.
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(page.locator('.scorecard .cell-marks', { hasText: 'N' })).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
  await page.locator('.sheet').getByRole('button', { name: 'Zavřít' }).click()

  await open(page, '#/round/r1')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Extra body' }),
  })
  const row = (name: string) => section.locator('li.row', { hasText: name })
  await expect(row('Mac').locator('.pill')).toHaveText('1')
  await expect(row('Mac').locator('.row-meta')).toContainText('Birdie')
  await expect(row('Pavel').locator('.pill')).toHaveText('1')
  await expect(row('Pavel').locator('.row-meta')).toContainText('Nearest')
  await expect(row('Ota').locator('.pill')).toHaveText('0')
  expect(errors()).toEqual([])
})
