import type { EditRecord, TournamentState } from '../model/types'
import { EMPTY_STATE } from '../model/types'
import type { Op } from './ops'
import { applyOp } from './ops'
import type { Listener, Role, Store, StoreMeta } from './store'
import { STORAGE_PREFIX } from './store'
import { SEED_ACCESS, SEED_PLAYERS, SEED_TOURNAMENT, seedRounds } from './seed'

/**
 * Místní úložiště - ukázkový režim a e2e testy.
 *
 * Stav drží `localStorage`; událost `storage` přenáší změny mezi záložkami,
 * takže dvě záložky = dva flighty a třetí = visitor. Přihlášení je falešné:
 * identita se vybírá v menu a určuje roli.
 */

const STATE_KEY = `${STORAGE_PREFIX}state.v1`
const IDENTITY_KEY = `${STORAGE_PREFIX}demoIdentity.v1`
const EDITS_KEY = `${STORAGE_PREFIX}edits.v1`

function readEdits(): (EditRecord & { roundId: string })[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EDITS_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as (EditRecord & { roundId: string })[]) : []
  } catch {
    return []
  }
}

function readState(): TournamentState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return EMPTY_STATE
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_STATE
    const state = parsed as Partial<TournamentState>
    return {
      tournament: state.tournament ?? null,
      players: Array.isArray(state.players) ? state.players : [],
      rounds: Array.isArray(state.rounds) ? state.rounds : [],
      access: state.access ?? null,
    }
  } catch {
    return EMPTY_STATE
  }
}

function writeState(state: TournamentState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* privátní režim - stav zůstane jen v paměti */
  }
}

function readIdentity(): Role {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    return raw === 'admin' || raw === 'writer' || raw === 'visitor' ? raw : 'visitor'
  } catch {
    return 'visitor'
  }
}

export function createLocalStore(options: { seed?: boolean } = {}): Store {
  let state = readState()
  if (options.seed && !state.tournament) {
    state = applyOp(state, {
      kind: 'init',
      tournament: SEED_TOURNAMENT,
      players: SEED_PLAYERS,
      rounds: seedRounds(),
      access: SEED_ACCESS,
    })
    writeState(state)
  }
  let role = readIdentity()
  const listeners = new Set<Listener>()
  let error: string | null = null

  function meta(): StoreMeta {
    const account =
      role === 'visitor'
        ? null
        : {
            uid: `demo-${role}`,
            name: role === 'admin' ? 'Demo admin' : 'Demo zapisovatel',
            email: role === 'admin' ? 'mac.kubecka@gmail.com' : 'demo@example.com',
            anonymous: false,
          }
    return {
      mode: 'local',
      status: 'synced',
      pending: 0,
      error,
      account,
      role,
      authReady: true,
    }
  }

  function notify(): void {
    for (const listener of listeners) listener(state, meta())
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STATE_KEY) {
        state = readState()
        notify()
      }
    })
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      listener(state, meta())
      return () => listeners.delete(listener)
    },
    dispatch(op: Op) {
      if (role === 'visitor') {
        error = 'Bez přihlášení nejde zapisovat.'
        notify()
        return
      }
      if (op.kind === 'setScore') {
        const before = state.rounds.find((r) => r.id === op.roundId)
        const from = before?.scores[op.playerId]?.[String(op.hole)] ?? null
        const edits = readEdits()
        edits.unshift({
          roundId: op.roundId,
          playerId: op.playerId,
          hole: String(op.hole),
          from,
          to: op.value,
          by: `demo-${role}`,
          byEmail: meta().account?.email,
          at: new Date().toISOString(),
          clientAt: new Date().toISOString(),
          appVersion: 'demo',
        })
        try {
          localStorage.setItem(EDITS_KEY, JSON.stringify(edits.slice(0, 500)))
        } catch {
          /* log je jen pohodlí */
        }
      }
      state = applyOp(state, op)
      writeState(state)
      notify()
    },
    prepareSignIn() {},
    async signIn() {
      role = 'admin'
      persistIdentity()
      notify()
    },
    async signInAnonymously() {
      role = 'writer'
      persistIdentity()
      notify()
    },
    async signOut() {
      role = 'visitor'
      persistIdentity()
      notify()
    },
    dismissError() {
      error = null
      notify()
    },
    setDemoIdentity(next) {
      role = next
      persistIdentity()
      notify()
    },
    async loadEdits(roundId, limit = 50) {
      return readEdits()
        .filter((edit) => edit.roundId === roundId)
        .slice(0, limit)
    },
  }

  function persistIdentity() {
    try {
      localStorage.setItem(IDENTITY_KEY, role)
    } catch {
      /* ignore */
    }
  }
}
