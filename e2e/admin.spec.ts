import { expect, test } from '@playwright/test'
import { collectErrors, open, resetDemo, setIdentity, startRound } from './helpers'

/** Administrace: pozice, oprávnění, log úprav a hranice rolí. */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
  await setIdentity(page, 'admin')
})

test('pozice se uloží i po obnovení a hráč se při výběru prohodí', async ({ page }) => {
  const errors = collectErrors(page)
  await open(page, '#/admin/round/r1')
  const position1 = page.getByLabel('Team A Pozice 1')
  const position2 = page.getByLabel('Team A Pozice 2')
  await expect(position1).toHaveValue('p3')
  await expect(position2).toHaveValue('p1')

  // Mac (p1) z pozice 2 na pozici 1: Ota (p3) se přesune na dvojku.
  await position1.selectOption('p1')
  await expect(position1).toHaveValue('p1')
  await expect(position2).toHaveValue('p3')
  await expect(page.locator('.notice.error')).toHaveCount(0)

  // Vyprázdnění pozice nesmí nechat díru v datech (Firestore by ji odmítl).
  await page.getByLabel('Team A Pozice 4').selectOption('')
  await expect(page.locator('.notice.error')).toHaveCount(0)

  await page.reload()
  await page.waitForSelector('.screen')
  await expect(page.getByLabel('Team A Pozice 1')).toHaveValue('p1')
  await expect(page.getByLabel('Team A Pozice 2')).toHaveValue('p3')
  await expect(page.getByLabel('Team A Pozice 4')).toHaveValue('')

  // Výběr nabízí jen hráče daného týmu.
  const options = await page
    .getByLabel('Team B Pozice 1')
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
  expect(options.filter(Boolean).sort()).toEqual(['p2', 'p4', 'p6', 'p8'])
  expect(errors()).toEqual([])
})

test('uid zapisovatele zachová velikost písmen, e-mail se převede na malá', async ({
  page,
}) => {
  await open(page, '#/admin')
  const input = page.getByLabel('Přidat e-mail nebo uid')
  await input.fill('  Xk3PqZ9aBcD  ')
  await page.getByRole('button', { name: '+ uid' }).click()
  await expect(page.locator('.chip', { hasText: 'Xk3PqZ9aBcD' })).toBeVisible()

  await input.fill('Novy.Hrac@Gmail.com')
  await page.getByRole('button', { name: '+ Zapisovatelé' }).click()
  await expect(page.locator('.chip', { hasText: 'novy.hrac@gmail.com' })).toBeVisible()

  await page.reload()
  await page.waitForSelector('.screen')
  await expect(page.locator('.chip', { hasText: 'Xk3PqZ9aBcD' })).toBeVisible()
})

test('log úprav ukazuje datum, čas a změnu', async ({ page }) => {
  await startRound(page)
  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const first = page.locator('.player-row').nth(0)
  await first.locator('.score-value').click()
  await first.locator('.step-button').last().click()

  await setIdentity(page, 'admin')
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: 'Načíst' }).click()
  const rows = page.locator('table.edits-log tr')
  await expect(rows).toHaveCount(2)
  // Nejnovější nahoře: 4 -> 5, datum ve tvaru d. m. a čas.
  await expect(rows.first()).toContainText('4 → 5')
  await expect(rows.first().locator('td').first()).toHaveText(
    /\d{1,2}\.\s?\d{1,2}\..*\d{1,2}:\d{2}/,
  )
})

test('zapisovatel nemá přístup k administraci kola', async ({ page }) => {
  await setIdentity(page, 'writer')
  await open(page, '#/admin')
  await expect(page.locator('.notice').first()).toContainText('jen pro administrátora')
  await expect(page.getByRole('button', { name: 'Inicializovat turnaj' })).toHaveCount(0)
})

test('hry kola jde přidat a odebrat bez ztráty skóre', async ({ page }) => {
  await startRound(page)
  await open(page, '#/play/r1/0')
  await page.locator('.player-row').nth(0).locator('.score-value').click()

  await open(page, '#/admin/round/r1')
  const games = page.locator('.game-card')
  const before = await games.count()
  await page.getByRole('button', { name: 'Přidat hru' }).click()
  await expect(games).toHaveCount(before + 1)
  page.once('dialog', (dialog) => void dialog.accept())
  await games.last().getByRole('button', { name: 'Odebrat hru' }).click()
  await expect(games).toHaveCount(before)

  await open(page, '#/play/r1/0')
  await expect(page.locator('.player-row').nth(0).locator('.mark')).toHaveText('4')
})
