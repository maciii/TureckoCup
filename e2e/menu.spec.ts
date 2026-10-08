import { expect, test } from '@playwright/test'
import { collectErrors, open, resetDemo, setIdentity, startRound } from './helpers'

/**
 * Menu podle role: nepřihlášený má přihlášení nahoře a nevidí Admin, hráč
 * vidí své jméno a odhlášení, admin položku Admin. Zápis bez přihlášení
 * nabídne tlačítko přihlášení v hlášce.
 */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

const menuItem = (page: import('@playwright/test').Page, label: string) =>
  page.locator('nav .menu-item', { hasText: label })

test('nepřihlášený se přihlásí z menu, hráč nevidí Admin a odhlásí se', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await open(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  const signIn = page.locator('.menu-signin').getByRole('button', {
    name: 'Přihlásit se Googlem',
  })
  await expect(signIn).toBeEnabled()
  await expect(page.locator('.menu-id .sub')).toHaveText('Jen prohlížení')
  await expect(menuItem(page, 'Admin')).toHaveCount(0)
  await expect(
    page.locator('nav').getByRole('button', { name: 'Odhlásit se' }),
  ).toHaveCount(0)

  await signIn.click()
  await expect(page.locator('nav.menu-drawer')).toHaveCount(0)
  await page.getByRole('button', { name: 'Menu' }).click()
  // Ukázkový zapisovatel má e-mail Ferryho - menu ukáže jméno ze soupisky.
  await expect(page.locator('.menu-id .sub')).toHaveText('Ferry · Hráč')
  await expect(page.locator('.menu-signin')).toHaveCount(0)
  await expect(menuItem(page, 'Admin')).toHaveCount(0)
  await page.locator('nav').getByRole('button', { name: 'Odhlásit se' }).click()
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.locator('.menu-id .sub')).toHaveText('Jen prohlížení')
  expect(errors()).toEqual([])
})

test('admin vidí v menu položku Admin a obrazovka má podle role název', async ({
  page,
}) => {
  await setIdentity(page, 'admin')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.locator('.menu-id .sub')).toContainText('Administrátor')
  await menuItem(page, 'Admin').click()
  await expect(page).toHaveURL(/#\/admin$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible()

  await setIdentity(page, 'writer')
  await open(page, '#/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Účet' })).toBeVisible()
})

test('zápis bez přihlášení nabídne přihlášení v hlášce', async ({ page }) => {
  await startRound(page)
  await setIdentity(page, 'visitor')
  await open(page, '#/play/r1/0')
  const notice = page.locator('.notice.signin')
  await expect(notice).toContainText('přihlas')
  await expect(page.locator('.player-row .step-button').first()).toBeDisabled()
  await notice.getByRole('button', { name: 'Přihlásit se Googlem' }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.locator('.player-row .step-button').first()).toBeEnabled()
})
