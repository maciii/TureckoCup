import type {
  GameConfig,
  GameKind,
  PickupRule,
  Player,
  TeamId,
  TournamentRound,
} from '../model/types'
import { DEFAULT_PICKUP } from '../model/pickup'
import { positionDuel, teamMatch } from './duels'
import { bestAggregate } from './bestAggregate'
import { fourBallSkins } from './fourBallSkins'
import { texasScramble } from './texas'
import { bonusForfeitTotal, bonusTotal } from './bonuses'
import { DEFAULT_BONUS_CONFIG } from '../model/bonuses'
import { teamOf } from '../model/round'
import type { BonusConfig } from '../model/types'
import { individualSkins, teamSkins } from './skins'
import { individualStableford } from './stableford'
import type { Evaluate, EvaluationResult } from './types'

export type { DuelResult, EvaluationResult, HoleOutcome, StandingRow } from './types'

/** Registr evaluací podle druhu hry. */
const EVALUATIONS: Record<GameKind, Evaluate> = {
  'individual-stableford': individualStableford,
  'individual-skins': individualSkins,
  'team-skins': teamSkins,
  'position-duel': positionDuel,
  'team-match': teamMatch,
  'best-aggregate': bestAggregate,
  'four-ball-skins': fourBallSkins,
  'texas-scramble': texasScramble,
}

export const GAME_KINDS: GameKind[] = [
  'individual-stableford',
  'individual-skins',
  'team-skins',
  'position-duel',
  'team-match',
  'best-aggregate',
  'four-ball-skins',
  'texas-scramble',
]

/** Hry se stranami z konfigurace (dvojice), které admin skládá v editoru hry. */
export function hasSides(kind: GameKind): boolean {
  return (
    kind === 'team-match' ||
    kind === 'best-aggregate' ||
    kind === 'four-ball-skins' ||
    kind === 'texas-scramble'
  )
}

export function evaluateGame(
  round: TournamentRound,
  players: Player[],
  game: GameConfig,
  pickup: PickupRule = DEFAULT_PICKUP,
  bonuses: BonusConfig = DEFAULT_BONUS_CONFIG,
): EvaluationResult {
  const evaluate = EVALUATIONS[game.kind]
  const result = evaluate({ round, players, pickup, bonuses }, game)
  // Extra body do týmu jdou přes hru, která je má zapnuté: Best + Součet si je
  // dává do bodů dvojice sám, ostatní týmové hry je přičtou k bodům týmu sazbou.
  if (game.options.bonuses && game.countsForTeam && game.kind !== 'best-aggregate') {
    for (const id of round.playerIds) {
      const team = teamOf(players, id)
      if (!team) continue
      result.teamPoints[team] += bonusTotal(round, bonuses, id) * bonuses.teamPerPoint
      // Nepotvrzený Longest/Nearest jde druhému týmu.
      const other: TeamId = team === 'A' ? 'B' : 'A'
      result.teamPoints[other] +=
        bonusForfeitTotal(round, bonuses, id) * bonuses.teamPerPoint
    }
  }
  return result
}

export function evaluateRound(
  round: TournamentRound,
  players: Player[],
  pickup: PickupRule = DEFAULT_PICKUP,
  bonuses: BonusConfig = DEFAULT_BONUS_CONFIG,
): EvaluationResult[] {
  return round.games.map((game) => evaluateGame(round, players, game, pickup, bonuses))
}

/** Týmové body kola ze her, které do týmového skóre vstupují, plus extra body, jsou-li zapnuté. */
export function roundTeamPoints(
  results: EvaluationResult[],
  bonuses?: { teamPoints: Record<TeamId, number> } | null,
): Record<TeamId, number> {
  const points: Record<TeamId, number> = { A: 0, B: 0 }
  for (const result of results) {
    if (!result.game.countsForTeam) continue
    points.A += result.teamPoints.A
    points.B += result.teamPoints.B
  }
  if (bonuses) {
    points.A += bonuses.teamPoints.A
    points.B += bonuses.teamPoints.B
  }
  return points
}
