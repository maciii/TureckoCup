import { describe, expect, it } from 'vitest'
import type { GameConfig, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { courseHandicapOf, parAt } from '../model/round'
import { evaluateGame } from './index'
import { texasGrossAt, texasHandicap, texasStrokesAt } from './texas'

/**
 * Texas scramble nad prvním kolem seedu: v prvním flightu Ota + Mac (tým A)
 * proti Pavlosovi + Ferrymu (tým B). Skóre dvojice se zapisuje oběma partnerům.
 */
const A = ['p3', 'p1']
const B = ['p2', 'p6']

function game(options: Partial<GameConfig['options']> = {}): GameConfig {
  return {
    id: 'texas',
    kind: 'texas-scramble',
    options: { allowance: 1, net: false, format: 'match-play', ...options },
    countsForTeam: true,
    teamPoints: { win: 1, halve: 0.5 },
  }
}

function round1(): TournamentRound {
  const round = seedRounds()[0]!
  round.status = 'live'
  return round
}

/** Skóre dvojice na jamkách (oběma partnerům stejně, `null` = nezapsáno). */
function pair(round: TournamentRound, ids: string[], scores: (number | null)[]) {
  for (const id of ids)
    scores.forEach((score, hole) => {
      if (score !== null) round.scores[id]![String(hole)] = score
    })
}

function evaluate(round: TournamentRound, g = game()) {
  return evaluateGame(round, SEED_PLAYERS, g)
}

describe('Texas scramble dvojic', () => {
  it('hrací HCP dvojice je 35 % nižšího + 15 % vyššího, podíly jdou změnit', () => {
    const round = round1()
    const [low, high] = A.map((id) => courseHandicapOf(round, id)).sort((a, b) => a - b)
    expect(texasHandicap(round, A, game().options)).toBe(
      Math.round(low! * 0.35 + high! * 0.15),
    )
    expect(texasHandicap(round, A, game({ texasLow: 0.5, texasHigh: 0.5 }).options)).toBe(
      Math.round((low! + high!) / 2),
    )
  })

  it('jamkovka brutto: dvojice proti dvojici z flightu, jedno skóre na jamku', () => {
    const round = round1()
    pair(round, A, [4, 4, 5])
    pair(round, B, [5, 4, 4])
    const duel = evaluate(round).duels!.find((d) =>
      d.sides.some((s) => s.players.includes('p3')),
    )!
    expect(duel.sides.map((s) => s.players)).toEqual([A, B])
    expect(duel.holeWinners).toEqual({ '0': 0, '1': null, '2': 1 })
    expect(duel.notation).toBe('AS')
  })

  it('stačí zápis jednoho partnera; při rozdílu platí lepší číslo', () => {
    const round = round1()
    round.scores.p3!['0'] = 4
    round.scores.p2!['0'] = 5
    round.scores.p6!['0'] = 3
    expect(texasGrossAt(round, A, 0)).toBe(4)
    expect(texasGrossAt(round, B, 0)).toBe(3)
    const duel = evaluate(round).duels![0]!
    expect(duel.holeWinners?.['0']).toBe(1)
  })

  it('zvednutá jamka platí, jen když nikdo z dvojice nemá číslo', () => {
    const round = round1()
    pair(round, A, [PICKED_UP])
    pair(round, B, [6])
    const duel = evaluate(round).duels![0]!
    expect(duel.holeWinners?.['0']).toBe(1)
    round.scores.p1!['0'] = 5
    expect(texasGrossAt(round, A, 0)).toBe(5)
  })

  it('netto rány: od skóre dvojice se odečtou rány z HCP dvojice', () => {
    const round = round1()
    pair(round, A, [5])
    pair(round, B, [5])
    const result = evaluate(round, game({ format: 'strokes-net', net: true }))
    const duel = result.duels![0]!
    expect(duel.sides[0]!.value).toBe(5 - texasStrokesAt(round, A, 0, game().options))
    expect(duel.sides[1]!.value).toBe(5 - texasStrokesAt(round, B, 0, game().options))
  })

  it('dohraný zápas dává body týmu za výhru', () => {
    const round = round1()
    const holes = round.course.holeCount
    const par = Array.from({ length: holes }, (_, h) => parAt(round, h))
    pair(
      round,
      A,
      par.map((p) => p - 1),
    )
    pair(round, B, par)
    // Druhý flight dohraje vyrovnaně, ať je kolo kompletní.
    const second = round.flights[1]!.players
    pair(round, second, par)
    const result = evaluate(round)
    const duel = result.duels![0]!
    expect(duel.finished).toBe(true)
    expect(duel.leader).toBe(0)
    expect(result.teamPoints.A).toBeGreaterThanOrEqual(1)
  })
})
