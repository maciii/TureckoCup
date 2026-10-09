import { describe, expect, it } from 'vitest'
import type { GameConfig, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { evaluateGame } from './index'
import type { SidePoints } from './types'

/** Best + Součet nad prvním kolem: Ota + Mac (tým A) proti Pavlosovi + Ferrymu (B). */
function game(net = false): GameConfig {
  return {
    id: 'best',
    kind: 'best-aggregate',
    options: { allowance: 1, net },
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
  return round
}

function enter(round: TournamentRound, scores: Record<string, (number | null)[]>) {
  for (const [id, list] of Object.entries(scores)) {
    list.forEach((score, hole) => {
      if (score !== null) round.scores[id]![String(hole)] = score
    })
  }
}

describe('Best + Součet', () => {
  it('dá bod za lepší míč, za nižší součet a bonus za birdie; shoda nedá nic', () => {
    const round = round1()
    // Jamka 1 (par 4): A 4+5, B 3+5 -> B má lepší míč (3 < 4), nižší součet (8 < 9) a birdie.
    // Jamka 2 (par 4): A 4+4, B 5+3 -> lepší míč B (3), součet A (8 < 8? ne, 8 = 8 -> nikdo), birdie B.
    enter(round, { p3: [4, 4], p1: [5, 4], p2: [3, 5], p6: [5, 3] })
    const result = evaluateGame(round, SEED_PLAYERS, game())
    const duel = result.duels![0]!
    expect(duel.holePoints!['0']).toMatchObject([
      { best: 0, aggregate: 0, bonus: 0, total: 0, bestBall: 4, sum: 9 },
      { best: 1, aggregate: 1, bonus: 1, total: 3, bestBall: 3, sum: 8 },
    ])
    expect(duel.holePoints!['1']).toMatchObject([
      { best: 0, aggregate: 0, bonus: 0, total: 0 },
      { best: 1, aggregate: 0, bonus: 1, total: 2 },
    ])
    expect(duel.sides.map((s) => s.value)).toEqual([0, 5])
    expect(duel.notation).toBe('0 : 5')
    expect(duel.leader).toBe(1)
    expect(duel.holeWinners).toEqual({ '0': 1, '1': 1 })
    expect(duel.pending).toBe(16)
    expect(duel.finished).toBe(false)
    // Body do týmu až po dohrání.
    expect(result.teamPoints).toEqual({ A: 0, B: 0 })
  })

  it('jamka se počítá, až zapíší všichni čtyři; eagle dává tři body', () => {
    const round = round1()
    enter(round, { p3: [2], p1: [5], p2: [4] })
    expect(
      evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints!['0'],
    ).toBeUndefined()
    round.scores.p6!['0'] = 4
    const [a, b] = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints![
      '0'
    ]! as [SidePoints, SidePoints]
    expect(a).toMatchObject({ best: 1, aggregate: 1, bonus: 3, total: 5 })
    expect(b.total).toBe(0)
  })

  it('zvednutý míč je v lepším míči vzdaný a v součtu má rány podle pravidla turnaje', () => {
    const round = round1()
    // Ota zvedl, Mac 5; soupeři 5 a 5. Lepší míč A = 5 = B -> nikdo; součet A = pickup (par+2+rány) + 5.
    enter(round, { p3: [PICKED_UP], p1: [5], p2: [5], p6: [5] })
    const [a, b] = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints![
      '0'
    ]! as [SidePoints, SidePoints]
    expect(a.best).toBe(0)
    expect(b.best).toBe(0)
    expect(a.sum).toBeGreaterThan(10)
    expect(b).toMatchObject({ aggregate: 1, sum: 10 })
  })

  it('se zapnutými extra body se sandie partnera přičte k bodům dvojice', () => {
    const round = round1()
    enter(round, { p3: [4], p1: [4], p2: [4], p6: [4] })
    round.bonuses.p3!['0'] = ['sandie']
    const plain = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints!['0']!
    expect(plain[0]).toMatchObject({ extra: 0, total: 0 })
    const withExtra = { ...game(), options: { ...game().options, bonuses: true } }
    const [a, b] = evaluateGame(round, SEED_PLAYERS, withExtra).duels![0]!.holePoints![
      '0'
    ]! as [SidePoints, SidePoints]
    expect(a).toMatchObject({ extra: 1, total: 1 })
    expect(b.total).toBe(0)
  })

  it('Double Best: oba míče lepší než oba soupeřovy dají bod navíc, vzdaný míč ho zruší', () => {
    const round = round1()
    // A 3+4 proti B 5+6: A má best, součet i double best.
    enter(round, { p3: [3, 3], p1: [4, PICKED_UP], p2: [5, 5], p6: [6, 6] })
    const withDouble = { ...game(), options: { ...game().options, doubleBest: 1 } }
    const hp = evaluateGame(round, SEED_PLAYERS, withDouble).duels![0]!.holePoints!
    expect(hp['0']![0]).toMatchObject({
      best: 1,
      aggregate: 1,
      doubleBest: 1,
      bonus: 1,
      total: 4,
    })
    expect(hp['0']![1]!.total).toBe(0)
    // Jamka 2: Mac zvedl, A má jen lepší míč - Double Best ne.
    expect(hp['1']![0]!.doubleBest).toBe(0)
    expect(
      evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints!['0']![0]!
        .doubleBest,
    ).toBe(0)
  })

  it('po dohrání dává vítězná dvojice bod týmu, remíza půl', () => {
    const round = round1()
    // Všichni par na každé jamce (pary hřiště, ne pořád 4 - na par 5 by to bylo birdie).
    const par = round.course.pars.slice(0, 18)
    enter(round, { p3: par, p1: par, p2: par, p6: par })
    const tie = evaluateGame(round, SEED_PLAYERS, game())
    expect(tie.duels![0]!.finished).toBe(true)
    expect(tie.teamPoints).toEqual({ A: 0.5, B: 0.5 })
    round.scores.p3!['0'] = 3
    const won = evaluateGame(round, SEED_PLAYERS, game())
    expect(won.duels![0]!.notation).toBe('3 : 0')
    expect(won.teamPoints).toEqual({ A: 1, B: 0 })
  })

  it('dvojité body na 9. a 18. jamce násobí vše, co dvojice na jamce získala', () => {
    const round = round1()
    // Jamka 9 (index 8, par 5): B lepší míč 4 < 5, nižší součet 10 < 11 a birdie.
    for (const [id, score] of Object.entries({ p3: 5, p1: 6, p2: 4, p6: 6 })) {
      round.scores[id]!['8'] = score
      round.scores[id]!['0'] = score
    }
    const plain = evaluateGame(round, SEED_PLAYERS, game()).duels![0]!
    expect(plain.holePoints!['8']![1]).toMatchObject({
      best: 1,
      aggregate: 1,
      bonus: 1,
      total: 3,
    })
    const doubled = evaluateGame(round, SEED_PLAYERS, {
      ...game(),
      options: { ...game().options, doubleHoles: true, doubleBest: 1 },
    }).duels![0]!
    // Double Best (6 > 4? ne: horší míč B je 6, lepší míč A 5 -> žádný double) - jen trojnásobek bodů ×2.
    expect(doubled.holePoints!['8']![1]).toMatchObject({
      best: 2,
      aggregate: 2,
      bonus: 2,
      doubleBest: 0,
      total: 6,
    })
    // Jamka 1 (par 4, čtyřka není birdie) zůstává jednoduchá: Best + Součet = 2.
    expect(doubled.holePoints!['0']![1]!.total).toBe(2)
    expect(doubled.sides.map((s) => s.value)).toEqual([0, 8])
  })

  it('nepotvrzený Longest partnera dá bod soupeřům, potvrzený vlastní dvojici', () => {
    const round = round1()
    // Jamka 5 (index 4, par 5): všichni par, Mac (A) drží Longest.
    enter(round, {
      p3: [5, 5, 5, 5, 5],
      p1: [5, 5, 5, 5, 5],
      p2: [5, 5, 5, 5, 5],
      p6: [5, 5, 5, 5, 5],
    })
    round.bonuses.p1!['4'] = ['longest']
    const withExtra = { ...game(), options: { ...game().options, bonuses: true } }
    let hp = evaluateGame(round, SEED_PLAYERS, withExtra).duels![0]!.holePoints!['4']!
    expect(hp[0]).toMatchObject({ extra: 1, total: 1 })
    expect(hp[1]).toMatchObject({ extra: 0, total: 0 })
    // Mac má na pětce ránu z HCP, bogey je jeho osobní par; dvojbogey už Longest nepotvrdí
    // a bod jde dvojici B.
    round.scores.p1!['4'] = 7
    hp = evaluateGame(round, SEED_PLAYERS, withExtra).duels![0]!.holePoints!['4']!
    expect(hp[0]).toMatchObject({ extra: 0 })
    expect(hp[1]).toMatchObject({ extra: 1 })
    // Zvednutá jamka: také soupeřům.
    round.scores.p1!['4'] = PICKED_UP
    hp = evaluateGame(round, SEED_PLAYERS, withExtra).duels![0]!.holePoints!['4']!
    expect(hp[1]!.extra).toBe(1)
    // Bez extra bodů ve hře se nic nepřelévá.
    expect(
      evaluateGame(round, SEED_PLAYERS, game()).duels![0]!.holePoints!['4']![1]!.extra,
    ).toBe(0)
  })
})
