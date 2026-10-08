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
 * Karta živého kola na úvodní obrazovce: kde flighty jsou, stav zápasů
 * a pro hráče či admina tlačítko rovnou do zápisu vlastního flightu.
 */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

test('bez živého kola karta není; návštěvník v živém kole vidí zápasy a přihlášení', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await open(page)
  await expect(page.locator('section.live-now')).toHaveCount(0)

  await startRound(page)
  await setIdentity(page, 'visitor')
  await open(page)
  const live = page.locator('section.live-now')
  await expect(live.locator('.eyebrow')).toContainText('Právě se hraje')
  await expect(live).toContainText('Kolo 1')
  // Oba flighty se jmény, zatím nezačaly.
  await expect(live.locator('.live-flights li.row')).toHaveCount(2)
  await expect(live.locator('.live-flights li.row').first()).toContainText(
    'Flight 1 · nezačal',
  )
  // Singly pozic ze seedu: čtyři zápasy, žádný nezačal.
  await expect(live.locator('.live-game-title')).toContainText('Singly pozic')
  await expect(live.locator('li.duel')).toHaveCount(4)
  await expect(live.locator('li.duel').first()).toContainText('Pozice 1')
  // Návštěvník nezapisuje - má tu přihlášení, ne tlačítko zápisu.
  await expect(live.getByRole('button', { name: 'Zapsat skóre' })).toHaveCount(0)
  await expect(live.getByRole('button', { name: 'Přihlásit se Googlem' })).toBeVisible()
  // Program (odjezd, tee time) zůstává pod kartou: živého kola před startem,
  // nebo dalšího kola podle data.
  await expect(page.locator('section.schedule')).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})

test('hráč jde tlačítkem rovnou do svého flightu, po zápisu karta ukazuje jamku a stav', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  await setIdentity(page, 'writer')
  await open(page)
  const live = page.locator('section.live-now')
  // Ferry hraje v prvním flightu.
  await expect(live).toContainText('Tvůj flight 1')
  await live.getByRole('button', { name: 'Zapsat skóre' }).click()
  await expect(page).toHaveURL(/#\/play\/r1\/0$/)
  await expect(page.locator('.player-row')).toHaveCount(4)

  // První jamka všem: par, prvnímu o ránu víc.
  const rows = page.locator('.player-row')
  for (let i = 0; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  await rows.nth(0).locator('.step-button').last().click()

  await open(page)
  await expect(live.locator('.live-flights li.row').first()).toContainText(
    'Flight 1 · 2. jamka',
  )
  await expect(live.locator('.live-flights li.row.own')).toHaveCount(1)
  // Rozehraný zápas má stav; druhý flight ještě ne.
  const duels = live.locator('li.duel')
  await expect(duels.first()).toContainText('1 jamka')
  await expect(duels.nth(2).locator('.duel-center .v')).toHaveText('–')
  // Jakmile se zapisuje, program živého kola z přehledu mizí (zůstane jen další kolo).
  await expect(page.locator('section.schedule')).not.toContainText('Kolo 1')
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})

test('admin má tlačítko zápisu také', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page)
  const live = page.locator('section.live-now')
  await expect(live.getByRole('button', { name: 'Zapsat skóre' })).toBeVisible()
  await expect(live).toContainText('Tvůj flight 1')
  expect(errors()).toEqual([])
})
