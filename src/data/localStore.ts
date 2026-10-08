import type { EditRecord, TournamentState } from '../model/types'
import { EMPTY_STATE } from '../model/types'
import { t } from '../i18n'
import type { Op } from './ops'
import { applyOp, checkOp, opProblemMessage, opToWrites } from './ops'
import type { DemoVariant, Listener, Role, Store, StoreMeta } from './store'
import { STORAGE_PREFIX } from './store'
import {
  BOOTSTRAP_ADMIN_EMAIL,
  SEED_ACCESS,
  SEED_PLAYERS,
  SEED_TOURNAMENT,
  seedRounds,
} from './seed'
import { decodeAccess, playerIdByEmail } from '../model/access'
import { PREVIEW_SEED, previewState } from './preview'

const DEMO_WRITER_EMAIL = 'bezdekf@gmail.com'

/**
 * Místní úložiště - ukázkový režim a e2e testy.
 *
 * Stav drží `localStorage`; událost `storage` přenáší změny mezi záložkami,
 * takže dvě záložky = dva flighty a třetí = visitor. Přihlášení je falešné:
 * identita se vybírá v menu a určuje roli.
 *
 * Testovací verze (`preview`) má vlastní klíče, aby se nepletla s ukázkovým
 * režimem ani s e2e testy, které s ním počítají.
 */

interface Keys {
  state: string
  identity: string
  edits: string
  /** Předpona jamek, které si pamatuje zápis (`PlayScreen`). */
  playHole: string
}

function keysOf(variant: DemoVariant): Keys {
  const prefix = variant === 'preview' ? `${STORAGE_PREFIX}preview.` : STORAGE_PREFIX
  return {
    state: `${prefix}state.v1`,
    identity: `${prefix}demoIdentity.v1`,
    edits: `${prefix}edits.v1`,
    playHole: `${prefix}playHole.`,
  }
}

// Na stránce běží jediný místní store; klíče mu nastaví `createLocalStore`.
let keys = keysOf('demo')

function readEdits(): (EditRecord & { roundId: string })[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keys.edits) ?? '[]')
    return Array.isArray(parsed) ? (parsed as (EditRecord & { roundId: string })[]) : []
  } catch {
    return []
  }
}

function readState(): TournamentState {
  try {
    const raw = localStorage.getItem(keys.state)
    if (!raw) return EMPTY_STATE
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_STATE
    const state = parsed as Partial<TournamentState>
    return {
      tournament: state.tournament ?? null,
      players: Array.isArray(state.players) ? state.players : [],
      rounds: Array.isArray(state.rounds) ? state.rounds : [],
      access: readAccess(state.access),
    }
  } catch {
    return EMPTY_STATE
  }
}

/**
 * Oprávnění z dřívější verze ukázkového režimu (writerEmails, bez e-mailů
 * hráčů) se převedou na nový tvar a doplní e-maily ze seedu, aby ukázkové
 * identity dál odpovídaly hráčům.
 */
function readAccess(value: unknown): TournamentState['access'] {
  if (!value) return null
  const access = decodeAccess(value)
  return Object.keys(access.playerEmails).length > 0
    ? access
    : { ...access, playerEmails: { ...SEED_ACCESS.playerEmails } }
}

function writeState(state: TournamentState): void {
  try {
    localStorage.setItem(keys.state, JSON.stringify(state))
  } catch {
    /* privátní režim - stav zůstane jen v paměti */
  }
}

function readIdentity(): Role {
  try {
    const raw = localStorage.getItem(keys.identity)
    return raw === 'admin' || raw === 'writer' || raw === 'visitor' ? raw : 'visitor'
  } catch {
    return 'visitor'
  }
}

function seedState(variant: DemoVariant, previewSeed: number): TournamentState {
  return applyOp(
    EMPTY_STATE,
    variant === 'preview'
      ? { kind: 'init', ...previewState(previewSeed) }
      : {
          kind: 'init',
          tournament: SEED_TOURNAMENT,
          players: SEED_PLAYERS,
          rounds: seedRounds(),
          access: SEED_ACCESS,
        },
  )
}

export function createLocalStore(
  options: { seed?: boolean; variant?: DemoVariant } = {},
): Store {
  const variant = options.variant ?? 'demo'
  keys = keysOf(variant)
  let state = readState()
  if ((options.seed || variant === 'preview') && !state.tournament) {
    state = seedState(variant, PREVIEW_SEED)
    writeState(state)
  }
  let role = readIdentity()
  const listeners = new Set<Listener>()
  let error: string | null = null

  function meta(): StoreMeta {
    // Ukázkové identity odpovídají seedu: admin je Mac (p1), hráč je Ferry (p6).
    const email = role === 'admin' ? BOOTSTRAP_ADMIN_EMAIL : DEMO_WRITER_EMAIL
    const account =
      role === 'visitor'
        ? null
        : {
            uid: `demo-${role}`,
            name: t(role === 'admin' ? 'admin.demoAdminName' : 'admin.demoWriterName'),
            email,
            emailVerified: true,
            playerId: playerIdByEmail(state.access, email),
          }
    return {
      mode: 'local',
      status: 'synced',
      pending: 0,
      error,
      account,
      role,
      authReady: true,
      demo: variant,
    }
  }

  function notify(): void {
    for (const listener of listeners) listener(state, meta())
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === keys.state) {
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
      // Stejná kontrola jako Firestore adapter (role jako rules, data jako
      // Firestore), aby ukázkový režim a e2e nepřijaly, co produkce odmítne.
      const problem = checkOp(
        op,
        role,
        opToWrites(
          op,
          { uid: `demo-${role}`, clientAt: new Date().toISOString(), appVersion: 'demo' },
          state,
        ),
      )
      if (problem) {
        error = opProblemMessage(problem)
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
          localStorage.setItem(keys.edits, JSON.stringify(edits.slice(0, 500)))
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
    resetDemo() {
      // Testovací verze vylosuje nová data, ukázkový režim se vrátí na seed.
      state = seedState(variant, Math.floor(Math.random() * 2 ** 31))
      writeState(state)
      try {
        localStorage.removeItem(keys.edits)
        // Zapamatované jamky zápisu patří ke starým datům.
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(keys.playHole)) localStorage.removeItem(key)
        }
      } catch {
        /* ignore */
      }
      error = null
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
      localStorage.setItem(keys.identity, role)
    } catch {
      /* ignore */
    }
  }
}
