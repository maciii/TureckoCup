import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Message } from './plural'
import { selectPlural } from './plural'
import { cs } from './cs'

/**
 * Překlady.
 *
 * Převzato z Golfgames, zjednodušeno na jediný jazyk: turnaj hraje osm Čechů,
 * druhý katalog by stál čas a nikdo by ho neotevřel. Infrastruktura (klíče,
 * dosazení proměnných, množná čísla přes `Intl.PluralRules`) zůstává, takže
 * další jazyk je jen nový katalog vedle `cs.ts`.
 *
 * Texty patří sem, ne do komponent - jeden katalog je jediné místo, kde se
 * hledá znění hlášky.
 */

export type Locale = 'cs'

const LOCALE_TAG = 'cs-CZ'

const CATALOG: Record<string, Message> = cs

/** Klíče se odvozují z českého katalogu. */
export type MessageKey = keyof typeof cs

export type Params = Record<string, string | number>

/** Značka pro `Intl` - formát datumů a řazení jmen. */
export function localeTag(): string {
  return LOCALE_TAG
}

/** Dosadí `{proměnné}` do textu. */
function fill(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Přeloží klíč. Když text chybí, vrátí samotný klíč - v aplikaci se tak nikdy
 * neobjeví prázdné místo a chybějící text je vidět.
 */
export function t(key: MessageKey, params?: Params): string {
  const message = CATALOG[key]
  if (message === undefined) return key
  if (typeof message === 'string') return fill(message, params)

  // Množné číslo se řídí parametrem `count`.
  const count = Number(params?.count ?? 0)
  return fill(selectPlural(message, count, LOCALE_TAG), params)
}

/**
 * Klíč složený za běhu z id (hry, odpaliště, kategorie výsledku). TypeScript
 * takový klíč neověří, hlídá to test v `i18n.test.ts`.
 */
export function dynamicKey(...parts: string[]): MessageKey {
  return parts.join('.') as MessageKey
}

/** Překlad katalogového názvu odpaliště; vlastní názvy zůstávají. */
export function localizedTeeName(id: string, fallback: string): string {
  const key = dynamicKey('tee', id)
  return key in CATALOG ? t(key) : fallback
}

type Translate = (key: MessageKey, params?: Params) => string

const LocaleContext = createContext<Translate>(t)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const translate = useCallback<Translate>((key, params) => t(key, params), [])
  const value = useMemo(() => translate, [translate])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** Zkratka pro komponenty. */
export function useT(): Translate {
  return useContext(LocaleContext)
}
