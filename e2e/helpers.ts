import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Společné kroky e2e testů v ukázkovém režimu (`?demo=1`, data v localStorage).
 */

export const IDENTITY_KEY = 'tc26.demoIdentity.v1'

export async function open(page: Page, hash = '#/'): Promise<void> {
  await page.goto(`/?demo=1${hash}`)
  await page.waitForSelector('.screen')
}

export async function setIdentity(
  page: Page,
  role: 'admin' | 'writer' | 'visitor',
): Promise<void> {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key!, value!),
    [IDENTITY_KEY, role],
  )
  await page.reload()
  await page.waitForSelector('.screen')
}

/**
 * Čistý start: prázdné úložiště, ukázková data se založí znovu. Stejná adresa
 * s hashem je navigace v rámci dokumentu bez načtení, proto `reload()`.
 */
export async function resetDemo(page: Page): Promise<void> {
  await open(page)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.screen')
}

/** Stránka nesmí vodorovně přetékat - na telefonu by se celá posouvala do strany. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth - root.clientWidth
  })
  expect(overflow, 'vodorovné přetečení v px').toBeLessThanOrEqual(0)
}

/**
 * Sbírá chyby stránky (výjimky a `console.error`). Volá se na začátku testu,
 * kontroluje na konci - aplikace nesmí v žádném prohlížeči padat do konzole.
 */
export function collectErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Vite dev server a service worker v dev režimu nejsou chyby aplikace.
    if (/\[vite\]|service worker|sw\.js|favicon/i.test(text)) return
    errors.push(`console: ${text}`)
  })
  return () => errors
}

/** Spustí kolo jako admin (stav Živě), identitu nechá na adminovi. */
export async function startRound(page: Page, roundId = 'r1'): Promise<void> {
  await setIdentity(page, 'admin')
  await open(page, `#/admin/round/${roundId}`)
  await page.getByRole('button', { name: 'Živě' }).click()
  await expect(page.getByRole('button', { name: 'Živě' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}
