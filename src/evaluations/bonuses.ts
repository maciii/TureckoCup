import type { GameConfig, PlayerId, TeamId } from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  gameHoles,
  holesPlayed,
  netScoreAt,
  parAt,
  scoreAt,
  teamOf,
} from '../model/round'
import type { BonusDefinition } from '../model/bonuses'
import { BONUSES, bonusValue, bonusesAt, holdersOf } from '../model/bonuses'
import type { Evaluate, EvaluationContext, EvaluationResult, HoleOutcome } from './types'
import { rankRows } from './types'

/**
 * Extra body (vedlejší sázka podle Golfgames): longest, nearest, sandie…
 * si hráč zaškrtne u jamky, birdie a eagle se počítají z ran. Hodnotu
 * každého bonusu určuje hra; bonus s nulovou hodnotou se nenabízí ani
 * nepočítá. Longest a Nearest drží na jamce jediný hráč - když ho omylem
 * mají dva (zápis bez signálu ze dvou telefonů), nedostane bod nikdo.
 *
 * S `confirmByPar` platí ručně zapsaný bonus jen při paru a lepším (netto
 * podle `net`), jinak propadá - stejné „potvrzení parem“ jako v Golfgames.
 */

export interface BonusAward {
  bonus: BonusDefinition
  points: number
  /** Zapsaný, ale nepočítá se (nepotvrzený parem, dva držitelé, zvednuto). */
  void: boolean
}

/** Rozdíl proti paru pro potvrzení a birdie: netto podle hry, jinak brutto. */
function diffToPar(
  context: EvaluationContext,
  game: GameConfig,
  playerId: PlayerId,
  hole: number,
): number | undefined {
  const score = scoreAt(context.round, playerId, hole)
  if (score === undefined || score === PICKED_UP) return undefined
  const value = game.options.net
    ? netScoreAt(context.round, playerId, hole, {
        net: true,
        allowance: game.options.allowance,
      })
    : score
  if (value === undefined || !Number.isFinite(value)) return undefined
  return (value as number) - parAt(context.round, hole)
}

/** Bonusy hráče na jamce i s tím, jestli se počítají. */
export function bonusAwardsAt(
  context: EvaluationContext,
  game: GameConfig,
  playerId: PlayerId,
  hole: number,
): BonusAward[] {
  const { round } = context
  const diff = diffToPar(context, game, playerId, hole)
  const awards: BonusAward[] = []
  for (const bonus of BONUSES) {
    const value = bonusValue(game, bonus.id)
    if (value <= 0) continue
    if (bonus.auto) {
      if (diff === undefined) continue
      const hit = bonus.id === 'birdie' ? diff === -1 : bonus.id === 'eagle' && diff <= -2
      if (hit) awards.push({ bonus, points: value, void: false })
      continue
    }
    if (!bonusesAt(round, playerId, hole).includes(bonus.id)) continue
    const picked = scoreAt(round, playerId, hole) === PICKED_UP
    const unconfirmed =
      (game.options.confirmByPar ?? false) && (diff === undefined || diff > 0)
    const shared =
      (bonus.exclusive ?? false) && holdersOf(round, hole, bonus.id).length > 1
    const isVoid = picked || unconfirmed || shared
    awards.push({ bonus, points: isVoid ? 0 : value, void: isVoid })
  }
  return awards
}

export function bonusPointsAt(
  context: EvaluationContext,
  game: GameConfig,
  playerId: PlayerId,
  hole: number,
): number {
  return bonusAwardsAt(context, game, playerId, hole).reduce(
    (sum, a) => sum + a.points,
    0,
  )
}

/** Součet bodů hráče podle bonusu za celé kolo - do popisku ve výsledcích. */
export function bonusBreakdown(
  context: EvaluationContext,
  game: GameConfig,
  playerId: PlayerId,
): { bonus: BonusDefinition; count: number }[] {
  const counts = new Map<string, number>()
  for (const hole of gameHoles(context.round, game)) {
    for (const award of bonusAwardsAt(context, game, playerId, hole)) {
      if (award.void) continue
      counts.set(award.bonus.id, (counts.get(award.bonus.id) ?? 0) + 1)
    }
  }
  return BONUSES.filter((b) => counts.has(b.id)).map((bonus) => ({
    bonus,
    count: counts.get(bonus.id) ?? 0,
  }))
}

export const bonusGame: Evaluate = (context, game): EvaluationResult => {
  const { round, players } = context
  const holes = gameHoles(round, game)
  const outcomes: HoleOutcome[] = holes.map((hole) => {
    const winners = round.playerIds.filter(
      (id) => bonusPointsAt(context, game, id, hole) > 0,
    )
    return {
      hole,
      decided: round.playerIds.every((id) => scoreAt(round, id, hole) !== undefined),
      winners,
      value: winners.reduce((sum, id) => sum + bonusPointsAt(context, game, id, hole), 0),
    }
  })

  const rows = round.playerIds.map((id) => {
    let points = 0
    let count = 0
    for (const hole of holes) {
      for (const award of bonusAwardsAt(context, game, id, hole)) {
        if (award.void) continue
        points += award.points
        count += 1
      }
    }
    return {
      id,
      players: [id],
      value: points,
      secondary: count,
      holes: holesPlayed(round, id),
      teamId: teamOf(players, id),
    }
  })

  const teamPoints: Record<TeamId, number> = { A: 0, B: 0 }
  if (game.countsForTeam) {
    const perPoint = game.teamPoints.perPoint ?? 1
    for (const row of rows) if (row.teamId) teamPoints[row.teamId] += row.value * perPoint
  }

  return {
    game,
    rows: rankRows(rows, 'highest', 'highest'),
    holes: outcomes,
    teamPoints,
    pending: outcomes.filter((o) => !o.decided).length,
  }
}
