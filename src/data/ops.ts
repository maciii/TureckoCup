import type {
  Access,
  Player,
  PlayerId,
  Tournament,
  TournamentRound,
  TournamentState,
} from '../model/types'
import { holeKey } from '../model/round'

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
  return op.kind !== 'setScore'
}
