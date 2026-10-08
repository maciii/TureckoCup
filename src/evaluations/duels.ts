import type { DuelFormat, GameSide, PlayerId, TeamId } from '../model/types'
import { POSITIONS, TEAM_IDS } from '../model/types'
import {
  CONCEDED,
  gameHoles,
  holeOrder,
  parAt,
  playingHandicap,
  strokesReceived,
  teamOf,
} from '../model/round'
import { pickupStrokes } from '../model/pickup'
import { computeMatch } from '../scoring/matchCore'
import { stablefordPoints } from '../scoring/whs'
import { teamBestBall } from './skins'
import type {
  DuelResult,
  Evaluate,
  EvaluationContext,
  EvaluationResult,
  HoleOutcome,
} from './types'
import { rankRows } from './types'

/**
 * Duely dvou stran: soutěž podle pozic (A1 vs B1 … A4 vs B4) a hlavní týmová
 * hra (dvojice proti dvojici ve flightu). Formát je konfigurovatelný a dá se
 * změnit kdykoli - i po dohrání kola se duel přepočítá z raw skóre.
 *
 *   strokes-gross   součet brutto ran, nižší vyhrává
 *   strokes-net     součet netto ran, nižší vyhrává
 *   stableford      součet Stablefordových bodů (netto), vyšší vyhrává
 *   match-play      jamkovka na netto rány
 *
 * Zvednutá jamka se v součtových formátech počítá podle centrálního
 * pravidla turnaje (`pickup`, výchozí netto dvojbogey = par + 2 + rány na
 * jamce) - hráč za ni dostane definovaný počet ran místo nekonečna, které
 * by zničilo celý součet. Pravidlo dává brutto rány; v netto formátu se od
 * nich odečtou rány z handicapu.
 */

interface SideScore {
  value: number
  holes: number
}

function strokeOf(
  context: EvaluationContext,
  players: PlayerId[],
  hole: number,
  net: boolean,
  allowance: number,
): number | undefined {
  return teamBestBall(context, players, hole, { net, allowance })
}

/** Rána strany na jamce pro součtové formáty; zvednutí podle pravidla turnaje. */
function countedStroke(
  context: EvaluationContext,
  players: PlayerId[],
  hole: number,
  net: boolean,
  allowance: number,
): number | undefined {
  const value = strokeOf(context, players, hole, net, allowance)
  if (value === undefined) return undefined
  if (value === CONCEDED) {
    const strokes = Math.max(
      ...players.map((id) => strokesReceived(context.round, id, hole, allowance)),
    )
    const gross = pickupStrokes(context.pickup, parAt(context.round, hole), strokes)
    return net ? gross - strokes : gross
  }
  return value
}

function duelOf(
  context: EvaluationContext,
  id: string,
  sides: GameSide[],
  holes: number[],
  format: DuelFormat,
  allowance: number,
  position?: number,
): DuelResult {
  const { round, players } = context
  const [left, right] = sides
  if (!left || !right) {
    return {
      id,
      sides: [],
      leader: null,
      notation: '',
      decided: false,
      finished: false,
      pending: holes.length,
      position,
    }
  }
  const order = holeOrder(
    round,
    round.flights.find((f) => f.players.includes(left.players[0] ?? '')),
  ).filter((hole) => holes.includes(hole))

  const describe = (side: GameSide, score: SideScore) => ({
    id: side.id,
    players: side.players,
    teamId: teamOf(players, side.players[0] ?? ''),
    value: score.value,
    holes: score.holes,
  })

  if (format === 'match-play') {
    const state = computeMatch({
      holeOrder: order,
      scoreOf: (side, hole) =>
        strokeOf(context, (side === 0 ? left : right).players, hole, true, allowance),
    })
    return {
      id,
      sides: [
        describe(left, {
          value: state.won[0],
          holes: state.won[0] + state.won[1] + state.halved,
        }),
        describe(right, {
          value: state.won[1],
          holes: state.won[0] + state.won[1] + state.halved,
        }),
      ],
      leader: state.leaderIndex,
      notation: state.notation,
      decided: state.decided,
      finished: state.finished,
      pending: state.pending,
      position,
      holeWinners: Object.fromEntries(
        state.holes.filter((h) => h.decided).map((h) => [String(h.hole), h.winner]),
      ),
    }
  }

  const net = format !== 'strokes-gross'
  const scoreSide = (side: GameSide): SideScore => {
    let value = 0
    let count = 0
    for (const hole of order) {
      const stroke = countedStroke(context, side.players, hole, net, allowance)
      if (stroke === undefined) continue
      count += 1
      value +=
        format === 'stableford' ? stablefordPoints(stroke - parAt(round, hole)) : stroke
    }
    return { value, holes: count }
  }
  const a = scoreSide(left)
  const b = scoreSide(right)
  // Porovnává se jen přes jamky, které mají obě strany - jinak by strana,
  // která je o jamku napřed, "vedla" jen proto, že má víc zapsáno.
  const common = order.filter(
    (hole) =>
      countedStroke(context, left.players, hole, net, allowance) !== undefined &&
      countedStroke(context, right.players, hole, net, allowance) !== undefined,
  )
  const sum = (side: GameSide) =>
    common.reduce((total, hole) => {
      const stroke = countedStroke(context, side.players, hole, net, allowance) ?? 0
      return (
        total +
        (format === 'stableford' ? stablefordPoints(stroke - parAt(round, hole)) : stroke)
      )
    }, 0)
  const ca = sum(left)
  const cb = sum(right)
  const higherWins = format === 'stableford'
  // Po jamkách pro zápis: kdo jamku bere, nebo dělená - jen tam, kde zapsaly obě strany.
  const holeWinners: Record<string, 0 | 1 | null> = {}
  for (const hole of common) {
    const valueOf = (side: GameSide) => {
      const stroke = countedStroke(context, side.players, hole, net, allowance) ?? 0
      return format === 'stableford'
        ? stablefordPoints(stroke - parAt(round, hole))
        : stroke
    }
    const va = valueOf(left)
    const vb = valueOf(right)
    holeWinners[String(hole)] =
      va === vb ? null : (higherWins ? va > vb : va < vb) ? 0 : 1
  }
  let leader: 0 | 1 | null = null
  if (ca !== cb) leader = (higherWins ? ca > cb : ca < cb) ? 0 : 1
  const diff = Math.abs(ca - cb)
  const finished = common.length === order.length
  return {
    id,
    holeWinners,
    sides: [describe(left, a), describe(right, b)],
    leader,
    notation: leader === null ? 'AS' : `+${diff}`,
    decided: finished,
    finished,
    pending: order.length - common.length,
    position,
  }
}

function duelTeamPoints(
  duels: DuelResult[],
  rule: { win?: number; halve?: number },
  onlyFinished: boolean,
): Record<TeamId, number> {
  const points: Record<TeamId, number> = { A: 0, B: 0 }
  for (const duel of duels) {
    if (onlyFinished && !duel.finished) continue
    if (duel.sides.length < 2) continue
    if (duel.leader === null) {
      for (const side of duel.sides)
        if (side.teamId) points[side.teamId] += rule.halve ?? 0
    } else {
      const winner = duel.sides[duel.leader]
      if (winner?.teamId) points[winner.teamId] += rule.win ?? 0
    }
  }
  return points
}

function duelsToRows(duels: DuelResult[]) {
  const rows = duels.flatMap((duel) =>
    duel.sides.map((side, index) => ({
      id: `${duel.id}:${side.id}`,
      players: side.players,
      value: duel.leader === index ? 1 : duel.leader === null && duel.finished ? 0.5 : 0,
      secondary: side.value,
      holes: side.holes,
      teamId: side.teamId,
    })),
  )
  return rankRows(rows, 'highest')
}

/** Soutěž podle pozic: A{n} vs B{n} ze snímku pozic v kole. */
export const positionDuel: Evaluate = (context, game): EvaluationResult => {
  const { round } = context
  const format = game.options.format ?? 'strokes-net'
  const holes = gameHoles(round, game)
  const duels = POSITIONS.map((position) => {
    const sides: GameSide[] = TEAM_IDS.map((teamId) => {
      const id = round.positions[teamId]?.[position - 1]
      return { id: `${teamId}${position}`, players: id ? [id] : [] }
    })
    return duelOf(
      context,
      `pos-${position}`,
      sides,
      holes,
      format,
      game.options.allowance,
      position,
    )
  })
  return finishDuels(game, duels, holes)
}

/** Hlavní týmová hra: strany z konfigurace (dvojice), typicky four-ball ve flightu. */
export const teamMatch: Evaluate = (context, game): EvaluationResult => {
  const { round } = context
  const format = game.options.format ?? 'match-play'
  const holes = gameHoles(round, game)
  const sides = game.sides ?? []
  const duels: DuelResult[] = []
  for (let i = 0; i + 1 < sides.length; i += 2) {
    duels.push(
      duelOf(
        context,
        `match-${i / 2 + 1}`,
        [sides[i]!, sides[i + 1]!],
        holes,
        format,
        game.options.allowance,
      ),
    )
  }
  return finishDuels(game, duels, holes)
}

function finishDuels(
  game: Parameters<Evaluate>[1],
  duels: DuelResult[],
  holes: number[],
): EvaluationResult {
  const outcomes: HoleOutcome[] = holes.map((hole) => ({
    hole,
    decided:
      duels.every((d) => d.sides.length === 2) && duels.every((d) => d.pending === 0),
    winners: [],
  }))
  return {
    game,
    rows: duelsToRows(duels),
    holes: outcomes,
    duels,
    teamPoints: duelTeamPoints(duels, game.teamPoints, true),
    pending: duels.reduce((sum, d) => sum + d.pending, 0),
  }
}

/** Hrací handicapy obou stran duelu - pro popisek v UI. */
export function duelHandicaps(
  context: EvaluationContext,
  duel: DuelResult,
  allowance: number,
) {
  return duel.sides.map((side) =>
    side.players.map((id) => playingHandicap(context.round, id, allowance)),
  )
}
