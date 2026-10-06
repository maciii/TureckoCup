import { describe, expect, it } from 'vitest'
import type { TournamentRound } from '../model/types'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { courseHandicapOf, strokesReceived } from '../model/round'
import { evaluateGame, evaluateRound, roundTeamPoints } from './index'
import { summarizeTournament } from './tournament'

/**
 * Evaluace nad reálnými daty prvního kola (Aspendos, bílá odpaliště)
 * a soupiskou ze specifikace. Hráči bez indexu hrají s nulou.
 */

function round1(): TournamentRound {
  const round = seedRounds()[0]!
  round.status = 'live'
  return round
}

function enter(round: TournamentRound, playerId: string, scores: (number | null)[]) {
  scores.forEach((score, hole) => {
    if (score !== null) round.scores[playerId]![String(hole)] = score
  })
}

describe('hrací handicapy ze snímku hřiště', () => {
  it('Mac 12,7 z bílých na Aspendosu dostává 13 ran', () => {
    const round = round1()
    expect(courseHandicapOf(round, 'p1')).toBe(13)
    // SI 15 (jamka 15) je nejtěžší - tam ránu dostane; SI 18 (jamka 3) ne.
    expect(strokesReceived(round, 'p1', 14)).toBe(1)
    expect(strokesReceived(round, 'p1', 2)).toBe(0)
  })

  it('ruční přepis má přednost a hráč bez indexu má nulu', () => {
    const round = round1()
    round.courseHandicapOverride.p1 = 10
    expect(courseHandicapOf(round, 'p1')).toBe(10)
    expect(courseHandicapOf(round, 'p4')).toBe(0)
  })
})

describe('Stableford', () => {
  it('počítá netto body a zvednutou jamku jako nulu', () => {
    const round = round1()
    // Jamka 15 (index 14, par 4, SI 1): Mac 5 ran = netto par = 2 body.
    enter(round, 'p1', [
      4,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      5,
    ])
    round.scores.p1!['2'] = 0 // jamka 3 zvednutá
    const result = evaluateGame(round, SEED_PLAYERS, round.games[0]!)
    const mac = result.rows.find((r) => r.id === 'p1')!
    // Jamka 1 (SI 4, Mac má ránu): 4 = netto birdie = 3 body; jamka 15 (SI 1):
    // 5 = netto par = 2 body; zvednutá jamka 0 bodů.
    expect(mac.value).toBe(5)
    expect(mac.holes).toBe(3)
    expect(mac.secondary).toBe(9) // zvednutá jamka se do ran nepočítá
  })
})

describe('Skins ve flightu', () => {
  it('jamka se rozhodne, až zapíše celý flight', () => {
    const round = round1()
    const [flight] = round.flights
    const [a, b, c, d] = flight!.players as [string, string, string, string]
    enter(round, a, [3])
    enter(round, b, [5])
    enter(round, c, [5])
    let result = evaluateGame(round, SEED_PLAYERS, round.games[1]!)
    expect(result.holes.find((h) => h.hole === 0)?.decided).toBe(false)
    expect(result.rows.find((r) => r.id === a)?.value).toBe(0)

    enter(round, d, [5])
    result = evaluateGame(round, SEED_PLAYERS, round.games[1]!)
    expect(result.holes.find((h) => h.hole === 0)?.decided).toBe(true)
    expect(result.rows.find((r) => r.id === a)?.value).toBe(1)
  })
})

describe('Team Skins', () => {
  it('jamka čeká na druhý flight a tým bere skin lepším míčem', () => {
    const round = round1()
    const first = round.flights[0]!.players
    const second = round.flights[1]!.players
    // Flight 1 dohrál jamku 1: nejlepší je A1 (p3 Ota) s 3 ranami.
    enter(round, 'p3', [3])
    for (const id of first.filter((p) => p !== 'p3')) enter(round, id, [5])
    let result = evaluateGame(round, SEED_PLAYERS, round.games[2]!)
    expect(result.holes[0]?.decided).toBe(false)
    expect(result.teamPoints).toEqual({ A: 0, B: 0 })

    for (const id of second) enter(round, id, [6])
    result = evaluateGame(round, SEED_PLAYERS, round.games[2]!)
    expect(result.holes[0]?.decided).toBe(true)
    expect(result.holes[0]?.winners).toContain('p3')
    expect(result.teamPoints).toEqual({ A: 1, B: 0 })
    expect(roundTeamPoints(evaluateRound(round, SEED_PLAYERS))).toEqual({ A: 1, B: 0 })
  })

  it('dělená jamka přenáší skin', () => {
    const round = round1()
    for (const id of round.playerIds) enter(round, id, [4, 4])
    // Jamka 1 (SI 4): ránu dostávají Ota, Pavlos, Fery i Mac -> oba týmy netto 3, dělená.
    // Jamka 2 (SI 16): nikdo ránu nemá; Mac zahraje 3 a bere i přenesený skin.
    round.scores.p1!['1'] = 3
    const result = evaluateGame(round, SEED_PLAYERS, round.games[2]!)
    expect(result.holes[0]?.winners).toEqual([])
    expect(result.holes[0]?.carry).toBe(1)
    expect(result.holes[1]?.winners).toContain('p1')
    expect(result.holes[1]?.value).toBe(2)
    expect(result.rows.find((r) => r.id === 'A')?.value).toBe(2)
  })
})

describe('duely pozic', () => {
  it('netto rány rozhodují a porovnává se jen přes společné jamky', () => {
    const round = round1()
    // A1 = p3 (Ota, HCP 7 -> z bílých 7×130/113−1,5 = 6,55 -> 7), B1 = p2 (Pavlos 7,6 -> 7).
    enter(round, 'p3', [4, 4, 4])
    enter(round, 'p2', [5, 5])
    const result = evaluateGame(round, SEED_PLAYERS, round.games[3]!)
    const duel = result.duels!.find((d) => d.position === 1)!
    expect(duel.leader).toBe(0)
    expect(duel.pending).toBe(16)
    expect(duel.finished).toBe(false)
    expect(result.teamPoints).toEqual({ A: 0, B: 0 })
  })

  it('jamkovka pozic dává bod za vyhraný duel po dohrání', () => {
    const round = round1()
    round.games[3]!.options.format = 'match-play'
    const full = Array<number>(18).fill(4)
    for (const id of round.playerIds) enter(round, id, full)
    // Pozice 1: Ota (7 ran) vs Pavlos (7 ran) - stejné rány, remíza.
    const result = evaluateGame(round, SEED_PLAYERS, round.games[3]!)
    const duel1 = result.duels!.find((d) => d.position === 1)!
    expect(duel1.finished).toBe(true)
    expect(duel1.leader).toBeNull()
    // Pozice 2: Mac (13) vs Fery (9,4 -> 9): Mac dostává víc ran -> vyhrává.
    const duel2 = result.duels!.find((d) => d.position === 2)!
    expect(duel2.leader).toBe(0)
    // Pozice 3 a 4: hráči bez indexu (0 ran) hrají stejně - remízy.
    expect(result.teamPoints).toEqual({ A: 2.5, B: 1.5 })
  })
})

describe('agregace turnaje', () => {
  it('sčítá týmové body a Stableford přes kola, plánovaná kola vynechává', () => {
    const rounds = seedRounds()
    rounds[0]!.status = 'finished'
    rounds[1]!.status = 'live'
    for (const round of rounds.slice(0, 2)) {
      for (const id of round.playerIds) enter(round, id, Array<number>(18).fill(4))
    }
    const summary = summarizeTournament(rounds, SEED_PLAYERS)
    expect(summary.rounds).toHaveLength(2)
    expect(summary.provisional).toBe(true)
    const mac = summary.individuals.find((i) => i.id === 'p1')!
    expect(mac.rounds).toBe(2)
    expect(mac.stableford).toBeGreaterThan(0)
    expect(summary.teamPoints.A + summary.teamPoints.B).toBeGreaterThan(0)
  })
})
