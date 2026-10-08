import type {
  BonusConfig,
  GameKind,
  PickupRule,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'
import { POSITIONS } from '../model/types'
import { DEFAULT_PICKUP } from '../model/pickup'
import { DEFAULT_BONUS_CONFIG } from '../model/bonuses'
import { bonusSummary } from './bonuses'
import type { BonusSummary } from './bonuses'
import { evaluateRound, roundTeamPoints } from './index'
import type { EvaluationResult } from './types'
import { rankRows } from './types'

/**
 * Agregace přes kola: týmové skóre, pořadí jednotlivců a bilance duelů pozic.
 * Počítá se jen z kol, která nejsou ve stavu `planned`.
 */

export interface RoundEvaluation {
  round: TournamentRound
  results: EvaluationResult[]
  /** Extra body kola; `null`, když se o ně nehraje. */
  bonuses: BonusSummary | null
  /** Včetně extra bodů do týmu, jsou-li zapnuté. */
  teamPoints: Record<TeamId, number>
}

export interface IndividualTotal {
  id: PlayerId
  teamId?: TeamId
  stableford: number
  skins: number
  /** Extra body přes odehraná kola. */
  bonus: number
  rounds: number
  position: number
}

export interface PositionBalance {
  position: number
  /** Výhry, remízy, prohry z pohledu týmu A. */
  wins: Record<TeamId, number>
  halves: number
  rounds: number
  /**
   * Kdo pozici za tým hrál, v pořadí kol. Pozice jsou snímek každého kola,
   * takže jména z aktuálního kola by u přehozených pozic lhala.
   */
  players: Record<TeamId, PlayerId[]>
}

export interface TournamentSummary {
  rounds: RoundEvaluation[]
  teamPoints: Record<TeamId, number>
  individuals: IndividualTotal[]
  positions: PositionBalance[]
  /** Je týmové skóre jen předběžné (žádná hra zatím není označená jako hlavní)? */
  provisional: boolean
}

export function playedRounds(rounds: TournamentRound[]): TournamentRound[] {
  return rounds.filter((round) => round.status !== 'planned')
}

export function summarizeTournament(
  rounds: TournamentRound[],
  players: Player[],
  pickup: PickupRule = DEFAULT_PICKUP,
  bonusConfig: BonusConfig = DEFAULT_BONUS_CONFIG,
): TournamentSummary {
  const evaluated: RoundEvaluation[] = playedRounds(rounds).map((round) => {
    const results = evaluateRound(round, players, pickup, bonusConfig)
    const bonuses = bonusSummary(round, players, bonusConfig)
    return { round, results, bonuses, teamPoints: roundTeamPoints(results, bonuses) }
  })

  const teamPoints: Record<TeamId, number> = { A: 0, B: 0 }
  for (const entry of evaluated) {
    teamPoints.A += entry.teamPoints.A
    teamPoints.B += entry.teamPoints.B
  }

  const totals = new Map<PlayerId, IndividualTotal>()
  for (const player of players) {
    totals.set(player.id, {
      id: player.id,
      teamId: player.teamId,
      stableford: 0,
      skins: 0,
      bonus: 0,
      rounds: 0,
      position: 0,
    })
  }
  const sumKind = (
    entry: RoundEvaluation,
    kind: GameKind,
    key: 'stableford' | 'skins',
  ) => {
    for (const result of entry.results) {
      if (result.game.kind !== kind) continue
      for (const row of result.rows) {
        const total = totals.get(row.id)
        if (total) total[key] += row.value
      }
    }
  }
  for (const entry of evaluated) {
    sumKind(entry, 'individual-stableford', 'stableford')
    sumKind(entry, 'individual-skins', 'skins')
    for (const row of entry.bonuses?.rows ?? []) {
      const total = totals.get(row.id)
      if (total) total.bonus += row.value
    }
    for (const id of entry.round.playerIds) {
      const total = totals.get(id)
      if (total && Object.keys(entry.round.scores[id] ?? {}).length > 0) total.rounds += 1
    }
  }
  const individuals = rankRows(
    [...totals.values()].map((total) => ({
      ...total,
      value: total.stableford,
      secondary: total.skins,
      holes: total.rounds,
    })),
    'highest',
    'highest',
  ).map(({ value: _v, secondary: _s, holes: _h, ...rest }) => rest)

  const positions: PositionBalance[] = POSITIONS.map((position) => ({
    position,
    wins: { A: 0, B: 0 },
    halves: 0,
    rounds: 0,
    players: { A: [], B: [] },
  }))
  for (const entry of evaluated) {
    for (const result of entry.results) {
      if (result.game.kind !== 'position-duel') continue
      for (const duel of result.duels ?? []) {
        // Jména i výsledky jen z dohraných duelů - bilance je „přes odehraná
        // kola“, hráč z rozehraného kola by dostal cizí výsledky.
        if (!duel.finished || duel.position === undefined) continue
        const balance = positions[duel.position - 1]
        if (!balance) continue
        for (const side of duel.sides) {
          if (!side.teamId) continue
          const seen = balance.players[side.teamId]
          for (const id of side.players) if (!seen.includes(id)) seen.push(id)
        }
        balance.rounds += 1
        if (duel.leader === null) balance.halves += 1
        else {
          const team = duel.sides[duel.leader]?.teamId
          if (team) balance.wins[team] += 1
        }
      }
    }
  }

  const provisional = !rounds.some((round) =>
    round.games.some((game) => game.countsForTeam && game.kind !== 'team-skins'),
  )

  return { rounds: evaluated, teamPoints, individuals, positions, provisional }
}
