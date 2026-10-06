import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, Page, TestInfo } from '@playwright/test'

/**
 * Celý turnajový den proti emulátorům: admin se přihlásí Googlem a založí
 * turnaj, hráč bez Googlu se přihlásí anonymně, admin přidá jeho uid,
 * hráč zapisuje a visitor na třetím telefonu vidí skóre živě.
 */

const PROJECT = 'demo-tc26'
const FIRESTORE = `http://127.0.0.1:8089`
const AUTH = `http://127.0.0.1:9099`
const ADMIN_EMAIL = 'mac.kubecka@gmail.com'

/**
 * Diagnostika pro CI: artefakty z běhu nejsou vždy po ruce, proto se při
 * selhání vypíšou do logu poslední hlášky konzole všech telefonů a text
 * obrazovky. Sbírají se varování, chyby a hlášky Firestoru.
 */
const consoleLines: string[] = []
const pages: { name: string; page: Page }[] = []

function watchConsole(page: Page, name: string): void {
  pages.push({ name, page })
  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'error' ||
      message.type() === 'warning' ||
      /firestore|webchannel|auth/i.test(text)
    ) {
      consoleLines.push(`[${name}] ${message.type()}: ${text.slice(0, 400)}`)
    }
  })
  page.on('pageerror', (error) =>
    consoleLines.push(`[${name}] pageerror: ${error.message}`),
  )
  page.on('requestfailed', (request) =>
    consoleLines.push(
      `[${name}] requestfailed: ${request.url().slice(0, 160)} ${request.failure()?.errorText}`,
    ),
  )
}

test.beforeEach(() => {
  consoleLines.length = 0
  pages.length = 0
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  console.log(`--- konzole (${testInfo.project.name}) ---`)
  for (const line of consoleLines.slice(-120)) console.log(line)
  for (const { name, page } of pages) {
    const text = await page
      .evaluate(() => document.querySelector('#root')?.textContent ?? '(bez #root)')
      .catch(() => '(nečitelné)')
    console.log(`--- obrazovka ${name}: ${page.url()} ---\n${text.slice(0, 1200)}`)
  }
})

async function clearEmulators(request: APIRequestContext): Promise<void> {
  await request.delete(
    `${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
  )
  await request.delete(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`)
}

/** Dokument přímo z emulátoru, mimo cache aplikace (`owner` obchází rules). */
async function readDoc(request: APIRequestContext, path: string): Promise<any> {
  const response = await request.get(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  )
  // Dokument ještě nemusí být na serveru (aplikace zapisuje optimisticky);
  // volající čeká přes expect.poll.
  if (!response.ok()) return null
  return response.json()
}

/** Nový telefon se stejným profilem jako projekt (vlastní úložiště a přihlášení). */
async function newPhone(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, baseURL } =
    testInfo.project.use
  const context = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    locale,
    baseURL,
  })
  return context.newPage()
}

/**
 * Přihlášení Googlem. V CI skutečným popupem emulátoru (stejná cesta jako na
 * telefonu). Popup ale načítá apis.google.com, které vývojový kontejner
 * nedosáhne - tam (bez `CI`) přihlásí účet testovací háček z `firebase.ts`.
 */
async function googleSignIn(page: Page, email: string, name: string): Promise<void> {
  await page.goto('/#/admin')
  const button = page.getByRole('button', { name: 'Přihlásit se Googlem' })
  await expect(button).toBeEnabled({ timeout: 20_000 })
  if (!process.env.CI) {
    await page.evaluate(
      ([e, n]) =>
        (
          window as unknown as {
            __tc26EmulatorGoogleSignIn: (email: string, name: string) => Promise<unknown>
          }
        ).__tc26EmulatorGoogleSignIn(e!, n!),
      [email, name],
    )
    await expect(page.locator('.account-name')).toHaveText(name, { timeout: 20_000 })
    return
  }
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()])
  await popup.waitForLoadState()
  await popup.locator('#add-account-button').click()
  await popup.locator('#email-input').fill(email)
  await popup.locator('#display-name-input').fill(name)
  await popup.locator('#sign-in').click()
  await expect(page.locator('.account-name')).toHaveText(name, { timeout: 20_000 })
}

test('admin založí turnaj, anonymní hráč zapisuje, visitor vidí živě', async ({
  page,
  browser,
  request,
}, testInfo) => {
  await clearEmulators(request)

  // --- Admin: přihlášení Googlem, založení turnaje -------------------------
  const admin = page
  watchConsole(admin, 'admin')
  await googleSignIn(admin, ADMIN_EMAIL, 'Mac')
  await expect(admin.getByText('Administrátor')).toBeVisible()
  await admin.getByRole('button', { name: 'Inicializovat turnaj' }).click()
  await expect(admin.getByRole('button', { name: 'Inicializovat turnaj' })).toHaveCount(
    0,
    {
      timeout: 20_000,
    },
  )

  // Kolo 1: spustit a změnit pozice - skutečně uložené ve Firestoru.
  await admin.goto('/#/admin/round/r1')
  await admin.getByRole('button', { name: 'Živě' }).click()
  await admin.getByLabel('Team A Pozice 1').selectOption('p1')
  await admin.getByLabel('Team A Pozice 4').selectOption('')
  await expect(admin.locator('.notice.error')).toHaveCount(0)
  await expect
    .poll(async () => {
      const doc = await readDoc(request, 'tournaments/tc26/rounds/r1')
      if (!doc) return null
      const values = doc.fields.positions.mapValue.fields.A.arrayValue.values as {
        stringValue: string
      }[]
      return values.map((v) => v.stringValue)
    })
    .toEqual(['p1', 'p3', 'p5', ''])

  // --- Hráč bez Googlu: anonymní přihlášení --------------------------------
  const writer = await newPhone(browser, testInfo)
  watchConsole(writer, 'hráč')
  await writer.goto('/#/admin')
  await writer.getByRole('button', { name: /Nemám Google účet/ }).click()
  const uidText = await writer.locator('.uid').textContent({ timeout: 20_000 })
  const uid = (uidText ?? '').replace(/^.*:\s*/, '').trim()
  expect(uid.length).toBeGreaterThan(10)

  // Bez oprávnění rules zápis odmítnou a hláška řekne, které uid přidat.
  await writer.goto('/#/play/r1/0')
  const writerRows = writer.locator('.player-row')
  await expect(writerRows).toHaveCount(4, { timeout: 20_000 })
  await writerRows.nth(0).locator('.score-value').click()
  const rejection = writer.locator('.notice.error')
  await expect(rejection).toContainText('nemá oprávnění', { timeout: 20_000 })
  await expect(rejection).toContainText(uid)
  await rejection.click()

  // --- Admin přidá uid přesně tak, jak je (velikost písmen) ----------------
  await admin.goto('/#/admin')
  await admin.getByLabel('Přidat e-mail nebo uid').fill(uid)
  await admin.getByRole('button', { name: '+ uid' }).click()
  await expect(admin.locator('.chip', { hasText: uid })).toBeVisible()
  await expect
    .poll(async () => {
      const doc = await readDoc(request, 'tournaments/tc26/private/access')
      if (!doc) return []
      return (doc.fields.writerUids.arrayValue.values ?? []).map(
        (v: { stringValue: string }) => v.stringValue,
      )
    })
    .toContain(uid)

  // --- Visitor na třetím telefonu sleduje kolo -----------------------------
  const visitor = await newPhone(browser, testInfo)
  watchConsole(visitor, 'visitor')
  await visitor.goto('/#/round/r1')
  await visitor.getByRole('button', { name: 'Scorekarta' }).click()
  await expect(visitor.locator('table.scorecard').first()).toBeVisible({
    timeout: 20_000,
  })

  // --- Hráč zapíše jamku, skóre je ve Firestoru i u visitora ---------------
  await writerRows.nth(0).locator('.score-value').click()
  await writerRows.nth(1).locator('.step-button').last().click()
  await expect(writerRows.nth(0).locator('.mark')).toHaveText('4')
  await expect(writer.locator('.notice.error')).toHaveCount(0)

  const firstPlayer = await readFirstFlightPlayer(request)
  await expect
    .poll(async () => {
      const doc = await readDoc(request, 'tournaments/tc26/rounds/r1')
      return doc?.fields.scores.mapValue.fields[firstPlayer]?.mapValue.fields?.['0']
        ?.integerValue
    })
    .toBe('4')
  await expect(visitor.locator('table.scorecard .mark.par').first()).toBeVisible({
    timeout: 20_000,
  })

  // --- Admin vidí zápis v logu úprav ---------------------------------------
  await admin.goto('/#/admin/round/r1')
  await admin.getByRole('button', { name: 'Načíst' }).click()
  await expect(admin.locator('table.edits-log tr').first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(admin.locator('table.edits-log')).toContainText('→ 4')
})

async function readFirstFlightPlayer(request: APIRequestContext): Promise<string> {
  const doc = await readDoc(request, 'tournaments/tc26/rounds/r1')
  const flight = doc.fields.flights.arrayValue.values[0].mapValue.fields
  return flight.players.arrayValue.values[0].stringValue as string
}

test('zápis bez signálu čeká ve frontě a po návratu signálu se odešle', async ({
  page,
  request,
}) => {
  await clearEmulators(request)
  const admin = page
  watchConsole(admin, 'admin')
  await googleSignIn(admin, ADMIN_EMAIL, 'Mac')
  await admin.getByRole('button', { name: 'Inicializovat turnaj' }).click()
  await expect
    .poll(async () => Boolean(await readDoc(request, 'tournaments/tc26/rounds/r1')))
    .toBe(true)
  await admin.goto('/#/admin/round/r1')
  await admin.getByRole('button', { name: 'Živě' }).click()
  await expect
    .poll(async () => {
      const doc = await readDoc(request, 'tournaments/tc26/rounds/r1')
      return doc?.fields.status.stringValue
    })
    .toBe('live')

  // Admin zapisuje sám (smí všechno); obrazovka je načtená, pak vypadne signál.
  await admin.goto('/#/play/r1/0')
  const rows = admin.locator('.player-row')
  await expect(rows).toHaveCount(4, { timeout: 20_000 })
  const firstPlayer = await readFirstFlightPlayer(request)
  await admin.context().setOffline(true)

  await rows.nth(0).locator('.step-button').last().click()
  await expect(rows.nth(0).locator('.mark')).toHaveText('5')
  // Zápis se nečeká: obrazovka ho ukazuje hned a hlásí neodeslaný stav.
  await expect(admin.locator('.tag', { hasText: /neodeslan/ })).toBeVisible()
  await admin.waitForTimeout(1500)
  const offlineDoc = await readDoc(request, 'tournaments/tc26/rounds/r1')
  expect(
    offlineDoc.fields.scores.mapValue.fields[firstPlayer]?.mapValue.fields?.['0'],
  ).toBeUndefined()

  // Další jamka jde zapisovat i bez signálu.
  for (let i = 1; i < 4; i += 1) await rows.nth(i).locator('.score-value').click()
  await admin
    .getByRole('button', { name: /Další jamka/ })
    .last()
    .click()
  await expect(admin.locator('.hole-info')).toContainText('Jamka 2 z 18')

  await admin.context().setOffline(false)
  await expect
    .poll(
      async () => {
        const doc = await readDoc(request, 'tournaments/tc26/rounds/r1')
        return doc?.fields.scores.mapValue.fields[firstPlayer]?.mapValue.fields?.['0']
          ?.integerValue
      },
      { timeout: 45_000 },
    )
    .toBe('5')
  await expect(admin.locator('.tag', { hasText: /neodeslan/ })).toHaveCount(0, {
    timeout: 30_000,
  })
  await expect(admin.locator('.notice.error')).toHaveCount(0)
})
