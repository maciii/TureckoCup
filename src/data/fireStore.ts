import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import type {
  Access,
  Player,
  Tournament,
  TournamentRound,
  TournamentState,
} from '../model/types'
import { EMPTY_STATE } from '../model/types'
import { APP_VERSION } from '../version'
import {
  describeSignInError,
  isAuthReady,
  preloadAuth,
  signInAnonymous,
  signInWithGoogle,
  signOutAccount,
  watchAccount,
} from './auth'
import { loadFirebase } from './firebase'
import type { Op, Write } from './ops'
import { DELETE_FIELD, SERVER_TIME, applyOp, opToWrites, requiresAdmin } from './ops'
import { BOOTSTRAP_ADMIN_EMAIL } from './seed'
import type { Account, Listener, Role, Store, StoreMeta, SyncStatus } from './store'

/**
 * Firestore adapter.
 *
 *   tournaments/{tid}                turnaj
 *   tournaments/{tid}/private/access oprávnění (čte jen admin)
 *   tournaments/{tid}/players/{pid}  hráči
 *   tournaments/{tid}/rounds/{rid}   kola včetně skóre
 *   tournaments/{tid}/rounds/{rid}/edits/{auto}  log úprav
 *
 * Zápisy se **neawaitují**: offline promise nedoběhne, dokud se nevrátí
 * signál. Stav „čeká na odeslání" dává `hasPendingWrites` ze snímku kola
 * a pozdní odmítnutí (rules) se zachytí z promise a ukáže jako chyba.
 */

type FirestoreModule = typeof import('firebase/firestore')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Hrubá kontrola tvaru - poškozený dokument se zahodí, místo aby shodil UI. */
export function decodeRound(data: unknown): TournamentRound | null {
  if (!isRecord(data)) return null
  if (typeof data.id !== 'string' || !isRecord(data.course)) return null
  if (!Array.isArray(data.playerIds) || !Array.isArray(data.flights)) return null
  const course = data.course
  if (!Array.isArray(course.pars) || !Array.isArray(course.tees)) return null
  const scores = isRecord(data.scores) ? data.scores : {}
  const cleanScores: TournamentRound['scores'] = {}
  for (const [playerId, holes] of Object.entries(scores)) {
    if (!isRecord(holes)) continue
    cleanScores[playerId] = Object.fromEntries(
      Object.entries(holes).filter(([, v]) => typeof v === 'number'),
    ) as Record<string, number>
  }
  return {
    ...(data as unknown as TournamentRound),
    scores: cleanScores,
    bonuses: isRecord(data.bonuses) ? (data.bonuses as TournamentRound['bonuses']) : {},
    playerTees: isRecord(data.playerTees)
      ? (data.playerTees as Record<string, string>)
      : {},
    playerIndex: isRecord(data.playerIndex)
      ? (data.playerIndex as Record<string, number | null>)
      : {},
    courseHandicapOverride: isRecord(data.courseHandicapOverride)
      ? (data.courseHandicapOverride as Record<string, number>)
      : {},
    games: Array.isArray(data.games) ? (data.games as TournamentRound['games']) : [],
    positions: isRecord(data.positions)
      ? (data.positions as TournamentRound['positions'])
      : { A: [], B: [] },
  }
}

export function decodePlayer(data: unknown): Player | null {
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.name !== 'string')
    return null
  return data as unknown as Player
}

export function decodeTournament(data: unknown): Tournament | null {
  if (!isRecord(data) || typeof data.name !== 'string') return null
  return data as unknown as Tournament
}

/** Nahradí sentinely z `ops.ts` za FieldValue. */
function materialize(
  module: FirestoreModule,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === DELETE_FIELD) out[key] = module.deleteField()
    else if (value === SERVER_TIME) out[key] = module.serverTimestamp()
    else if (isRecord(value)) out[key] = materialize(module, value)
    else out[key] = value
  }
  return out
}

export function createFireStore(tournamentId: string): Store {
  let state: TournamentState = EMPTY_STATE
  let status: SyncStatus = 'loading'
  let pendingWrites = 0
  let error: string | null = null
  let account: Account | null = null
  let role: Role = 'visitor'
  let authReady = false
  let accessUnsub: (() => void) | null = null
  const listeners = new Set<Listener>()

  function meta(): StoreMeta {
    return {
      mode: 'firestore',
      status,
      pending: pendingWrites,
      error,
      account,
      role,
      authReady,
    }
  }

  function notify(): void {
    for (const listener of listeners) listener(state, meta())
  }

  function fail(message: string): void {
    error = message
    notify()
  }

  const started = (async () => {
    const { db } = await loadFirebase()
    const module = await import('firebase/firestore')
    const root = module.doc(db, 'tournaments', tournamentId)

    module.onSnapshot(
      root,
      { includeMetadataChanges: true },
      (snapshot) => {
        state = {
          ...state,
          tournament: snapshot.exists() ? decodeTournament(snapshot.data()) : null,
        }
        status = snapshot.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced'
        notify()
      },
      (err) => fail(`Turnaj se nepodařilo načíst: ${err.message}`),
    )

    module.onSnapshot(
      module.collection(root, 'players'),
      (snapshot) => {
        state = {
          ...state,
          players: snapshot.docs
            .map((entry) => decodePlayer(entry.data()))
            .filter((p): p is Player => p !== null)
            .sort((a, b) => a.order - b.order),
        }
        notify()
      },
      (err) => fail(`Hráče se nepodařilo načíst: ${err.message}`),
    )

    module.onSnapshot(
      module.collection(root, 'rounds'),
      { includeMetadataChanges: true },
      (snapshot) => {
        pendingWrites = snapshot.docs.filter(
          (entry) => entry.metadata.hasPendingWrites,
        ).length
        state = {
          ...state,
          rounds: snapshot.docs
            .map((entry) => decodeRound(entry.data()))
            .filter((r): r is TournamentRound => r !== null)
            .sort((a, b) => a.number - b.number),
        }
        notify()
      },
      (err) => fail(`Kola se nepodařilo načíst: ${err.message}`),
    )

    window.addEventListener('online', () => {
      status = 'synced'
      notify()
    })
    window.addEventListener('offline', () => {
      status = 'offline'
      notify()
    })

    await watchAccount((next) => {
      account = next
      updateRole(db, module)
    })
    authReady = isAuthReady()
    notify()
  })().catch((err: unknown) => {
    status = 'error'
    fail(err instanceof Error ? err.message : String(err))
  })

  /**
   * Role: admin se pozná tím, že smí číst `private/access`; ostatní přihlášení
   * jsou kandidáti na zapisovatele - ověří je až první zápis.
   */
  function updateRole(db: Firestore, module: FirestoreModule): void {
    accessUnsub?.()
    accessUnsub = null
    state = { ...state, access: null }
    if (!account) {
      role = 'visitor'
      notify()
      return
    }
    role = 'writer'
    notify()
    const accessRef = module.doc(db, 'tournaments', tournamentId, 'private', 'access')
    const bootstrap = account.email === BOOTSTRAP_ADMIN_EMAIL
    accessUnsub = module.onSnapshot(
      accessRef,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Access) : null
        state = { ...state, access: data }
        role = 'admin'
        notify()
      },
      () => {
        // Čtení odmítnuto = není admin. Bootstrap admin ještě nemusí mít dokument.
        role = bootstrap ? 'admin' : 'writer'
        notify()
      },
    )
  }

  function docRef(
    module: FirestoreModule,
    db: Firestore,
    write: Write,
  ): DocumentReference<DocumentData> {
    const root = module.doc(db, 'tournaments', tournamentId)
    if (write.path.length === 0) return root
    if (write.autoId) {
      const collection = module.collection(root, write.path[0]!, ...write.path.slice(1))
      return module.doc(collection)
    }
    return module.doc(root, write.path[0]!, ...write.path.slice(1))
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      listener(state, meta())
      return () => listeners.delete(listener)
    },
    dispatch(op: Op) {
      if (!account) {
        fail('Pro zápis se nejdřív přihlas.')
        return
      }
      if (requiresAdmin(op) && role !== 'admin') {
        fail('Tuhle změnu smí udělat jen administrátor.')
        return
      }
      const writes = opToWrites(
        op,
        {
          uid: account.uid,
          ...(account.email ? { email: account.email } : {}),
          clientAt: new Date().toISOString(),
          appVersion: APP_VERSION,
        },
        state,
      )
      // Optimistická odezva: snímek z cache dorazí vzápětí a stav přepíše.
      state = applyOp(state, op)
      notify()

      void started.then(async () => {
        const { db } = await loadFirebase()
        const module = await import('firebase/firestore')
        const batch = module.writeBatch(db)
        for (const write of writes) {
          const ref = docRef(module, db, write)
          const data = materialize(module, write.data)
          if (write.mode === 'update') batch.update(ref, data)
          else if (write.mode === 'setMerge') batch.set(ref, data, { merge: true })
          else batch.set(ref, data)
        }
        // Záměrně bez await v UI: offline by promise nikdy nedoběhl.
        batch.commit().catch((err: unknown) => {
          const code =
            typeof err === 'object' && err && 'code' in err
              ? String((err as { code: unknown }).code)
              : ''
          const reason =
            code === 'permission-denied'
              ? 'chybí oprávnění'
              : err instanceof Error
                ? err.message
                : String(err)
          const what =
            op.kind === 'setScore'
              ? `Zápis jamky ${op.hole + 1} (${op.playerId})`
              : 'Změna'
          fail(`${what} byl odmítnut: ${reason}`)
        })
      })
    },
    prepareSignIn() {
      void preloadAuth()
        .then(() => {
          authReady = true
          notify()
        })
        .catch(() => undefined)
    },
    async signIn() {
      try {
        await signInWithGoogle()
      } catch (err) {
        const kind = describeSignInError(err)
        if (kind === 'cancelled') return
        if (kind === 'notReady') {
          fail('Přihlášení se ještě připravuje, zkus to za chvíli.')
          return
        }
        fail(
          kind === 'network'
            ? 'Bez připojení – přihlášení potřebuje signál.'
            : kind === 'popup'
              ? 'Prohlížeč zablokoval okno. Zkus to v nainstalované aplikaci.'
              : 'Přihlášení se nepovedlo.',
        )
      }
    },
    async signInAnonymously() {
      try {
        await signInAnonymous()
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Anonymní přihlášení se nepovedlo.')
      }
    },
    async signOut() {
      await signOutAccount()
    },
    dismissError() {
      error = null
      notify()
    },
  }
}
