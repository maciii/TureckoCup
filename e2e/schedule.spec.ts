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
 * Program kola (odjezd, tee time) na úvodní obrazovce a náhled druhého
 * flightu při zápisu s návratem zpět na vlastní flight.
 */

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

test('úvodní obrazovka ukazuje odjezd a tee time nejbližšího kola', async ({ page }) => {
  const errors = collectErrors(page)
  // Den před turnajem: nejbližší je první kolo s časy ze seedu.
  await page.clock.setFixedTime(new Date('2026-10-07T18:00:00'))
  await page.reload()
  await page.waitForSelector('.screen')
  const schedule = page.locator('section.schedule')
  await expect(schedule.locator('.eyebrow')).toContainText('Další kolo')
  await expect(schedule).toContainText('Kolo 1')
  const rows = schedule.locator('li.row')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('14:45')
  await expect(rows.nth(0)).toContainText('Odjezd na hřiště')
  await expect(rows.nth(1)).toContainText('15:50')
  await expect(rows.nth(1)).toContainText('Flight 1')
  await expect(rows.nth(1).locator('.row-meta')).toContainText('Mac')
  await expect(rows.nth(2)).toContainText('16:00')
  await expect(rows.nth(2)).toContainText('Flight 2')
  // Seznam kol ukazuje tee time u kola, které se teprve hraje.
  await expect(page.locator('.list > button.row').first()).toContainText('15:50')
  await expectNoHorizontalOverflow(page)

  await schedule.locator('.schedule-title').click()
  await expect(page).toHaveURL(/#\/round\/r1$/)
  expect(errors()).toEqual([])
})

test('po odehraném dni ukáže úvodní obrazovka další kolo i bez zadaných časů', async ({
  page,
}) => {
  const errors = collectErrors(page)
  // Den po prvním kole: kolo 1 je pryč, kolo 2 ještě nemá program.
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00'))
  await page.reload()
  await page.waitForSelector('.screen')
  const schedule = page.locator('section.schedule')
  await expect(schedule.locator('.eyebrow')).toContainText('Dnes')
  await expect(schedule).toContainText('Kolo 2')
  await expect(schedule).toContainText('ještě nejsou zadané')
  await expect(schedule.locator('li.row')).toHaveCount(2)
  await expect(schedule.locator('li.row').first()).toContainText('–')
  await expectNoHorizontalOverflow(page)
  expect(errors()).toEqual([])
})

test('admin zadá program kola, druhý flight dostane čas o 10 minut později', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await startRound(page, 'r2')
  await open(page, '#/admin/round/r2')
  // Píše se jako na telefonu: s dvojtečkou i bez ní, uloží se po Enteru.
  await page.getByLabel('Odjezd na hřiště').fill('7.30')
  await page.getByLabel('Odjezd na hřiště').press('Enter')
  await expect(page.getByLabel('Odjezd na hřiště')).toHaveValue('07:30')
  await page.getByLabel('Tee time flightu 1').fill('0840')
  await page.getByLabel('Tee time flightu 1').press('Enter')
  await expect(page.getByLabel('Tee time flightu 2')).toHaveValue('08:50')
  // Vlastní čas druhého flightu se už nepřepisuje.
  await page.getByLabel('Tee time flightu 2').fill('09:00')
  await page.getByLabel('Tee time flightu 2').press('Enter')
  await page.getByLabel('Tee time flightu 1').fill('08:45')
  await page.getByLabel('Tee time flightu 1').press('Enter')
  await expect(page.getByLabel('Tee time flightu 2')).toHaveValue('09:00')
  // Nesmysl se neuloží, pole se vrátí na uložený čas.
  await page.getByLabel('Tee time flightu 1').fill('25:99')
  await page.getByLabel('Tee time flightu 1').press('Enter')
  await expect(page.getByLabel('Tee time flightu 1')).toHaveValue('08:45')
  await expectNoHorizontalOverflow(page)

  await open(page)
  const schedule = page.locator('section.schedule')
  await expect(schedule.locator('.eyebrow')).toContainText('Právě se hraje')
  await expect(schedule).toContainText('Kolo 2')
  await expect(schedule).toContainText('07:30')
  await expect(schedule).toContainText('08:45')
  await expect(schedule).toContainText('09:00')

  // Zápis nabízí flighty i s tee time.
  await open(page, '#/play/r2')
  await expect(page.locator('.option-title').first()).toHaveText('Flight 1 · 08:45')
  expect(errors()).toEqual([])
})

test('zapisovatel nahlédne na druhý flight a vrátí se ke svému', async ({
  page,
  context,
}) => {
  const errors = collectErrors(page)
  await startRound(page)
  await setIdentity(page, 'writer')

  // Druhý flight zapíše první jamku na jiném telefonu.
  const second = await context.newPage()
  await open(second, '#/play/r1/1')
  const secondRows = second.locator('.player-row')
  for (let i = 0; i < 4; i += 1) await secondRows.nth(i).locator('.score-value').click()
  await secondRows.nth(0).locator('.step-button').last().click()
  await second.close()

  await open(page, '#/play/r1/0')
  const rows = page.locator('.player-row')
  await rows.nth(0).locator('.score-value').click()
  const other = page.getByRole('button', { name: /Flight 2/ })
  await expect(other).toContainText('2. jamka')
  await other.click()

  const sheet = page.getByRole('dialog', { name: 'Flight 2' })
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('li.row')).toHaveCount(4)
  await expect(sheet).toContainText('1 jamka')
  await expect(sheet).toContainText('+1')
  await expectNoHorizontalOverflow(page)

  await sheet.getByRole('button', { name: 'Zpět na flight 1' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(/#\/play\/r1\/0$/)
  await expect(page.locator('.hole-info')).toContainText('Jamka 1 z 18')
  await expect(rows.nth(0).locator('.mark')).toHaveText('4')

  // Čtyři hráči se pořád vejdou na displej bez rolování.
  const fits = await page.evaluate(() => {
    const content = document.querySelector('.content')
    return content ? content.scrollHeight <= content.clientHeight + 1 : false
  })
  expect(fits).toBe(true)
  expect(errors()).toEqual([])
})
