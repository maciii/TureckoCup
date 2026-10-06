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
 * Každá obrazovka na každém telefonu: nic nepřetéká do strany a aplikace
 * nehlásí chyby do konzole. Úzký Android (320 px) a malý iPhone SE jsou
 * nejčastější zdroj rozbitého layoutu.
 */

const PUBLIC = ['#/', '#/round/r1', '#/round/r5']
const WRITER = ['#/play/r1/0', '#/play/r1/1']
const ADMIN = ['#/admin', '#/admin/round/r1', '#/admin/round/r3']

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

test('veřejné obrazovky', async ({ page }) => {
  const errors = collectErrors(page)
  for (const hash of PUBLIC) {
    await open(page, hash)
    await expectNoHorizontalOverflow(page)
  }
  await open(page, '#/round/r1')
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})

test('zápis obou flightů', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await setIdentity(page, 'writer')
  for (const hash of WRITER) {
    await open(page, hash)
    await expect(page.locator('.player-row')).toHaveCount(4)
    await expectNoHorizontalOverflow(page)
    // Hlavička jamky a patička s tlačítky jsou vidět bez rolování.
    await expect(page.locator('.hole-info')).toBeInViewport()
    await expect(page.locator('.app-footer')).toBeInViewport()
  }
  expect(errors()).toEqual([])
})

test('administrace', async ({ page }) => {
  const errors = collectErrors(page)
  await setIdentity(page, 'admin')
  for (const hash of ADMIN) {
    await open(page, hash)
    await expectNoHorizontalOverflow(page)
  }
  expect(errors()).toEqual([])
})

test('menu se otevře a zavře', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.locator('.menu-drawer')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Zavřít' }).click()
  await expect(page.locator('.menu-drawer')).toHaveCount(0)
})
