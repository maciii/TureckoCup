import type { DoubleBy, GameSide, PlayerId } from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  gameHoles,
  holeMultiplier,
  holeOrder,
  matchSides,
  parAt,
  scoreAt,
  sideDoubled,
  teamOf,
} from '../model/round'
import { computeSkins } from '../scoring/skinsCore'
import type { SkinsState } from '../scoring/skinsCore'
import { finishDuels } from './duels'
import { teamBestBall } from './skins'
import type {
  DuelResult,
  Evaluate,
  EvaluationContext,
  EvaluationResult,
  HoleOutcome,
} from './types'

/**
 * Four-ball Skins: dvojice proti dvojici (strany jako u Four-ballu, dva
 * zápasy v kole), na jamce se porovná lepší míč každé dvojice (netto podle
 * přepínače Netto a `allowance`). Vítěz bere skin, dělená jamka přenáší
 * skin dál (`carry`). Dvojice s víc skiny po dohrání vyhrává zápas a bere
 * `win` bodů do týmu, remíza `halve` - za každý zápas zvlášť.
 *
 * Bod za birdie (`options.birdieBonus`): za každé birdie a lepší partnerů
 * (brutto, ze skutečných ran) dostane dvojice bod do skóre zápasu navíc
 * ke skinům - skóre zápasu je tedy skiny + birdie body.
 *
 * Double: oprávněná dvojice může jamku dublovat - jamka pak nese dva skiny
 * místo jednoho (dvojitá 9 a 18 čtyři), přenesené skiny z banku se jen
 * přičtou. Kdo smí dublovat, říká `options.doubleBy`:
 *   behind     dvojice, která v zápase prohrává (při rovnosti nikdo)
 *   lastLoser  dvojice, která ztratila poslední rozhodnutou jamku
 *   anyone     kterákoli
 *   off        double se nehrají
 * Double je surová buňka (`round.doubles`, hráč × jamka, id hry) a jde
 * přepnout kdykoli; zápis u neoprávněné dvojice se nepočítá - vyhodnocení
 * ho zná (`mayDouble`), ať to zápis ukáže.
 */

export const DOUBLE_BY: DoubleBy[] = ['behind', 'lastLoser', 'anyone', 'off']

/** Strany, které smí v daném stavu zápasu dublovat. */
export function allowedDoublers(doubleBy: DoubleBy, state: SkinsState): (0 | 1)[] {
  const [a = 0, b = 0] = state.totals
  switch (doubleBy) {
    case 'off':
      return []
    case 'anyone':
      return [0, 1]
    case 'lastLoser':
      return state.lastWinner === null ? [] : [state.lastWinner === 0 ? 1 : 0]
    case 'behind':
      return a < b ? [0] : b < a ? [1] : []
  }
}

export const fourBallSkins: Evaluate = (context, game): EvaluationResult => {
  const { round, players } = context
  const holes = gameHoles(round, game)
  const options = { net: game.options.net ?? true, allowance: game.options.allowance }
  const doubleBy = game.options.doubleBy ?? 'behind'
  const sides = matchSides(round, players)
  const duels: DuelResult[] = []
  const outcomes: HoleOutcome[] = []
  let carryLeft = 0

  for (let i = 0; i + 1 < sides.length; i += 2) {
    const left = sides[i]!
    const right = sides[i + 1]!
    const pair: [GameSide, GameSide] = [left, right]
    const order = holeOrder(
      round,
      round.flights.find((f) => f.players.includes(left.players[0] ?? '')),
    ).filter((hole) => holes.includes(hole))
    const mayDouble: Record<string, (0 | 1)[]> = {}
    const doubles: Record<string, 0 | 1> = {}
    const stakes: Record<string, number> = {}

    const result = computeSkins({
      holeOrder: order,
      sideCount: 2,
      carry: game.options.carry ?? true,
      holeValue: (hole, state) => {
        const allowed = allowedDoublers(doubleBy, state)
        mayDouble[String(hole)] = allowed
        const doubler = allowed.find((index) =>
          sideDoubled(round, game.id, pair[index].players, hole),
        )
        if (doubler !== undefined) doubles[String(hole)] = doubler
        const value = holeMultiplier(game.options, hole) * (doubler === undefined ? 1 : 2)
        stakes[String(hole)] = state.carry + value
        return value
      },
      scoreOf: (side, hole) => teamBestBall(context, pair[side]!.players, hole, options),
    })

    // Bod za birdie: brutto birdie a lepší kteréhokoli partnera, hned po zápisu rány.
    const birdies: Record<string, number[]> = {}
    const birdieTotals: [number, number] = [0, 0]
    if (game.options.birdieBonus) {
      for (const hole of order) {
        const points = pair.map((side) =>
          side.players.reduce((sum, id) => {
            const score = scoreAt(round, id, hole)
            return score !== undefined &&
              score !== PICKED_UP &&
              score - parAt(round, hole) <= -1
              ? sum + 1
              : sum
          }, 0),
        )
        if (points[0]! > 0 || points[1]! > 0) birdies[String(hole)] = points
        birdieTotals[0] += points[0]!
        birdieTotals[1] += points[1]!
      }
    }
    const decided = result.holes.filter((h) => h.decided).length
    const describe = (side: GameSide, index: number) => ({
      id: side.id,
      players: side.players,
      teamId: teamOf(players, side.players[0] ?? ''),
      value: (result.totals[index] ?? 0) + birdieTotals[index]!,
      holes: decided,
    })
    const [a, b] = [
      (result.totals[0] ?? 0) + birdieTotals[0]!,
      (result.totals[1] ?? 0) + birdieTotals[1]!,
    ]
    const finished = result.pending === 0 && order.length > 0
    duels.push({
      id: `${left.id}-${right.id}`,
      sides: [describe(left, 0), describe(right, 1)],
      leader: a === b ? null : a > b ? 0 : 1,
      notation: `${a} : ${b}`,
      decided: finished,
      finished,
      pending: result.pending,
      holeWinners: Object.fromEntries(
        result.holes
          .filter((h) => h.decided)
          .map((h) => [String(h.hole), h.winner as 0 | 1 | null]),
      ),
      mayDouble,
      doubles,
      stakes,
      ...(game.options.birdieBonus ? { birdies } : {}),
    })
    carryLeft += result.carry
    for (const h of result.holes) {
      outcomes.push({
        hole: h.hole,
        decided: h.decided,
        winners: h.winner === null ? [] : pair[h.winner]!.players,
        value: h.skins,
        carry: h.carry,
      })
    }
  }

  return { ...finishDuels(game, duels, holes), holes: outcomes, carry: carryLeft }
}

/** Hráči dvojice, kterých se zápas týká - pro kartu v zápisu. */
export function matchOfFlight(
  result: EvaluationResult,
  flightPlayers: readonly PlayerId[],
): DuelResult | undefined {
  const inFlight = new Set(flightPlayers)
  return result.duels?.find((d) =>
    d.sides.some((s) => s.players.some((id) => inFlight.has(id))),
  )
}

export type { EvaluationContext }
