import { describe, expect, it } from 'vitest'
import type { GameConfig, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { evaluateGame } from './index'
import { allowedDoublers } from './fourBallSkins'

/**
 * Four-ball Skins nad prvním kolem, brutto (bez ran z HCP, ať jsou čísla
 * čitelná): Ota + Mac (A) proti Pavlosovi + Ferrymu (B) v prvním flightu.
 */
function game(options: Partial<GameConfig['options']> = {}): GameConfig {
  return {
    id: 'fbs',
    kind: 'four-ball-skins',
    options: { allowance: 1, net: false, carry: true, ...options },
    countsForTeam: true,
    teamPoints: { win: 1, halve: 0.5 },
    sides: [
      { id: 'a', players: ['p3', 'p1'] },
      { id: 'b', players: ['p2', 'p6'] },
    ],
  }
}

function round1(): TournamentRound {
  const round = seedRounds()[0]!
  round.status = 'live'
  round.doubles = Object.fromEntries(round.playerIds.map((id) => [id, {}]))
  return round
}

function enter(round: TournamentRound, scores: Record<string, (number | null)[]>) {
  for (const [id, list] of Object.entries(scores)) {
    list.forEach((score, hole) => {
      if (score !== null) round.scores[id]![String(hole)] = score
    })
  }
}

describe('Four-ball Skins', () => {
  it('skin za lepší míč, dělená jamka přenáší, zápas je součet skinů', () => {
    const round = round1()
    // Jamka 1: A 4/5 vs B 5/5 -> A. Jamka 2: 4/4 vs 4/5 -> dělená, přenos.
    // Jamka 3: A 5/5 vs B 4/6 -> B bere 2.
    enter(round, { p3: [4, 4, 5], p1: [5, 4, 5], p2: [5, 4, 4], p6: [5, 5, 6] })
    const result = evaluateGame(round, SEED_PLAYERS, game())
    const duel = result.duels![0]!
    expect(duel.sides.map((s) => s.value)).toEqual([1, 2])
    expect(duel.notation).toBe('1 : 2')
    expect(duel.leader).toBe(1)
    expect(duel.holeWinners).toEqual({ '0': 0, '1': null, '2': 1 })
    expect(duel.stakes).toMatchObject({ '0': 1, '1': 1, '2': 2, '3': 1 })
    expect(duel.holeSkins).toEqual({ '0': 1, '1': 0, '2': 2 })
    expect(duel.holeCarry).toMatchObject({ '0': 0, '1': 1, '2': 0, '3': 0 })
    expect(duel.pending).toBe(15)
    expect(duel.finished).toBe(false)
    expect(result.holes.find((h) => h.hole === 2)).toMatchObject({
      decided: true,
      winners: ['p2', 'p6'],
      value: 2,
      carry: 0,
    })
    // Nedohraný zápas týmu nic nedává.
    expect(result.teamPoints).toEqual({ A: 0, B: 0 })
  })

  it('double prohrávající dvojice: jamka za dva skiny, bank se přičte, dvojitá jamka za čtyři', () => {
    const round = round1()
    enter(round, { p3: [4, 4, 4], p1: [5, 5, 5], p2: [5, 3, 4], p6: [5, 5, 5] })
    // Po jamce 1 vede A 1:0; na dvojce smí dublovat jen B.
    round.doubles!.p2!['1'] = ['fbs']
    let duel = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    expect(duel.mayDouble!['0']).toEqual([])
    expect(duel.mayDouble!['1']).toEqual([1])
    expect(duel.doubles!['1']).toEqual([1])
    expect(duel.stakes!['1']).toBe(2)
    expect(duel.sides.map((s) => s.value)).toEqual([1, 2])
    // Double u vedoucí dvojice se nepočítá (jen záznam, vyhodnocení ho ignoruje).
    round.doubles!.p2!['1'] = []
    round.doubles!.p3!['1'] = ['fbs']
    duel = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    expect(duel.doubles!['1']).toEqual([])
    expect(duel.sides.map((s) => s.value)).toEqual([1, 1])
    // Double na dělené jamce přenáší dva; dvojitá devítka s double je za čtyři.
    const carry = round1()
    enter(carry, { p3: [4, 4], p1: [5, 5], p2: [5, 4], p6: [5, 5] })
    carry.doubles!.p2!['1'] = ['fbs']
    const carried = evaluateGame(carry, SEED_PLAYERS, game()).duels![0]!
    expect(carried.stakes!['2']).toBe(3)
    // Dvojitá devítka s double je za čtyři (+ bank sedmi dělených jamek).
    const nine = round1()
    for (let hole = 0; hole < 9; hole++)
      for (const id of ['p3', 'p1', 'p2', 'p6'])
        nine.scores[id]![String(hole)] = id === 'p3' && (hole === 0 || hole === 8) ? 4 : 5
    nine.doubles!.p6!['8'] = ['fbs']
    const doubled = evaluateGame(nine, SEED_PLAYERS, game({ doubleHoles: true }))
      .duels![0]!
    expect(doubled.stakes!['8']).toBe(7 + 4)
    expect(doubled.holeSkins!['8']).toBe(11)
  })

  it('kdo smí dublovat podle nastavení hry', () => {
    const behind = { totals: [2, 1], carry: 0, lastWinner: 0 }
    expect(allowedDoublers('behind', behind)).toEqual([1])
    expect(allowedDoublers('behind', { ...behind, totals: [1, 1] })).toEqual([])
    expect(allowedDoublers('lastLoser', behind)).toEqual([1])
    expect(allowedDoublers('lastLoser', { ...behind, lastWinner: null })).toEqual([])
    expect(allowedDoublers('anyone', behind)).toEqual([0, 1])
    expect(allowedDoublers('off', behind)).toEqual([])
    // Double bez oprávnění (nastavení „nikdo“) hru nezmění.
    const round = round1()
    enter(round, { p3: [4], p1: [5], p2: [5], p6: [5] })
    round.doubles!.p2!['0'] = ['fbs']
    round.doubles!.p3!['0'] = ['fbs']
    // „Kdokoli“ a double obou: každý zdvojnásobí, jamka je ×4.
    const both = evaluateGame(round, SEED_PLAYERS, game({ doubleBy: 'anyone' }))
      .duels![0]!
    expect(both.doubles!['0']).toEqual([0, 1])
    expect(both.stakes!['0']).toBe(4)
    expect(
      evaluateGame(round, SEED_PLAYERS, game({ doubleBy: 'off' })).duels![0]!.stakes![
        '0'
      ],
    ).toBe(1)
  })

  it('po dohrání bere vítěz zápasu bod do týmu, remíza půl - za každý zápas zvlášť', () => {
    const round = round1()
    const [f0, f1] = round.flights
    const sides = [
      { id: 'a1', players: f0!.players.slice(0, 2) },
      { id: 'b1', players: f0!.players.slice(2, 4) },
      { id: 'a2', players: f1!.players.slice(0, 2) },
      { id: 'b2', players: f1!.players.slice(2, 4) },
    ]
    // Všichni par na všech jamkách: oba zápasy 0:0 -> remízy, 0,5 + 0,5 pro oba týmy.
    for (const id of round.playerIds)
      for (let hole = 0; hole < 18; hole++)
        round.scores[id]![String(hole)] = round.course.pars[hole]!
    const tied = evaluateGame(round, SEED_PLAYERS, { ...game(), sides })
    expect(tied.duels!.every((d) => d.finished)).toBe(true)
    expect(tied.teamPoints).toEqual({ A: 1, B: 1 })
    // První dvojice flightu 1 vezme osmnáctku: zápas 1 vyhrává A (18 skinů z banku), zápas 2 remíza.
    round.scores[f0!.players[0]!]!['17'] = round.course.pars[17]! - 1
    const won = evaluateGame(round, SEED_PLAYERS, { ...game(), sides })
    expect(won.duels![0]!.notation).toBe('18 : 0')
    expect(won.teamPoints).toEqual({ A: 1.5, B: 0.5 })
  })

  it('bod navíc za každé birdie partnerů jde do skóre zápasu vedle skinů', () => {
    const round = round1()
    // Jamka 1 (par 4): Ota birdie 3, Mac 5; B 4/4 -> A bere skin a birdie bod.
    // Jamka 2 (par 4): A 4/4, B 3/3 -> B bere skin + dva birdie body.
    enter(round, { p3: [3, 4], p1: [5, 4], p2: [4, 3], p6: [4, 3] })
    const plain = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    expect(plain.sides.map((s) => s.value)).toEqual([1, 1])
    expect(plain.birdies).toBeUndefined()
    const bonus = evaluateGame(round, SEED_PLAYERS, game({ birdieBonus: true }))
      .duels![0]!
    expect(bonus.birdies).toEqual({ '0': [1, 0], '1': [0, 2] })
    expect(bonus.sides.map((s) => s.value)).toEqual([2, 3])
    expect(bonus.notation).toBe('2 : 3')
    expect(bonus.leader).toBe(1)
    // Birdie se počítá hned po zápisu rány, i když soupeř ještě nezapsal; zvednutá jamka ne.
    // Trojka (par 3): Ota dvojka je birdie.
    round.scores.p3!['2'] = 2
    round.scores.p1!['2'] = PICKED_UP
    expect(
      evaluateGame(round, SEED_PLAYERS, game({ birdieBonus: true })).duels![0]!.birdies![
        '2'
      ],
    ).toEqual([1, 0])
  })

  it('prohrávající se počítá ze skóre zápasu včetně bodů za birdie', () => {
    const round = round1()
    // Jamka 1: B bere skin (4 vs 5), A má dvě birdie? Ne - A 5/5. Jamka 1: A 3/3 (dvě birdie,
    // par 4) proti B 3/4: lepší míč shodný -> dělená, A vede 2:0 jen body za birdie.
    enter(round, { p3: [3, 4], p1: [3, 4], p2: [3, 4], p6: [4, 4] })
    const duel = evaluateGame(round, SEED_PLAYERS, game({ birdieBonus: true })).duels![0]!
    expect(duel.sides.map((s) => s.value)).toEqual([2, 1])
    // Na dvojce prohrává B (1 : 2 ve skóre), smí dublovat jen B.
    expect(duel.mayDouble!['1']).toEqual([1])
  })

  it('jamky za první nezapsanou čekají: bank ani double se za ni nepočítají', () => {
    const round = round1()
    // Dvojka chybí Macovi; trojka je zapsaná celá.
    enter(round, { p3: [4, 4, 4], p1: [5, null, 5], p2: [5, 5, 5], p6: [5, 5, 5] })
    round.doubles!.p2!['2'] = ['fbs']
    const duel = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    expect(duel.waitingHole).toBe(1)
    expect(duel.holeSkins).toEqual({ '0': 1 })
    expect(duel.stakes!['2']).toBeUndefined()
    expect(duel.mayDouble!['2']).toBeUndefined()
    expect(duel.pending).toBe(17)
    expect(duel.sides.map((s) => s.value)).toEqual([1, 0])
    // Po doplnění dvojky (A ji bere) se trojka vyhodnotí: B prohrává 0:2, jeho double platí.
    round.scores.p1!['1'] = 5
    const after = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    // Další nezapsaná je čtyřka.
    expect(after.waitingHole).toBe(3)
    expect(after.mayDouble!['2']).toEqual([1])
    expect(after.stakes!['2']).toBe(2)
    expect(after.holeSkins!['2']).toBe(2)
  })
})
