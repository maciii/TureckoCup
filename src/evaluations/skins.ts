import type { GameConfig, PlayerId, TeamId } from '../model/types'
import { TEAM_IDS } from '../model/types'
import {
  holeMultiplier,
  CONCEDED,
  gameHoles,
  grossTotal,
  holeOrder,
  holesPlayed,
  netScoreAt,
  teamOf,
  teamPlayers,
} from '../model/round'
import { computeSkins } from '../scoring/skinsCore'
import type { Evaluate, EvaluationContext, EvaluationResult, HoleOutcome } from './types'
import { rankRows } from './types'

/**
 * Skins jednotlivců - v rámci flightu (výchozí), nebo přes všech osm.
 *
 * Jamka je rozhodnutá, až když zapsali všichni, kterých se týká: ve flightu
 * všichni čtyři, přes všech osm oba flighty. Do té doby bank stojí - visitor
 * tak nikdy neuvidí skin „dočasně" u hráče jen proto, že zapsal první.
 */
export const individualSkins: Evaluate = (context, game): EvaluationResult => {
  const { round, players } = context
  const options = { net: game.options.net, allowance: game.options.allowance }
  const scope = game.options.scope ?? 'flight'
  const groups: PlayerId[][] =
    scope === 'all' ? [round.playerIds] : round.flights.map((flight) => flight.players)

  const totals = new Map<PlayerId, number>()
  const holeOutcomes: HoleOutcome[] = []
  let pending = 0
  let carryLeft = 0
  const allowed = new Set(gameHoles(round, game))

  for (const group of groups) {
    const flight = round.flights.find((f) => f.players.includes(group[0] ?? ''))
    const order = holeOrder(round, flight).filter((hole) => allowed.has(hole))
    const result = computeSkins({
      holeOrder: order,
      sideCount: group.length,
      carry: game.options.carry ?? true,
      holeValue: (hole) => holeMultiplier(game.options, hole),
      scoreOf: (side, hole) => netScoreAt(round, group[side] ?? '', hole, options),
    })
    group.forEach((id, side) => totals.set(id, result.totals[side] ?? 0))
    pending += result.pending
    carryLeft += result.carry
    for (const outcome of result.holes) {
      holeOutcomes.push({
        hole: outcome.hole,
        decided: outcome.decided,
        winners: outcome.winner === null ? [] : [group[outcome.winner] ?? ''],
        value: outcome.skins,
        carry: outcome.carry,
        group,
      })
    }
  }

  const rows = round.playerIds.map((id) => ({
    id,
    players: [id],
    value: totals.get(id) ?? 0,
    secondary: grossTotal(round, id),
    holes: holesPlayed(round, id),
    teamId: teamOf(players, id),
  }))

  return {
    game,
    rows: rankRows(rows, 'highest', 'lowest'),
    holes: holeOutcomes,
    teamPoints: { A: 0, B: 0 },
    pending,
    carry: carryLeft,
  }
}

/**
 * Team Skins - Team A proti Team B, rána týmu je nejlepší netto míč ze všech
 * jeho hráčů (z obou flightů). Jamka je rozhodnutá, až když zapsalo všech
 * osm - flighty hrají s odstupem a pozdější flight nesmí platit za vzdaný.
 */
export const teamSkins: Evaluate = (context, game): EvaluationResult => {
  const { round, players } = context
  const options = { net: game.options.net, allowance: game.options.allowance }
  const sides = TEAM_IDS.map((teamId) => ({
    teamId,
    players: teamPlayers(round, players, teamId),
  }))
  const order = holeOrder(round, round.flights[0]).filter((hole) =>
    gameHoles(round, game).includes(hole),
  )

  const result = computeSkins({
    holeOrder: order,
    sideCount: sides.length,
    carry: game.options.carry ?? true,
    holeValue: (hole) => holeMultiplier(game.options, hole),
    scoreOf: (side, hole) =>
      teamBestBall(context, sides[side]?.players ?? [], hole, options),
  })

  const rows = sides.map((side, index) => ({
    id: side.teamId,
    players: side.players,
    value: result.totals[index] ?? 0,
    holes: result.holes.filter((h) => h.decided).length,
    teamId: side.teamId,
  }))

  const perSkin = game.teamPoints.perSkin ?? 0
  const teamPoints: Record<TeamId, number> = {
    A: (result.totals[0] ?? 0) * perSkin,
    B: (result.totals[1] ?? 0) * perSkin,
  }

  return {
    game,
    rows: rankRows(rows, 'highest'),
    holes: result.holes.map((h) => ({
      hole: h.hole,
      decided: h.decided,
      winners: h.winner === null ? [] : (sides[h.winner]?.players ?? []),
      value: h.skins,
      carry: h.carry,
    })),
    teamPoints,
    pending: result.pending,
    carry: result.carry,
  }
}

/**
 * Lepší míč strany na jamce. `undefined`, dokud nezapsali všichni její hráči;
 * `CONCEDED`, když všichni zvedli.
 */
export function teamBestBall(
  { round }: EvaluationContext,
  playerIds: PlayerId[],
  hole: number,
  options: { net: boolean; allowance: number },
): number | undefined {
  if (playerIds.length === 0) return undefined
  let best = CONCEDED
  for (const id of playerIds) {
    const net = netScoreAt(round, id, hole, options)
    if (net === undefined) return undefined
    if (net < best) best = net
  }
  return best
}

/** Výsledek jamky pro skupinu (flight): skins ve flightu mají jamku za každou skupinu zvlášť. */
export function outcomeFor(
  result: EvaluationResult,
  hole: number,
  groupPlayers: readonly PlayerId[],
): HoleOutcome | undefined {
  return result.holes.find(
    (h) =>
      h.hole === hole && (!h.group || h.group.some((id) => groupPlayers.includes(id))),
  )
}

/** Pomocník pro hlavičku zápisu: kolik skinů je právě ve hře na jamce flightu. */
export function skinsAtStake(
  result: EvaluationResult,
  hole: number,
  groupPlayers: readonly PlayerId[],
): number {
  const outcome = outcomeFor(result, hole, groupPlayers)
  if (!outcome) return 0
  if (outcome.decided) return outcome.value ?? 0
  return (outcome.carry ?? 0) + holeMultiplier(result.game.options, hole)
}

export function isSkinsGame(game: GameConfig): boolean {
  return game.kind === 'individual-skins' || game.kind === 'team-skins'
}
