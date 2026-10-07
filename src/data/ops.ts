import type {
  Access,
  Player,
  PlayerId,
  Tournament,
  TournamentRound,
  TournamentState,
} from '../model/types'
import { holeKey } from '../model/round'
import { t } from '../i18n'
import type { Role } from './store'

/**
 * Operace nad stavem turnaje.
 *
 * Každá změna, kterou aplikace dělá, je jedna z těchto operací. `applyOp()`
 * ji aplikuje na místní stav (ukázkový režim i optimistická odezva) a
 * `opToWrites()` ji přeloží na zápisy do Firestore. Obě funkce jsou čisté
 * a test hlídá, že dávají stejný výsledek - lokální režim tak nelže.
 *
 * Zápis skóre je vždy **jedna buňka** (hráč × jamka): tak to vyžadují
 * security rules a tak nikdy nejde přepsat cizí zápis z druhého flightu.
 */

export type Op =
  | {
      kind: 'setScore'
      roundId: string
      playerId: PlayerId
      hole: number
      value: number | null
    }
  | {
      kind: 'setBonuses'
      roundId: string
      playerId: PlayerId
      hole: number
      /** Id zapsaných bonusů; prázdný seznam klíč smaže. */
      value: string[]
    }
  | { kind: 'updateRound'; roundId: string; patch: Partial<TournamentRound> }
  | { kind: 'updatePlayer'; playerId: PlayerId; patch: Partial<Player> }
  | { kind: 'updateTournament'; patch: Partial<Tournament> }
  | { kind: 'updateAccess'; access: Access }
  | { kind: 'clearScores'; roundId: string }
  | {
      kind: 'init'
      tournament: Tournament
      players: Player[]
      rounds: TournamentRound[]
      access: Access
    }

/** Kdo a kdy operaci dělá - do `lastEdit` a logu úprav. */
export interface OpMeta {
  uid: string
  email?: string
  clientAt: string
  appVersion: string
}

export function applyOp(state: TournamentState, op: Op): TournamentState {
  switch (op.kind) {
    case 'init':
      return {
        tournament: op.tournament,
        players: [...op.players],
        rounds: op.rounds.map((round) => structuredClone(round)),
        access: op.access,
      }
    case 'setScore':
      return mapRound(state, op.roundId, (round) => {
        const key = holeKey(op.hole)
        const player = { ...(round.scores[op.playerId] ?? {}) }
        if (op.value === null) delete player[key]
        else player[key] = op.value
        return { ...round, scores: { ...round.scores, [op.playerId]: player } }
      })
    case 'setBonuses':
      return mapRound(state, op.roundId, (round) => {
        const key = holeKey(op.hole)
        const player = { ...(round.bonuses[op.playerId] ?? {}) }
        if (op.value.length === 0) delete player[key]
        else player[key] = [...op.value]
        return { ...round, bonuses: { ...round.bonuses, [op.playerId]: player } }
      })
    case 'clearScores':
      return mapRound(state, op.roundId, (round) => ({
        ...round,
        scores: Object.fromEntries(round.playerIds.map((id) => [id, {}])),
        bonuses: Object.fromEntries(round.playerIds.map((id) => [id, {}])),
      }))
    case 'updateRound':
      return mapRound(state, op.roundId, (round) => ({ ...round, ...op.patch }))
    case 'updatePlayer':
      return {
        ...state,
        players: state.players.map((player) =>
          player.id === op.playerId ? { ...player, ...op.patch } : player,
        ),
      }
    case 'updateTournament':
      return state.tournament
        ? { ...state, tournament: { ...state.tournament, ...op.patch } }
        : state
    case 'updateAccess':
      return { ...state, access: op.access }
  }
}

function mapRound(
  state: TournamentState,
  roundId: string,
  update: (round: TournamentRound) => TournamentRound,
): TournamentState {
  return {
    ...state,
    rounds: state.rounds.map((round) => (round.id === roundId ? update(round) : round)),
  }
}

// --- překlad na zápisy do Firestore -------------------------------------------

/** Sentinely, které Firestore adapter nahradí za FieldValue. */
export const DELETE_FIELD = { __op: 'delete' } as const
export const SERVER_TIME = { __op: 'serverTime' } as const

export interface Write {
  /** Cesta dokumentu relativně k turnaji, např. ['rounds', 'r1']. */
  path: string[]
  /** `update` s field paths (tečková notace), `set` celý dokument, `setMerge`. */
  mode: 'update' | 'set' | 'setMerge'
  data: Record<string, unknown>
  /** `true` = id dokumentu vygeneruje adapter (log úprav). */
  autoId?: boolean
}

export function opToWrites(op: Op, meta: OpMeta, state: TournamentState): Write[] {
  switch (op.kind) {
    case 'init':
      return [
        { path: [], mode: 'set', data: { ...op.tournament, createdAt: SERVER_TIME } },
        { path: ['private', 'access'], mode: 'set', data: { ...op.access } },
        ...op.players.map<Write>((player) => ({
          path: ['players', player.id],
          mode: 'set',
          data: { ...player },
        })),
        ...op.rounds.map<Write>((round) => ({
          path: ['rounds', round.id],
          mode: 'set',
          data: { ...round },
        })),
      ]
    case 'setScore': {
      const key = holeKey(op.hole)
      const round = state.rounds.find((r) => r.id === op.roundId)
      const from = round?.scores[op.playerId]?.[key] ?? null
      return [
        {
          path: ['rounds', op.roundId],
          mode: 'update',
          data: {
            [`scores.${op.playerId}.${key}`]: op.value === null ? DELETE_FIELD : op.value,
            lastEdit: { playerId: op.playerId, hole: key, by: meta.uid, at: SERVER_TIME },
          },
        },
        {
          path: ['rounds', op.roundId, 'edits'],
          mode: 'set',
          autoId: true,
          data: {
            playerId: op.playerId,
            hole: key,
            from,
            to: op.value,
            by: meta.uid,
            ...(meta.email ? { byEmail: meta.email } : {}),
            at: SERVER_TIME,
            clientAt: meta.clientAt,
            appVersion: meta.appVersion,
          },
        },
      ]
    }
    case 'setBonuses': {
      // Stejná jedna buňka a lastEdit jako u skóre - rules to kontrolují stejně.
      const key = holeKey(op.hole)
      return [
        {
          path: ['rounds', op.roundId],
          mode: 'update',
          data: {
            [`bonuses.${op.playerId}.${key}`]:
              op.value.length === 0 ? DELETE_FIELD : [...op.value],
            lastEdit: { playerId: op.playerId, hole: key, by: meta.uid, at: SERVER_TIME },
          },
        },
      ]
    }
    case 'clearScores': {
      const round = state.rounds.find((r) => r.id === op.roundId)
      const ids = round?.playerIds ?? []
      return [
        {
          path: ['rounds', op.roundId],
          mode: 'update',
          data: {
            scores: Object.fromEntries(ids.map((id) => [id, {}])),
            bonuses: Object.fromEntries(ids.map((id) => [id, {}])),
          },
        },
      ]
    }
    case 'updateRound':
      return [{ path: ['rounds', op.roundId], mode: 'update', data: { ...op.patch } }]
    case 'updatePlayer':
      return [{ path: ['players', op.playerId], mode: 'update', data: { ...op.patch } }]
    case 'updateTournament':
      return [{ path: [], mode: 'update', data: { ...op.patch } }]
    case 'updateAccess':
      return [{ path: ['private', 'access'], mode: 'set', data: { ...op.access } }]
  }
}

/** Smí operaci dělat zapisovatel, nebo je to admin záležitost? */
export function requiresAdmin(op: Op): boolean {
  return op.kind !== 'setScore' && op.kind !== 'setBonuses'
}

/** Zápis do buňky kola (skóre nebo extra body) - smí ho zapisovatel. */
export function isCellOp(op: Op): op is Extract<Op, { kind: 'setScore' | 'setBonuses' }> {
  return op.kind === 'setScore' || op.kind === 'setBonuses'
}

/**
 * Najde hodnotu, kterou Firestore odmítne: `undefined` (i jako díra v poli)
 * a pole v poli. Vrací cestu k první takové hodnotě, nebo `null`.
 *
 * Kontrola běží v obou adapterech před optimistickou změnou: Firestore by
 * zápis odmítl až při sestavení dávky a ukázkový režim (localStorage) by ho
 * přijal - chyba by se pak poprvé ukázala až na hřišti.
 */
export function findInvalidValue(value: unknown, path = ''): string | null {
  if (value === undefined) return path || '/'
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const at = `${path}[${index}]`
      if (!(index in value) || value[index] === undefined) return at
      if (Array.isArray(value[index])) return at
      const nested = findInvalidValue(value[index], at)
      if (nested) return nested
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const found = findInvalidValue(nested, path ? `${path}.${key}` : key)
      if (found) return found
    }
  }
  return null
}

/**
 * První neplatná hodnota ve všech zápisech operace, jako cesta dokumentu
 * a pole: `rounds/r1/positions.A[0]`. Field path update (`scores.p1.0`)
 * zůstává jedním klíčem.
 */
export function findInvalidWrite(writes: Write[]): string | null {
  for (const write of writes) {
    const found = findInvalidValue(write.data)
    if (found) return [...write.path, found].join('/')
  }
  return null
}

/** Proč by produkce operaci odmítla dřív, než ji vůbec pošle. */
export type OpProblem =
  { kind: 'signInFirst' } | { kind: 'adminOnly' } | { kind: 'invalidData'; field: string }

/**
 * Společná kontrola obou adapterů (role jako v rules, data jako ve
 * Firestoru). Díky jedné funkci ukázkový režim a e2e testy nepřijmou nic,
 * co by produkce odmítla.
 */
export function checkOp(op: Op, role: Role, writes: Write[]): OpProblem | null {
  if (role === 'visitor') return { kind: 'signInFirst' }
  if (requiresAdmin(op) && role !== 'admin') return { kind: 'adminOnly' }
  const field = findInvalidWrite(writes)
  return field ? { kind: 'invalidData', field } : null
}

export function opProblemMessage(problem: OpProblem): string {
  switch (problem.kind) {
    case 'signInFirst':
      return t('error.signInFirst')
    case 'adminOnly':
      return t('error.adminOnly')
    case 'invalidData':
      return t('error.invalidData', { field: problem.field })
  }
}
