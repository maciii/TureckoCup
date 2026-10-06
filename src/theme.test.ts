import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEMES, THEME_COLOR, THEME_STORAGE_KEY } from './theme'

/**
 * Barevné schéma se nastavuje na dvou místech: skriptem v `index.html` ještě
 * před vykreslením (jinak by světlému uživateli probliklo tmavé pozadí) a pak
 * znovu Reactem. Ta dvě místa nic nesváže, takže se hlídají testem - rozejít
 * se smí zápis kódu, ne klíč v localStorage, jména schémat ani barva lišty.
 *
 * Podklad `--bg` a barva lišty musí být tatáž barva: kdyby se rozešly, visí
 * nad appkou proužek cizího odstínu.
 */
const indexHtml = readFileSync('index.html', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

/** Hodnota proměnné z bloku, kterým začíná stylopis, nebo z bloku schématu. */
function background(selector: string): string {
  const block = styles.slice(styles.indexOf(selector))
  const found = block.slice(0, block.indexOf('}')).match(/--bg:\s*(#[0-9a-f]+)/)
  expect(found?.[1], `--bg chybí v ${selector}`).toBeDefined()
  return found![1]!
}

describe('barevné schéma', () => {
  it('úvodní skript čte stejný klíč jako aplikace', () => {
    expect(indexHtml).toContain(THEME_STORAGE_KEY)
  })

  it('úvodní skript zná obě schémata', () => {
    for (const theme of THEMES) {
      expect(indexHtml, theme).toMatch(new RegExp(`['"]${theme}['"]`))
    }
  })

  it('úvodní skript nastavuje stejné barvy lišty', () => {
    for (const theme of THEMES) {
      expect(indexHtml, theme).toContain(THEME_COLOR[theme])
    }
  })

  it('barva lišty sedí s podkladem obou schémat', () => {
    expect(background(':root {')).toBe(THEME_COLOR.dark)
    expect(background(":root[data-theme='light'] {")).toBe(THEME_COLOR.light)
  })
})
