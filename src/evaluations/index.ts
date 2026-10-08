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
}

export const GAME_KINDS: GameKind[] = [
  'individual-stableford',
  'individual-skins',
  'team-skins',
  'position-duel',
  'team-match',
]

export function evaluateGame(
  round: TournamentRound,
  players: Player[],
  game: GameConfig,
  pickup: PickupRule = DEFAULT_PICKUP,
): EvaluationResult {
  const evaluate = EVALUATIONS[game.kind]
  return evaluate({ round, players, pickup }, game)
}

export function evaluateRound(
  round: TournamentRound,
  players: Player[],
  pickup: PickupRule = DEFAULT_PICKUP,
): EvaluationResult[] {
  return round.games.map((game) => evaluateGame(round, players, game, pickup))
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
