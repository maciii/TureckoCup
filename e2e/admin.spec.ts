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

test('e-mail hráče se uloží malými písmeny a nejde dát dvěma hráčům', async ({
  page,
}) => {
  await open(page, '#/admin')
  const pavlos = page.getByLabel('Google e-mail: Pavel Tomán')
  await pavlos.fill('  Pavel.Toman@Gmail.com ')
  await pavlos.blur()
  await expect(page.locator('[role="alert"]')).toHaveCount(0)

  // Stejný e-mail u jiného hráče aplikace odmítne a řekne komu patří.
  const ota = page.getByLabel('Google e-mail: Ota')
  await ota.fill('pavel.toman@gmail.com')
  await ota.blur()
  await expect(page.getByRole('alert')).toContainText('Pavel Tomán')

  await ota.fill('ota')
  await ota.blur()
  await expect(page.getByRole('alert')).toContainText('Neplatný e-mail')

  await page.reload()
  await page.waitForSelector('.screen')
  await expect(page.getByLabel('Google e-mail: Pavel Tomán')).toHaveValue(
    'pavel.toman@gmail.com',
  )
  await expect(page.getByLabel('Google e-mail: Ota')).toHaveValue('')
})

test('přihlášený hráč se ukáže svým jménem ze soupisky', async ({ page }) => {
  // Ukázková identita hráče má e-mail Ferryho (p6), admin je Mac (p1).
  await setIdentity(page, 'writer')
  await open(page, '#/admin')
  await expect(page.locator('.account-name')).toHaveText('Ferry')
  await expect(page.locator('.account-name + .hint')).toContainText('Hráč')
  await open(page, '#/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.locator('.menu-drawer')).toContainText('Ferry')
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

test('změna HCP v soupisce se na jedno klepnutí promítne do plánovaných kol', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await open(page, '#/admin')
  await expect(
    page.getByRole('button', { name: 'Promítnout soupisku do plánovaných kol' }),
  ).toHaveCount(0)
  // Soldík dostane index 18,8.
  await page.getByLabel('HCP index').nth(3).fill('18,8')
  await page.getByLabel('HCP index').nth(3).blur()
  await expect(
    page.locator('.notice.info', { hasText: 'plánovaných kol má starší HCP' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Promítnout soupisku do plánovaných kol' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Promítnout soupisku do plánovaných kol' }),
  ).toHaveCount(0)
  await open(page, '#/admin/round/r2')
  await expect(
    page.locator('.table-plain tbody tr').nth(3).locator('input').first(),
  ).toHaveValue('18.8')
  expect(errors()).toEqual([])
})
