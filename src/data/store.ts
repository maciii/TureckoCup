import type { EditRecord, TournamentState } from '../model/types'
import type { Op } from './ops'

/**
 * Rozhraní datové vrstvy. Dvě implementace:
 *   - `localStore`  localStorage, ukázkový režim a e2e testy
 *   - `fireStore`   Firestore + Google přihlášení (produkce)
 * Obrazovky i evaluace pracují jen se `TournamentState` a `Op`, o adapteru
 * nic nevědí.
 */

export type StoreMode = 'local' | 'firestore'

export type SyncStatus = 'loading' | 'synced' | 'offline' | 'error'

export interface Account {
  uid: string
  /** Jméno z Google účtu; obrazovky ukazují raději jméno hráče (`playerId`). */
  name: string
  email: string
  /** Hráč soupisky přiřazený k e-mailu, `null` u admina, který nehraje. */
  playerId: string | null
}

export type Role = 'admin' | 'writer' | 'visitor'

export interface StoreMeta {
  mode: StoreMode
  status: SyncStatus
  /** Zápisy čekající na odeslání do cloudu. */
  pending: number
  /** Poslední chyba (odmítnutý zápis, výpadek) - zůstává, dokud ji UI nezavře. */
  error: string | null
  account: Account | null
  /** Role podle e-mailu v `private/access`; `writer` = hráč. */
  role: Role
  /** Je SDK připravené otevřít přihlašovací okno? */
  authReady: boolean
}

export type Listener = (state: TournamentState, meta: StoreMeta) => void

export interface Store {
  subscribe(listener: Listener): () => void
  /** Nikdy nečeká na síť - zápis se projeví hned a odejde, až jde. */
  dispatch(op: Op): void
  prepareSignIn(): void
  signIn(): Promise<void>
  signOut(): Promise<void>
  dismissError(): void
  /** Ukázkový režim: přepnutí identity (admin / zapisovatel / visitor). */
  setDemoIdentity?(role: Role): void
  /** Log úprav kola, nejnovější první. */
  loadEdits(roundId: string, limit?: number): Promise<EditRecord[]>
}

export const STORAGE_PREFIX = 'tc26.'
