import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  collectErrors,
  expectNoHorizontalOverflow,
  open,
  playerRow,
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

/** Flight 1 kola 1: Ota (A1), Mac (A2), Pavlos (B1), Ferry (B2); flight 2: Jarin, Vrbič, Soldík, Honza. */
async function enterPar(page: Page, names: string[]) {
  for (const name of names) await playerRow(page, name).locator('.score-value').click()
}

test('zvednutá jamka ve hře na rány podle pravidla turnaje', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  // Singly pozic na brutto rány, ať je počet ran vidět přímo.
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
  await playerRow(page, 'Ota').locator('.pickup-button').click()
  await enterPar(page, ['Pavlos'])

  await open(page, '#/round/r1')
  const duel = page
    .locator('section', { has: page.getByRole('heading', { name: 'Singly pozic' }) })
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

test('four-ball: dvojice plynou z flightů, u hry se nenastavují', async ({ page }) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  // U flightů je vidět, kdo s kým hraje: dva hráči téhož týmu.
  const pairs = page.locator('.flight-pairs')
  await expect(pairs).toHaveCount(2)
  await expect(pairs.first()).toContainText('Ota + Mac')
  await expect(pairs.first()).toContainText('Pavlos + Ferry')
  await page.getByRole('button', { name: '+ Přidat hru' }).click()
  const card = page.locator('.game-card').nth(4)
  await expect(card.getByLabel('Hry kola')).toHaveValue('team-match')
  await expect(card).toContainText(
    'Zápasy podle flightů: Flight 1: Ota + Mac – Pavlos + Ferry',
  )
  await expect(card.getByLabel(/Zápas/)).toHaveCount(0)
  await expect(
    card.getByRole('switch', { name: 'Počítá se do týmového skóre' }),
  ).toHaveAttribute('aria-checked', 'true')
  await expectNoHorizontalOverflow(page)

  await open(page, '#/round/r1')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Four-ball' }),
  })
  await expect(section.locator('.duel')).toHaveCount(2)
  await expect(section.locator('.duel').first()).toContainText('Ota + Mac')
  await expect(section.locator('.section-note')).toContainText('Jamkovka')

  // Přesun hráče mezi flighty změní dvojice; flight se třemi hráči týmu zápas nemá.
  await open(page, '#/admin/round/r1')
  const flight1 = page.locator('.chip-row').first()
  await flight1.getByRole('button', { name: 'Jarin' }).click()
  await expect(page.locator('.hint.warn').first()).toContainText('3 hráče týmu A')
  await flight1.getByRole('button', { name: 'Mac' }).click()
  await expect(pairs.first()).toContainText('Ota + Jarin')
  await open(page, '#/round/r1')
  await expect(section.locator('.duel').first()).toContainText('Ota + Jarin')
  expect(errors()).toEqual([])
})

test('extra body: centrální nastavení, zápis u jamky, scorekarta a výsledky', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  // Extra body se nastavují jednou pro celý turnaj v Pravidlech turnaje.
  await open(page, '#/admin')
  await expect(page.getByLabel('Nearest')).toHaveValue('1')
  await expect(page.getByLabel('Sandie')).toHaveValue('1')
  await expect(page.getByLabel('Birdie', { exact: true })).toHaveValue('0')
  await page.getByLabel('Nearest').fill('2')
  await expect(
    page.getByRole('switch', { name: 'Nearest platí jen při paru a lepším' }),
  ).toHaveAttribute('aria-checked', 'true')
  // V nastavení kola žádná hra Extra body není - jsou obecné.
  await open(page, '#/admin/round/r1')
  await expect(page.locator('.game-card')).toHaveCount(4)
  await expectNoHorizontalOverflow(page)

  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const mac = playerRow(page, 'Mac')
  const pavlos = playerRow(page, 'Pavlos')
  // Jamka 1 (par 4): hvězdička nabízí všech šest ručních bonusů - Longest
  // i Nearest jdou zaškrtnout na kterékoli jamce, kde se hrají, rozhodne flight.
  await mac.getByRole('button', { name: 'Extra body: Mac' }).click()
  const sheet = page.getByRole('dialog', { name: 'Extra body' })
  await expect(sheet.locator('.bonus-option')).toHaveCount(6)
  await expect(sheet.getByRole('button', { name: /Longest/ })).toHaveCount(1)
  await expect(sheet.getByRole('button', { name: /Nearest/ })).toHaveCount(1)
  await sheet.getByRole('button', { name: 'Zavřít' }).click()
  await enterPar(page, ['Ota', 'Mac', 'Pavlos', 'Ferry'])
  // Stav her na jamce: po zápisu všech čtyř je Stableford i duel rozhodnutý.
  const stabRow = page.locator('.hole-status-row', { hasText: 'Stableford' })
  await expect(stabRow).not.toContainText('–')
  // Singly pozic jsou rozkreslené po duelech: hlavička zápasu zná výsledek jamky.
  await expect(page.locator('.match-group .match-hole').first()).not.toContainText(
    'čeká na zápis',
  )
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await enterPar(page, ['Ota', 'Mac', 'Pavlos', 'Ferry'])
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await expect(page.locator('.hole-info')).toContainText('Jamka 3 z 18')

  // Jamka 3 (par 3): Mac birdie (2) + nearest (za 2 body) + sandie (×2 při birdie).
  await mac.locator('.score-value').click()
  await mac.locator('.step-button').first().click()
  await expect(mac.locator('.mark')).toHaveText('2')
  await pavlos.locator('.score-value').click()
  await mac.getByRole('button', { name: 'Extra body: Mac' }).click()
  await expect(sheet).toContainText('Mac · jamka 3')
  await expect(sheet.locator('.bonus-option')).toHaveCount(6)
  await expect(sheet.getByRole('button', { name: /Nearest/ })).toContainText('+2')
  await sheet.getByRole('button', { name: /Nearest/ }).click()
  await sheet.getByRole('button', { name: /Sandie/ }).click()
  await expect(sheet.getByRole('button', { name: /Nearest/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Přepnutí na Pavlose v panelu: nearest přebere, Macovi zmizí.
  await sheet.getByRole('button', { name: /^Pavlos/ }).click()
  await sheet.getByRole('button', { name: /Nearest/ }).click()
  await sheet.getByRole('button', { name: 'Zavřít' }).click()
  await expect(mac.locator('.bonus-marks')).toHaveText('S')
  await expect(pavlos.locator('.bonus-marks')).toHaveText('N')
  // Záhlaví jamky: co hry spočítaly tady a průběžný stav, včetně extra bodů.
  const status = page.locator('.hole-status')
  await expect(status).toContainText('Extra body')
  await expect(status).toContainText('Mac S+2')
  await expect(status).toContainText('Pavlos N+2')
  await expect(status).toContainText('Stableford')

  // Scorekarta ukazuje značku u rány a sloupec Extra se součtem bodů.
  await page.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(page.locator('.scorecard .cell-marks', { hasText: 'N' })).toHaveCount(1)
  await expect(page.locator('.scorecard .cell-marks', { hasText: 'S' })).toHaveCount(1)
  const extra = page.locator('.scorecard td.bonus-sum')
  await expect(extra).toHaveCount(4)
  await expect(extra.nth(1)).toHaveText('2')
  await expect(extra.nth(2)).toHaveText('2')
  await expectNoHorizontalOverflow(page)
  await page.locator('.sheet').getByRole('button', { name: 'Zavřít' }).click()

  await open(page, '#/round/r1')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Extra body' }),
  })
  const row = (name: string) => section.locator('li.row', { hasText: name })
  // Mac: sandie při birdie ×2 = 2; Pavel: nearest za 2; Ota nic.
  await expect(row('Mac').locator('.pill')).toHaveText('2')
  await expect(row('Mac').locator('.row-meta')).toContainText('Sandie')
  await expect(row('Pavel').locator('.pill')).toHaveText('2')
  await expect(row('Pavel').locator('.row-meta')).toContainText('Nearest')
  await expect(row('Ota').locator('.pill')).toHaveText('0')
  expect(errors()).toEqual([])
})

test('Four-ball Skins: double v kartě zápasu, přenos dvou skinů a výsledek kola', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  await page.getByRole('button', { name: '+ Přidat hru' }).click()
  const card = page.locator('.game-card').nth(4)
  await card.getByLabel('Hry kola').selectOption('four-ball-skins')
  await expect(card).toContainText('Zápasy podle flightů')
  await expect(card.getByRole('switch', { name: 'Přenos banku' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // Kdo smí dublovat: výchozí prohrávající, pro test kdokoli.
  await expect(
    card.getByRole('button', { name: 'Prohrávající', pressed: true }),
  ).toHaveCount(1)
  await card.getByRole('button', { name: 'Kdokoli' }).click()
  await card.getByRole('switch', { name: 'Bod navíc za každé birdie' }).click()
  await expect(card).toContainText('birdie a lepší')
  await expectNoHorizontalOverflow(page)

  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const match = page.locator('.skins-match')
  await expect(match).toContainText('Four-ball Skins')
  await expect(match).toContainText('ve hře 1 skin')
  // Double první dvojice: jamka za dva skiny.
  await match.getByRole('button', { name: 'Double' }).first().click()
  await expect(match).toContainText('Double: Ota + Mac')
  await expect(match).toContainText('ve hře 2 skiny')
  // Všichni par: dělená, dva skiny do banku; na druhé jamce se hraje o tři.
  await enterPar(page, ['Ota', 'Mac', 'Pavlos', 'Ferry'])
  await expect(match).toContainText('dělená · v banku 2')
  await page
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await expect(match).toContainText('ve hře 3 skiny')
  // Mac birdie: Ota + Mac berou tři.
  const mac = playerRow(page, 'Mac')
  await mac.locator('.score-value').click()
  await mac.locator('.step-button').first().click()
  await enterPar(page, ['Ota', 'Pavlos', 'Ferry'])
  await expect(match).toContainText('Ota + Mac bere 3')
  // Macovo birdie: bod navíc, skóre zápasu 4 : 0.
  await expect(match).toContainText('Birdie +1')
  await expect(match.locator('.pair-status-score')).toContainText('4')
  await expectNoHorizontalOverflow(page)

  // Druhý flight vidí stav prvního zápasu výrazně v kartě nad zápisem.
  await open(page, '#/play/r1/1')
  const otherCard = page.locator('.other-flight-card')
  await expect(otherCard).toContainText('Flight 1 · 3. jamka')
  // Zápas dvojic je první; pod ním singly pozic, které flight 1 hraje.
  const pairDuel = otherCard.locator('.duel', { hasText: 'Ota + Mac' })
  await expect(pairDuel).toHaveCount(1)
  await expect(pairDuel.locator('.duel-center')).toContainText('4 : 0')
  await expect(otherCard.locator('.duel')).toHaveCount(3)
  await expectNoHorizontalOverflow(page)
  // Karta zápasu druhého flightu čte jen svůj zápas: první jamku flightu 1
  // (dělenou) nesmí ukázat jako „bere 0“ u flightu 2.
  const second = page.locator('.skins-match')
  await expect(second).toContainText('ve hře 1 skin')
  await enterPar(page, ['Jarin', 'Vrbič', 'Soldík', 'Honza'])
  await playerRow(page, 'Jarin').locator('.step-button').last().click()
  await playerRow(page, 'Vrbič').locator('.step-button').last().click()
  await expect(second).toContainText('Soldík + Honza bere 1')

  await open(page, '#/round/r1')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Four-ball Skins' }),
  })
  await expect(section.locator('.duel')).toHaveCount(2)
  await expect(section.locator('.duel').first()).toContainText('4 : 0')
  expect(errors()).toEqual([])
})

test('singl jamkovkou: dormie v hlavičce zápasu, když náskok = zbývající jamky', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  await open(page, '#/admin/round/r1')
  // Singly pozic jamkovkou na brutto rány, ať o jamkách rozhodují jen zapsané rány.
  const card = page.locator('.game-card').nth(3)
  await card.getByRole('button', { name: 'Jamkovka' }).click()
  const net = card.getByRole('switch', { name: 'Netto' })
  if ((await net.getAttribute('aria-checked')) === 'true') await net.click()

  await setIdentity(page, 'writer')
  await open(page, '#/play/r1/0')
  const ota = playerRow(page, 'Ota')
  // 16 jamek: Ota birdie na prvních dvou, jinak všichni par -> Ota 2 UP, zbývají 2.
  for (let hole = 1; hole <= 16; hole += 1) {
    await enterPar(page, ['Ota', 'Mac', 'Pavlos', 'Ferry'])
    if (hole <= 2) await ota.locator('.step-button').first().click()
    await page
      .getByRole('button', { name: /Další jamka/ })
      .last()
      .click()
    await expect(page.locator('.hole-info')).toContainText(`Jamka ${hole + 1} z 18`)
  }
  const match = page.locator('.match-group', { hasText: 'Pavlos' }).first()
  await expect(match.locator('.match-pill')).toContainText('Ota 2 UP · dormie')
  await expect(match.locator('.match-pill')).toHaveClass(/dormie/)
  await expect(match.locator('.match-hole')).toContainText('dormie · zbývají 2 jamky')
  // Druhý zápas je vyrovnaný - bez dormie.
  const other = page.locator('.match-group', { hasText: 'Ferry' }).first()
  await expect(other.locator('.match-pill')).not.toContainText('dormie')
  expect(errors()).toEqual([])
})
