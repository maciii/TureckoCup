import { expect, test } from '@playwright/test'
import { collectErrors, open, resetDemo, setIdentity, startRound } from './helpers'

/** Ovládání zápisu jamky - to, co se na hřišti dělá stokrát za kolo. */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
  await startRound(page)
  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
})

test('zvednutí, mínus, přidržení a přechod na další jamku', async ({ page }) => {
  const errors = collectErrors(page)
  const rows = page.locator('.player-row')
  const first = rows.nth(0)

  // Zvednutí přes × a zpět.
  await first.locator('.pickup-button').click()
  await expect(first.locator('.pickup-button')).toHaveClass(/active/)
  await expect(first.locator('.mark')).toHaveText('×')
  await first.locator('.pickup-button').click()
  await expect(first.locator('.mark')).toHaveText('–')

  // Mínus z prázdné jamky = par − 1 (birdie), nikdy pod jednu ránu.
  await first.locator('.step-button').first().click()
  await expect(first.locator('.mark')).toHaveText('3')
  for (let i = 0; i < 4; i += 1) await first.locator('.step-button').first().click()
  await expect(first.locator('.mark')).toHaveText('1')

  // Přidržení čísla zápis smaže.
  const value = first.locator('.score-value')
  await value.dispatchEvent('pointerdown')
  await page.waitForTimeout(900)
  await value.dispatchEvent('pointerup')
  await expect(first.locator('.mark')).toHaveText('–')

  // Celý flight zapsaný -> další jamka.
  for (let i = 0; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await expect(page.locator('.hole-info')).toContainText('Jamka 2 z 18')
  await expect(rows.nth(0).locator('.mark')).toHaveText('–')

  // Zpět na první jamku, zápis tam zůstal.
  await page.getByRole('button', { name: 'Předchozí jamka' }).click()
  await expect(page.locator('.hole-info')).toContainText('Jamka 1 z 18')
  await expect(rows.nth(0).locator('.mark')).not.toHaveText('–')
  expect(errors()).toEqual([])
})

test('tlačítka zápisu jsou dost velká na prst a jména se vejdou', async ({ page }) => {
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('.player-row button')].map((button) => {
      const box = button.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }),
  )
  expect(sizes.length).toBeGreaterThan(0)
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(38)
    expect(size.height).toBeGreaterThanOrEqual(38)
  }
  // Přezdívky hráčů se musí vejít celé, i na 320px displeji.
  const names = await page.locator('.player-name-text').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent ?? '',
      clipped: node.scrollWidth > node.clientWidth + 1,
      width: node.getBoundingClientRect().width,
    })),
  )
  for (const name of names)
    expect(name.clipped, `oříznuté jméno ${name.text}`).toBe(false)
})

test('zápis přežije obnovení stránky', async ({ page }) => {
  const rows = page.locator('.player-row')
  await rows.nth(0).locator('.step-button').last().click()
  await expect(rows.nth(0).locator('.mark')).toHaveText('5')
  await page.reload()
  await page.waitForSelector('.player-row')
  await expect(page.locator('.player-row').nth(0).locator('.mark')).toHaveText('5')
})

test('na poslední jamce je místo Další jamka tlačítko Ukončit hru na vyhodnocení', async ({
  page,
}) => {
  // Zapisovatel skočí na uloženou jamku flightu: 18. jamka (index 17).
  await page.evaluate(() => localStorage.setItem('tc26.playHole.v1:r1:0', '17'))
  // Stejná adresa by jen přepnula hash bez načtení - uložená jamka se čte při startu.
  await page.reload()
  await page.waitForSelector('.player-row')
  await expect(page.locator('.hole-info')).toContainText('Jamka 18 z 18')
  // Šipka u čísla jamky zůstává (neaktivní), v patičce je místo ní Ukončit hru.
  const footer = page.locator('.footer-row')
  await expect(footer.getByRole('button', { name: /Další jamka/ })).toHaveCount(0)
  const finish = footer.getByRole('button', { name: /Ukončit hru/ })
  await expect(finish).toBeEnabled()
  const rows = page.locator('.player-row')
  for (let i = 0; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  await expect(finish).toHaveClass(/primary/)
  await finish.click()
  await expect(page).toHaveURL(/#\/round\/r1$/)
  await expect(page.getByRole('heading', { level: 1, name: /Kolo 1/ })).toBeVisible()
})

test('scorekarta v zápisu ukazuje zapsané rány', async ({ page }) => {
  const rows = page.locator('.player-row')
  await rows.nth(0).locator('.score-value').click()
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(page.locator('table.scorecard').first()).toBeVisible()
  await expect(page.locator('table.scorecard .mark.par').first()).toBeVisible()
})

test('uzavřené kolo zapisovatel nezmění', async ({ page }) => {
  await setIdentity(page, 'admin')
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: 'Dohráno' }).click()
  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  await expect(page.locator('.notice').first()).toContainText('uzavřené')
  await expect(page.locator('.player-row .step-button').first()).toBeDisabled()
})
