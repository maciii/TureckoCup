import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Barevné schéma aplikace.
 *
 * Tmavé je původní vzhled a zůstává výchozí; světlé je pro hru za ostrého
 * slunce, kdy se tmavý podklad na displeji čte hůř. Kdo si nic nezvolil,
 * dostane schéma podle nastavení telefonu - stejně jako u jazyka, kde se
 * bere jazyk prohlížeče.
 *
 * Schéma nese atribut `data-theme` na `<html>`, ne React: CSS proměnné se tak
 * přepnou naráz pro celou appku včetně úvodní obrazovky, která se vykreslí
 * dřív, než se React vůbec načte (skript v `index.html`).
 */
export type Theme = 'dark' | 'light'

export const THEMES: Theme[] = ['dark', 'light']

/** Klíč zná i skript v `index.html`. Shodu obou míst hlídá `theme.test.ts`. */
export const THEME_STORAGE_KEY = 'tureckocup.theme.v1'

/**
 * Barva, kterou si prohlížeč obarví lištu nad appkou. Musí sedět s `--bg`
 * daného schématu, jinak nad appkou visí proužek cizí barvy.
 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#0f1c14',
  light: '#eef2ea',
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

/**
 * Zvolené schéma: uložená volba, jinak nastavení systému, jinak tmavé.
 *
 * Systém se čte jen při startu. Živé sledování `prefers-color-scheme` by
 * appce přepnulo vzhled uprostřed kola, když telefon sám přepne na noční
 * režim - a to je při zápisu skóre spíš překvapení než služba.
 */
export function detectTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(stored)) return stored
  } catch {
    /* privátní režim - spadneme na nastavení systému */
  }

  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {
    /* starý prohlížeč bez matchMedia */
  }
  return 'dark'
}

/** Promítne schéma do dokumentu. Skript v `index.html` dělá totéž před startem. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
}

interface ThemeValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(detectTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* volba se prostě nezapamatuje */
    }
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme se dá volat jen uvnitř ThemeProvider')
  return value
}
