import type { GameSide, PlayerId } from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  CONCEDED,
  gameHoles,
  holeOrder,
  netScoreAt,
  parAt,
  scoreAt,
  strokesReceived,
  teamOf,
} from '../model/round'
import { pickupStrokes } from '../model/pickup'
import { finishDuels } from './duels'
import { bonusPointsAt } from './bonuses'
import type {
  DuelResult,
  Evaluate,
  EvaluationContext,
  EvaluationResult,
  SidePoints,
} from './types'

/**
 * Best + Součet (vzor Golfgames `bestAggregate`): dvě dvojice, na každé
 * jamce body dvojici:
 *
 *   1 bod  za BEST    - nižší lepší míč než soupeřova dvojice
 *   1 bod  za součet  - nižší součet ran obou partnerů
 *   1 bod  za birdie  - za každé birdie kteréhokoli z partnerů (brutto)
 *   3 body za eagle   - za každý eagle kteréhokoli z partnerů (brutto)
 *
 * Při shodě lepšího míče nebo součtu bod nedostane nikdo. Jamka se počítá,
 * až zapíší všichni čtyři (pravidlo 4 v AGENTS.md). Lepší míč a součet jsou
 * netto podle přepínače Netto hry; zvednutý míč je v lepším míči vzdaný
 * a v součtu má rány podle centrálního pravidla zvednuté jamky. Birdie
 * a eagle jsou vždy ze skutečných ran - rozdané rány mění, kdo jamku
 * vyhrál, ne to, jak se zahrála. Vyhrává dvojice s víc body; body do týmu
 * jako u Four-ballu (výhra/remíza po dohrání).
 */
export const BEST_POINTS = { best: 1, aggregate: 1, birdie: 1, eagle: 3 } as const

interface SideScore {
  best: number
  sum: number
  /** Horší míč dvojice (pro Double Best); zvednutý = vzdaný. */
  worst: number
}

function sideScore(
  context: EvaluationContext,
  players: PlayerId[],
  hole: number,
  options: { net: boolean; allowance: number },
): SideScore | undefined {
  const { round, pickup } = context
  let best = CONCEDED
  let worst = 0
  let sum = 0
  for (const id of players) {
    const net = netScoreAt(round, id, hole, options)
    if (net === undefined) return undefined
    if (net < best) best = net
    if (net > worst) worst = net
    if (net === CONCEDED) {
      // Zvednutá jamka má v součtu rány podle pravidla turnaje, ne nekonečno.
      const strokes = strokesReceived(round, id, hole, options.allowance)
      const gross = pickupStrokes(pickup, parAt(round, hole), strokes)
      sum += options.net ? gross - strokes : gross
    } else {
      sum += net
    }
  }
  return { best, sum, worst }
}

function lowerWins(a: number, b: number): 0 | 1 | null {
  if (a === b) return null
  return a < b ? 0 : 1
}

function bonusPoints(
  context: EvaluationContext,
  players: PlayerId[],
  hole: number,
): number {
  const par = parAt(context.round, hole)
  let bonus = 0
  for (const id of players) {
    const gross = scoreAt(context.round, id, hole)
    if (gross === undefined || gross === PICKED_UP) continue
    const diff = gross - par
    if (diff <= -2) bonus += BEST_POINTS.eagle
    else if (diff === -1) bonus += BEST_POINTS.birdie
  }
  return bonus
}

/** Body obou dvojic na jamce; `undefined`, dokud nezapsali všichni čtyři. */
export function holePoints(
  context: EvaluationContext,
  left: GameSide,
  right: GameSide,
  hole: number,
  options: { net: boolean; allowance: number },
  withExtra = false,
  doubleBestValue = 0,
): [SidePoints, SidePoints] | undefined {
  const a = sideScore(context, left.players, hole, options)
  const b = sideScore(context, right.players, hole, options)
  if (!a || !b) return undefined
  const bestWinner = lowerWins(a.best, b.best)
  const aggWinner = lowerWins(a.sum, b.sum)
  // Double Best: oba míče dvojice lepší než oba míče soupeře (vzdaný míč je nejhorší).
  const doubleWinner: 0 | 1 | null =
    doubleBestValue > 0 ? (a.worst < b.best ? 0 : b.worst < a.best ? 1 : null) : null
  const build = (index: 0 | 1, score: SideScore, side: GameSide): SidePoints => {
    const best = bestWinner === index ? BEST_POINTS.best : 0
    const aggregate = aggWinner === index ? BEST_POINTS.aggregate : 0
    const bonus = bonusPoints(context, side.players, hole)
    const doubleBest = doubleWinner === index ? doubleBestValue : 0
    // Extra body (longest, sandie…) partnerů do bodů dvojice jako v Golfgames,
    // když to má hra zapnuté.
    const extra = withExtra
      ? side.players.reduce(
          (sum, id) => sum + bonusPointsAt(context.round, context.bonuses, id, hole),
          0,
        )
      : 0
    return {
      best,
      aggregate,
      bonus,
      doubleBest,
      extra,
      total: best + aggregate + doubleBest + bonus + extra,
      bestBall: score.best,
      sum: score.sum,
    }
  }
  return [build(0, a, left), build(1, b, right)]
}

export const bestAggregate: Evaluate = (context, game): EvaluationResult => {
  const { round, players } = context
  const holes = gameHoles(round, game)
  const options = { net: game.options.net ?? true, allowance: game.options.allowance }
  const sides = game.sides ?? []
  const duels: DuelResult[] = []
  for (let i = 0; i + 1 < sides.length; i += 2) {
    const left = sides[i]!
    const right = sides[i + 1]!
    const order = holeOrder(
      round,
      round.flights.find((f) => f.players.includes(left.players[0] ?? '')),
    ).filter((hole) => holes.includes(hole))
    const totals: [number, number] = [0, 0]
    const holeWinners: Record<string, 0 | 1 | null> = {}
    const points: Record<string, SidePoints[]> = {}
    let pending = 0
    let played = 0
    for (const hole of order) {
      const hp = holePoints(
        context,
        left,
        right,
        hole,
        options,
        game.options.bonuses ?? false,
        game.options.doubleBest ?? 0,
      )
      if (!hp) {
        pending += 1
        continue
      }
      played += 1
      totals[0] += hp[0].total
      totals[1] += hp[1].total
      holeWinners[String(hole)] =
        hp[0].total === hp[1].total ? null : hp[0].total > hp[1].total ? 0 : 1
      points[String(hole)] = hp
    }
    const finished = order.length > 0 && pending === 0
    const leader: 0 | 1 | null =
      totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1
    duels.push({
      id: `best-${i / 2 + 1}`,
      sides: [left, right].map((side, index) => ({
        id: side.id,
        players: side.players,
        teamId: teamOf(players, side.players[0] ?? ''),
        value: totals[index as 0 | 1],
        holes: played,
      })),
      leader,
      notation: `${totals[0]} : ${totals[1]}`,
      decided: finished,
      finished,
      pending,
      holeWinners,
      holePoints: points,
    })
  }
  return finishDuels(game, duels, holes)
}
