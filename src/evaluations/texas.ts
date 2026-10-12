import {
  CONCEDED,
  courseHandicapOf,
  gameHoles,
  holeCount,
  matchSides,
  parAt,
  scoreAt,
  strokeIndexRanked,
} from '../model/round'
import { pickupStrokes } from '../model/pickup'
import type { GameOptions, PlayerId, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import { strokesForHole } from '../scoring/whs'
import { duelOf, finishDuels } from './duels'
import type { SideScorer } from './duels'
import type { DuelResult, Evaluate, EvaluationContext, EvaluationResult } from './types'

/**
 * Texas scramble dvojic: oba hráči odpalují, dvojice vybere lepší míč a z něj
 * hrají oba, až do jamky - dvojice má na jamce **jedno skóre**. Dvojice jsou
 * z flightů jako u ostatních her dvojic (dva hráči téhož týmu ve flightu)
 * a hrají proti dvojici druhého týmu ve flightu.
 *
 *   - Skóre dvojice se zapisuje oběma partnerům stejně (zápis to dělá sám);
 *     evaluace bere lepší ze zapsaných, aby jeden chybějící zápis nevadil.
 *     Zvednutá jamka platí, jen když zvedli oba (nikdo nemá číslo).
 *   - Hrací HCP dvojice podle doporučení WHS pro scramble dvojic:
 *     35 % nižšího + 15 % vyššího hracího HCP (bez allowance hry), zaokrouhleno;
 *     podíly jdou v nastavení hry změnit. Rány se rozdělí podle SI jamek.
 *   - Formát zápasu jako u Four-ball: jamkovka (výchozí), netto/brutto rány
 *     nebo Stableford dvojice; body do týmu za výhru a remízu zápasu.
 */

export const TEXAS_LOW = 0.35
export const TEXAS_HIGH = 0.15

export function texasShares(options: GameOptions): { low: number; high: number } {
  return { low: options.texasLow ?? TEXAS_LOW, high: options.texasHigh ?? TEXAS_HIGH }
}

/** Hrací HCP dvojice: podíl nižšího + podíl vyššího hracího HCP partnerů. */
export function texasHandicap(
  round: TournamentRound,
  players: PlayerId[],
  options: GameOptions,
): number {
  const { low, high } = texasShares(options)
  const hcps = players.map((id) => courseHandicapOf(round, id)).sort((a, b) => a - b)
  if (hcps.length === 0) return 0
  if (hcps.length === 1) return Math.round(hcps[0]! * (low + high))
  return Math.round(hcps[0]! * low + hcps[hcps.length - 1]! * high)
}

/** Rány, které dvojice dostává na jamce. */
export function texasStrokesAt(
  round: TournamentRound,
  players: PlayerId[],
  hole: number,
  options: GameOptions,
): number {
  const si = strokeIndexRanked(round)[hole] ?? hole + 1
  return strokesForHole(texasHandicap(round, players, options), si, holeCount(round))
}

/**
 * Brutto skóre dvojice na jamce: lepší ze zapsaných čísel partnerů,
 * `CONCEDED` když zvedli všichni zapsaní, `undefined` když nezapsal nikdo.
 */
export function texasGrossAt(
  round: TournamentRound,
  players: PlayerId[],
  hole: number,
): number | undefined {
  let best: number | undefined
  let picked = false
  for (const id of players) {
    const score = scoreAt(round, id, hole)
    if (score === undefined) continue
    if (score === PICKED_UP) {
      picked = true
      continue
    }
    best = best === undefined ? score : Math.min(best, score)
  }
  if (best !== undefined) return best
  return picked ? CONCEDED : undefined
}

function texasScorer(context: EvaluationContext, options: GameOptions): SideScorer {
  const { round } = context
  const netOf = (players: PlayerId[], hole: number, net: boolean) => {
    const gross = texasGrossAt(round, players, hole)
    if (gross === undefined || gross === CONCEDED || !net) return gross
    return gross - texasStrokesAt(round, players, hole, options)
  }
  return {
    stroke: netOf,
    counted: (players, hole, net) => {
      const value = netOf(players, hole, net)
      if (value !== CONCEDED) return value
      // Zvedla celá dvojice: rány podle centrálního pravidla turnaje.
      const strokes = texasStrokesAt(round, players, hole, options)
      const gross = pickupStrokes(context.pickup, parAt(round, hole), strokes)
      return net ? gross - strokes : gross
    },
  }
}

export const texasScramble: Evaluate = (context, game): EvaluationResult => {
  const { round } = context
  const format = game.options.format ?? 'match-play'
  const holes = gameHoles(round, game)
  const sides = matchSides(round, context.players)
  const scorer = texasScorer(context, game.options)
  const duels: DuelResult[] = []
  for (let i = 0; i + 1 < sides.length; i += 2) {
    duels.push(
      duelOf(
        context,
        `texas-${i / 2 + 1}`,
        [sides[i]!, sides[i + 1]!],
        holes,
        format,
        1,
        game.options.net ?? true,
        undefined,
        scorer,
      ),
    )
  }
  return finishDuels(game, duels, holes)
}
