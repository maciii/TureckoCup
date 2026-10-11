import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { collectErrors, expectNoHorizontalOverflow, open, dismissAwards } from './helpers'

/**
 * Testovací verze (`?demo=4dny`): vymyšlený turnaj po čtyřech dnech. Každé
 * kolo má jiné hry, tak se tu projde každá varianta nastavení - výsledky,
 * zápis do rozehraného kola, změna hry adminem, nové losování a oddělení od
 * ukázkového režimu.
 */

const IDENTITY_KEY = 'tc26.preview.demoIdentity.v1'

const DAYS: { round: string; games: string[]; team: boolean }[] = [
  {
    round: 'r1',
    games: [
      'Stableford',
      'Skins ve flightu',
      'Team Skins',
      'Singly pozic netto',
      'Extra body',
    ],
    team: true,
  },
  {
    round: 'r2',
    games: [
      'Stableford brutto',
      'Skins všech osm',
      'Skins přední devítka',
      'Team Skins bez přenosu',
      'Singly pozic jamkovkou',
    ],
    team: true,
  },
  {
    round: 'r3',
    games: [
      'Stableford 90 %',
      'Skins bez přenosu 90 %',
      'Four-ball dvojic',
      'Singly pozic na body',
    ],
    team: true,
  },
  {
    round: 'r4',
    games: [
      'Stableford',
      'Skins brutto všech osm',
      'Team Skins zadní devítka',
      'Singly pozic brutto',
      'Extra body',
    ],
    team: true,
  },
]

async function openPreview(page: Page, hash = '#/'): Promise<void> {
  await page.goto(`/?demo=4dny${hash}`)
  await page.waitForSelector('.screen')
  await dismissAwards(page)
}

async function setPreviewIdentity(
  page: Page,
  role: 'admin' | 'writer' | 'visitor',
): Promise<void> {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key!, value!),
    [IDENTITY_KEY, role],
  )
  await page.reload()
  await page.waitForSelector('.screen')
  await dismissAwards(page)
}

async function teamScore(page: Page): Promise<string> {
  await expect(page.locator('.score-hero .pill').first()).toBeVisible()
  return (await page.locator('.content > .score-hero .pill').allTextContents()).join(':')
}

test.beforeEach(async ({ page }) => {
  await openPreview(page)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.screen')
})

test('přehled ukazuje stav po čtyřech dnech a je označený jako test', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await expect(page.getByTestId('preview-notice')).toBeVisible()
  await expect(page.locator('.app-header .preview-tag')).toHaveText('Test')
  const rows = page.locator('.list > button.row')
  await expect(rows).toHaveCount(5)
  for (let i = 0; i < 3; i += 1) await expect(rows.nth(i)).toContainText('Dohráno')
  await expect(rows.nth(3)).toContainText('Živě')
  await expect(rows.nth(4)).toContainText('Plánované')
  // Body kola mají dohraná a živé kolo, plánované ne.
  for (let i = 0; i < 4; i += 1) await expect(rows.nth(i).locator('.pill')).toHaveCount(2)
  await expect(rows.nth(4).locator('.pill')).toHaveCount(0)

  const [a, b] = (await teamScore(page)).split(':').map(Number)
  expect(a! + b!).toBeGreaterThan(0)
  await expect(page.getByText('Odehráno 3 z 5 kol')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Jednotlivci v turnaji' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Singly pozic', exact: true }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})

for (const day of DAYS) {
  test(`kolo ${day.round}: vlastní sada her s výsledky`, async ({ page }) => {
    const errors = collectErrors(page)
    await openPreview(page, `#/round/${day.round}`)
    const titles = page.locator('section .section-head h2')
    await expect(titles.first()).toBeVisible()
    const shown = await titles.allTextContents()
    for (const name of day.games) expect(shown).toContain(name)
    // Každá hra něco ukazuje: pořadí, skóre týmů nebo duely.
    for (const name of day.games) {
      const section = page.locator('section', {
        has: page.getByRole('heading', { name, exact: true }),
      })
      await expect(
        section.locator('.list li, .score-hero, .duel').first(),
        name,
      ).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Scorekarta' }).click()
    await expect(page.locator('table.scorecard').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(errors()).toEqual([])
  })
}

test('třetí kolo: druhý flight začíná na desítce a four-ball má dva zápasy', async ({
  page,
}) => {
  await openPreview(page, '#/round/r3')
  const fourBall = page.locator('section', {
    has: page.getByRole('heading', { name: 'Four-ball dvojic' }),
  })
  await expect(fourBall.locator('.duel')).toHaveCount(2)
  await expect(fourBall.locator('.duel').first()).toContainText(' + ')
  await setPreviewIdentity(page, 'writer')
  await openPreview(page, '#/play/r3/1')
  // Dohrané kolo: flight začal na desítce, takže osmnáctá odehraná je devítka.
  await expect(page.locator('.hole-info')).toContainText('Jamka 18 z 18')
  await expect(page.locator('.hole-nav [aria-label="Jamka 9"]')).toBeVisible()
})

test('zapisovatel dohraje rozehrané čtvrté kolo', async ({ page }) => {
  const errors = collectErrors(page)
  await setPreviewIdentity(page, 'writer')
  await openPreview(page, '#/round/r4')
  const duels = page.locator('section', {
    has: page.getByRole('heading', { name: 'Singly pozic brutto' }),
  })
  await expect(duels.locator('.section-note')).toContainText('čeká na zápis')

  await openPreview(page, '#/play/r4/1')
  // Flight je na patnácté jamce, první dvojice ji už zapsala.
  await expect(page.locator('.hole-info')).toContainText('Jamka 15 z 18')
  const rows = page.locator('.player-row')
  await expect(rows).toHaveCount(4)
  // Dvojice týmu A patnáctku zapsala, tým B ještě ne (řádky nesou barvu týmu).
  const teamA = page.locator('.player-row.team-a')
  const teamB = page.locator('.player-row.team-b')
  await expect(teamA).toHaveCount(2)
  await expect(teamB).toHaveCount(2)
  await expect(teamA.first().locator('.mark')).not.toHaveText('–')
  await expect(teamB.first().locator('.mark')).toHaveText('–')
  await teamB.nth(0).locator('.score-value').click()
  await teamB.nth(1).locator('.score-value').click()
  for (const hole of [16, 17, 18]) {
    await page
      .getByRole('button', { name: /Další jamka/ })
      .last()
      .click()
    await expect(page.locator('.hole-info')).toContainText(`Jamka ${hole} z 18`)
    for (let i = 0; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  }

  await openPreview(page, '#/round/r4')
  await expect(duels.locator('.section-note')).not.toContainText('čeká na zápis')
  await expect(duels.locator('.duel')).toHaveCount(4)
  await expect(duels.locator('.duel .m', { hasText: 'Dohráno' })).toHaveCount(4)
  expect(errors()).toEqual([])
})

test('admin změní hru, výsledky se přepočítají a nové losování vrátí čistá data', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const before = await teamScore(page)
  await setPreviewIdentity(page, 'admin')

  await openPreview(page, '#/admin/round/r1')
  // Název a rozsah jamek hry jsou vidět a dají se měnit.
  const names = page.getByLabel('Název hry')
  await expect(names.nth(1)).toHaveValue('Skins ve flightu')
  await names.nth(1).fill('Skins jen přední')
  await page.getByLabel('Do jamky').nth(1).selectOption({ label: '9' })
  // Team Skins přestanou počítat do týmového skóre.
  const teamSkins = page.locator('.game-card').nth(2)
  await teamSkins.getByRole('switch', { name: 'Počítá se do týmového skóre' }).click()
  await expectNoHorizontalOverflow(page)

  await openPreview(page, '#/round/r1')
  const skins = page.locator('section', {
    has: page.getByRole('heading', { name: 'Skins jen přední' }),
  })
  await expect(skins.locator('.section-note')).toContainText('jamky 1–9')
  await openPreview(page)
  expect(await teamScore(page)).not.toBe(before)

  // Nové losování zahodí změny a vymyslí jiná čísla.
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Vylosovat nová data' }).click()
  await openPreview(page, '#/round/r1')
  await expect(page.getByRole('heading', { name: 'Skins ve flightu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Skins jen přední' })).toHaveCount(0)
  expect(errors()).toEqual([])
})

test('testovací verze a ukázkový režim mají oddělená data', async ({ page }) => {
  await setPreviewIdentity(page, 'admin')
  // Ukázkový režim: prázdný turnaj, nic z testovací verze.
  await open(page)
  await expect(page.getByTestId('preview-notice')).toHaveCount(0)
  await expect(page.locator('.app-header .preview-tag')).toHaveCount(0)
  await expect(page.locator('.list > button.row').first()).toContainText('Plánované')
  await expect(page.locator('.list > button.row .pill')).toHaveCount(0)

  // Menu vede do testovací verze a zpátky.
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('link', { name: /Testovací verze/ }).click()
  await expect(page).toHaveURL(/\?demo=4dny/)
  await expect(page.getByTestId('preview-notice')).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()
  const back = page.getByRole('link', { name: 'Ostrý turnaj', exact: true })
  await expect(back).toHaveAttribute('href', '/')
})

test('obrazovky testovací verze se vejdou na displej', async ({ page }) => {
  const errors = collectErrors(page)
  await setPreviewIdentity(page, 'admin')
  for (const hash of [
    '#/round/r5',
    '#/play/r4/0',
    '#/play/r4/1',
    '#/admin',
    '#/admin/round/r2',
    '#/admin/round/r3',
    '#/admin/round/r4',
  ]) {
    await openPreview(page, hash)
    await expectNoHorizontalOverflow(page)
  }
  expect(errors()).toEqual([])
})

test('jména v zápisu se vejdou i s body za jamku', async ({ page }) => {
  await setPreviewIdentity(page, 'writer')
  // Dohraný flight: u každého hráče svítí body poslední jamky.
  await openPreview(page, '#/play/r4/0')
  await expect(page.locator('.player-total .player-mark').first()).toBeVisible()
  const names = await page.locator('.player-name-text').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent ?? '',
      clipped: node.scrollWidth > node.clientWidth + 1,
    })),
  )
  expect(names).toHaveLength(4)
  for (const name of names)
    expect(name.clipped, `oříznuté jméno ${name.text}`).toBe(false)
})

test('Best + Součet: karta dvojic v zápisu ukazuje Best, Součet a body', async ({
  page,
}) => {
  await openPreview(page, '#/play/r3/0')
  await setPreviewIdentity(page, 'admin')
  const card = page.locator('.pair-status')
  await expect(card).toBeVisible()
  await expect(card.locator('.pair-status-name')).toContainText('Best + Součet')
  await expect(card.locator('.pair-card')).toHaveCount(2)
  await expect(card.locator('.chip', { hasText: 'Best' }).first()).toBeVisible()
  await expect(card.locator('.chip', { hasText: 'Součet' }).first()).toBeVisible()
  await expect(card.locator('.chip.total').first()).toContainText('b.')
  await expect(card.locator('.pair-status-score')).toContainText('b.')
  // Řádky hráčů jdou podle dvojic ze hry: partneři pod sebou, stejně jako karta.
  const pairNames = await card.locator('.pair-name').allInnerTexts()
  const expected = pairNames.flatMap((text) =>
    text
      .replace(/^[AB]\s*/, '')
      .split(' + ')
      .map((name) => name.trim()),
  )
  const rowNames = await page.locator('.player-row .player-name-text').allInnerTexts()
  expect(rowNames.map((name) => name.trim())).toEqual(expected)
})

test('zápis singlů pozic: soupeři pod sebou se stavem zápasu a barvou týmu', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await setPreviewIdentity(page, 'writer')
  await openPreview(page, '#/play/r1/0')
  const groups = page.locator('.match-group')
  await expect(groups).toHaveCount(2)
  // Hlavička: tým A vlevo, stav uprostřed, tým B vpravo; řádky nesou barvu týmu.
  const first = groups.first()
  await expect(first.locator('.match-side.left .team-badge')).toHaveText('A')
  await expect(first.locator('.match-side.right .team-badge')).toHaveText('B')
  await expect(first.locator('.match-pill')).not.toBeEmpty()
  await expect(first.locator('.match-hole')).not.toBeEmpty()
  await expect(first.locator('.player-row.team-a')).toHaveCount(1)
  await expect(first.locator('.player-row.team-b')).toHaveCount(1)
  // Stav her nahoře duely neopakuje.
  await expect(page.locator('.hole-status-row dt', { hasText: 'Singly' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})
