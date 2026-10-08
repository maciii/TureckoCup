import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import type {
  EditRecord,
  Player,
  Tournament,
  TournamentRound,
  TournamentState,
} from '../model/types'
import { EMPTY_STATE } from '../model/types'
import { decodeAccess, resolveIdentity } from '../model/access'
import { t } from '../i18n'
import { APP_VERSION } from '../version'
import {
  codeOf,
  describeSignInError,
  isAuthReady,
  preloadAuth,
  signInWithGoogle,
  signOutAccount,
  watchAccount,
} from './auth'
import { loadFirebase } from './firebase'
import type { Op, Write } from './ops'
import {
  DELETE_FIELD,
  SERVER_TIME,
  applyOp,
  checkOp,
  isCellOp,
  opProblemMessage,
  opToWrites,
} from './ops'
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
  /** Stav, jak ho naposledy poslal Firestore (včetně jeho vlastní latency compensation). */
  let server: TournamentState = EMPTY_STATE
  /**
   * Operace, které uživatel udělal, ale Firestore je ještě nepotvrdil.
   * Zobrazený stav = `server` + tyhle operace. Bez toho by snímek, který
   * dorazí mezi okamžitou odezvou a předáním zápisu SDK, vrátil obrazovku do
   * starého stavu a další úprava (pozice, hry - posílají se celé) by se
   * spočítala ze starých dat a první změnu přepsala. Operace jsou
   * idempotentní (nastavují hodnoty), opakované použití nevadí.
   */
  let unsent: Op[] = []
  let state: TournamentState = EMPTY_STATE

  function recompute(): void {
    state = unsent.reduce((acc, op) => applyOp(acc, op), server)
  }

  function setServer(update: (current: TournamentState) => TournamentState): void {
    server = update(server)
    recompute()
  }
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
        setServer((current) => ({
          ...current,
          tournament: snapshot.exists() ? decodeTournament(snapshot.data()) : null,
        }))
        status = snapshot.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced'
        notify()
      },
      (err) => fail(t('error.loadTournament', { reason: err.message })),
    )

    module.onSnapshot(
      module.collection(root, 'players'),
      (snapshot) => {
        setServer((current) => ({
          ...current,
          players: snapshot.docs
            .map((entry) => decodePlayer(entry.data()))
            .filter((p): p is Player => p !== null)
            .sort((a, b) => a.order - b.order),
        }))
        notify()
      },
      (err) => fail(t('error.loadPlayers', { reason: err.message })),
    )

    module.onSnapshot(
      module.collection(root, 'rounds'),
      { includeMetadataChanges: true },
      (snapshot) => {
        pendingWrites = snapshot.docs.filter(
          (entry) => entry.metadata.hasPendingWrites,
        ).length
        setServer((current) => ({
          ...current,
          rounds: snapshot.docs
            .map((entry) => decodeRound(entry.data()))
            .filter((r): r is TournamentRound => r !== null)
            .sort((a, b) => a.number - b.number),
        }))
        notify()
      },
      (err) => fail(t('error.loadRounds', { reason: err.message })),
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
   * Role podle e-mailu přihlášeného účtu v `private/access`: admin, hráč
   * (zapisovatel), nebo nikdo. Hráči a admin dokument smějí číst (rules), takže
   * se rovnou pozná i jméno hráče. Cizí účet se odhlásí - přihlásit se smějí
   * jen hráči a admin. Do ověření je účet jen visitor (nic nezapíše).
   */
  function updateRole(db: Firestore, module: FirestoreModule): void {
    accessUnsub?.()
    accessUnsub = null
    setServer((current) => ({ ...current, access: null }))
    if (!account) {
      role = 'visitor'
      notify()
      return
    }
    const signedIn = account
    const bootstrap = signedIn.email === BOOTSTRAP_ADMIN_EMAIL
    role = bootstrap ? 'admin' : 'visitor'
    notify()
    const accessRef = module.doc(db, 'tournaments', tournamentId, 'private', 'access')
    const current = () => account?.uid === signedIn.uid
    accessUnsub = module.onSnapshot(
      accessRef,
      (snapshot) => {
        if (!current()) return
        const data = snapshot.exists() ? decodeAccess(snapshot.data()) : null
        const identity = resolveIdentity(data, signedIn.email, BOOTSTRAP_ADMIN_EMAIL)
        if (identity.role === 'outsider') {
          rejectAccount(signedIn)
          return
        }
        setServer((current) => ({ ...current, access: data }))
        role = identity.role
        account = { ...signedIn, playerId: identity.playerId }
        notify()
      },
      (err) => {
        if (!current()) return
        // Bootstrap admin smí číst vždy; turnaj jen ještě nemusí existovat.
        if (bootstrap) {
          role = 'admin'
          notify()
          return
        }
        if (codeOf(err) === 'permission-denied') rejectAccount(signedIn)
        else fail(t('error.loadAccess', { reason: err.message }))
      },
    )
  }

  /**
   * Účet, který není hráčem ani adminem: hláška a odhlášení. Neověřený
   * e-mail dostane vlastní hlášku - rules ho nepustí, i když v soupisce je.
   */
  function rejectAccount(signedIn: Account): void {
    role = 'visitor'
    const email = signedIn.email || signedIn.name
    fail(t(signedIn.emailVerified ? 'error.notMember' : 'error.notVerified', { email }))
    void signOutAccount()
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
        fail(t('error.signInFirst'))
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
      const problem = checkOp(op, role, writes)
      if (problem) {
        fail(opProblemMessage(problem))
        return
      }
      // Okamžitá odezva; operace se znovu použije na každý snímek, dokud ji
      // Firestore nepotvrdí nebo neodmítne (viz `unsent`).
      unsent.push(op)
      recompute()
      notify()
      const settle = () => {
        unsent = unsent.filter((pending) => pending !== op)
        recompute()
        notify()
      }

      const signedIn = account
      const reject = (err: unknown) => {
        // Rules odmítnou zápis skóre i od zapisovatele, když je kolo mezitím
        // uzavřené (fronta offline zápisů po návratu signálu). Hláška
        // o chybějícím oprávnění by pak poslala admina hledat jinou chybu.
        const denied = codeOf(err) === 'permission-denied'
        const round = isCellOp(op)
          ? state.rounds.find((r) => r.id === op.roundId)
          : undefined
        const reason = !denied
          ? err instanceof Error
            ? err.message
            : String(err)
          : !isCellOp(op)
            ? t('error.adminOnly')
            : round?.status === 'finished'
              ? t('play.roundFinished')
              : t('play.notWriter', { account: signedIn.email || signedIn.uid })
        if (!isCellOp(op)) {
          fail(t('error.changeRejected', { reason }))
          return
        }
        const player = state.players.find((p) => p.id === op.playerId)
        fail(
          t('play.rejected', {
            hole: op.hole + 1,
            name: player?.nick ?? player?.name ?? op.playerId,
            reason,
          }),
        )
      }

      void started
        .then(async () => {
          const { db } = await loadFirebase()
          const module = await import('firebase/firestore')
          // Sestavení dávky může vyhodit synchronně (neplatná hodnota v datech);
          // i to musí skončit v `meta.error`, jinak by optimistický stav tiše
          // zůstal jiný než server.
          const batch = module.writeBatch(db)
          for (const write of writes) {
            const ref = docRef(module, db, write)
            const data = materialize(module, write.data)
            if (write.mode === 'update') batch.update(ref, data)
            else if (write.mode === 'setMerge') batch.set(ref, data, { merge: true })
            else batch.set(ref, data)
          }
          // Záměrně bez await v UI: offline by promise nikdy nedoběhl.
          batch.commit().then(settle, (err: unknown) => {
            settle()
            reject(err)
          })
        })
        .catch((err: unknown) => {
          settle()
          reject(err)
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
          fail(t('admin.signInError.notReady'))
          return
        }
        // Kód chyby (např. auth/unauthorized-domain) je jediná stopa, podle
        // které jde špatné nastavení Firebase dohledat - proto je v hlášce.
        fail(
          t(
            kind === 'network'
              ? 'admin.signInError.network'
              : kind === 'popup'
                ? 'admin.signInError.popup'
                : 'admin.signInError.unknown',
            { code: codeOf(err) || (err instanceof Error ? err.message : String(err)) },
          ),
        )
      }
    },
    async signOut() {
      await signOutAccount()
    },
    dismissError() {
      error = null
      notify()
    },
    async loadEdits(roundId, limit = 50) {
      const { db } = await loadFirebase()
      const module = await import('firebase/firestore')
      const snapshot = await module.getDocs(
        module.query(
          module.collection(db, 'tournaments', tournamentId, 'rounds', roundId, 'edits'),
          module.orderBy('at', 'desc'),
          module.limit(limit),
        ),
      )
      return snapshot.docs.map((entry) => {
        const data = entry.data() as EditRecord & { at: { toDate?: () => Date } | string }
        const at =
          typeof data.at === 'object' && data.at && typeof data.at.toDate === 'function'
            ? data.at.toDate().toISOString()
            : data.clientAt
        return { ...data, at }
      })
    },
  }
}
