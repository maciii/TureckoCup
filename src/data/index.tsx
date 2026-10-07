import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TournamentState } from '../model/types'
import { EMPTY_STATE } from '../model/types'
import { isFirebaseConfigured } from './firebase'
import { createFireStore } from './fireStore'
import { createLocalStore } from './localStore'
import type { DemoVariant, Store, StoreMeta } from './store'

/**
 * Výběr datové vrstvy:
 *   - vývoj (`import.meta.env.DEV`) nebo `?demo=1`  -> místní ukázkový režim
 *   - `?demo=4dny`                                 -> testovací verze (vymyšlené 4 dny)
 *   - produkční build s konfigurací Firebase      -> Firestore
 *   - produkční build bez konfigurace             -> blokující hláška
 * Produkce bez konfigurace **nikdy** tiše nespadne na localStorage: hráči by
 * zapisovali každý do svého telefonu a mysleli si, že je to sdílené.
 */

export type DataMode = 'local' | 'firestore' | 'unconfigured'

export function resolveDataMode(): DataMode {
  const demo =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('demo')
  if (demo || import.meta.env.DEV)
    return isFirebaseConfigured() && !demo ? 'firestore' : 'local'
  return isFirebaseConfigured() ? 'firestore' : 'unconfigured'
}

/** Hodnota `?demo=`, která otevře testovací verzi místo prázdného ukázkového turnaje. */
export const PREVIEW_PARAM = '4dny'

export function demoVariant(): DemoVariant {
  if (typeof window === 'undefined') return 'demo'
  return new URLSearchParams(window.location.search).get('demo') === PREVIEW_PARAM
    ? 'preview'
    : 'demo'
}

/** Adresa testovací verze, nebo (`null`) ostrého turnaje - plné načtení stránky. */
export function variantHref(variant: DemoVariant | null): string {
  const base = import.meta.env.BASE_URL
  return variant === 'preview' ? `${base}?demo=${PREVIEW_PARAM}` : base
}

export const TOURNAMENT_ID = import.meta.env.VITE_TOURNAMENT_ID || 'tc26'

const DEFAULT_META: StoreMeta = {
  mode: 'local',
  status: 'loading',
  pending: 0,
  error: null,
  account: null,
  role: 'visitor',
  authReady: false,
}

interface DataValue {
  state: TournamentState
  meta: StoreMeta
  store: Store
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({
  children,
  store,
}: {
  children: ReactNode
  store?: Store
}) {
  const instance = useMemo(
    () =>
      store ??
      (resolveDataMode() === 'firestore'
        ? createFireStore(TOURNAMENT_ID)
        : createLocalStore({ seed: true, variant: demoVariant() })),
    [store],
  )
  const [snapshot, setSnapshot] = useState<{ state: TournamentState; meta: StoreMeta }>({
    state: EMPTY_STATE,
    meta: DEFAULT_META,
  })

  useEffect(
    () => instance.subscribe((state, meta) => setSnapshot({ state, meta })),
    [instance],
  )

  const value = useMemo(
    () => ({ state: snapshot.state, meta: snapshot.meta, store: instance }),
    [snapshot, instance],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData se dá volat jen uvnitř DataProvider')
  return value
}
