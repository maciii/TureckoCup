import { describe, expect, it } from 'vitest'
import type { TournamentRound } from '../model/types'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { courseHandicapOf, strokesReceived } from '../model/round'
import { evaluateGame, evaluateRound, roundTeamPoints } from './index'
import { summarizeTournament } from './tournament'
import type { BonusConfig } from '../model/types'
import { DEFAULT_BONUS_CONFIG, availableBonuses } from '../model/bonuses'
import { bonusAwardsAt, bonusPointsAt, bonusSummary } from './bonuses'
import { stablefordAt } from './stableford'

/**
 * Evaluace nad reálnými daty prvního kola (Aspendos, bílá odpaliště)
 * a soupiskou ze specifikace. Hráči bez indexu hrají s nulou.
 */

function round1(): TournamentRound {
  const round = seedRounds()[0]!
  round.status = 'live'
  // Testy počítají s bílými odpališti (CR 70,5 / SR 130); turnaj hraje ze žlutých.
  round.defaultTeeId = 'white'
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
    // Jamka 1 (SI 4): ránu dostávají Ota, Pavlos, Ferry i Mac -> oba týmy netto 3, dělená.
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
    // Po jamkách pro zápis: jamky 1 a 2 bere Ota, jamka 3 čeká na Pavlose.
    expect(duel.holeWinners).toEqual({ '0': 0, '1': 0 })
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
    // Pozice 2: Mac (13) vs Ferry (9,4 -> 9): Mac dostává víc ran -> vyhrává.
    const duel2 = result.duels!.find((d) => d.position === 2)!
    expect(duel2.leader).toBe(0)
    // Jamkovka: rozhodnuté jamky mají vítěze nebo jsou dělené (po rozhodnutí
    // zápasu se už nehrají); Mac bere ty, kde dostává ránu navíc.
    expect(Object.keys(duel2.holeWinners!).length).toBeGreaterThan(0)
    expect(Object.values(duel2.holeWinners!)).toContain(0)
    expect(Object.values(duel1.holeWinners!).every((w) => w === null)).toBe(true)
    // Pozice 3 a 4: hráči bez indexu (0 ran) hrají stejně - remízy.
    expect(result.teamPoints).toEqual({ A: 2.5, B: 1.5 })
  })

  it('jamkovka s vypnutým Netto hraje brutto - stejné rány jsou remíza', () => {
    const round = round1()
    round.games[3]!.options.format = 'match-play'
    round.games[3]!.options.net = false
    const full = Array<number>(18).fill(4)
    for (const id of round.playerIds) enter(round, id, full)
    const result = evaluateGame(round, SEED_PLAYERS, round.games[3]!)
    expect(result.duels!.every((d) => d.leader === null && d.finished)).toBe(true)
    expect(result.teamPoints).toEqual({ A: 2, B: 2 })
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

  it('bilance pozic jmenuje hráče z každého kola, ne z aktuálního', () => {
    const rounds = seedRounds()
    rounds[0]!.status = 'finished'
    rounds[1]!.status = 'finished'
    // Ve druhém kole si tým A prohodí pozice 2 a 3.
    const [a1, a2, a3, a4] = rounds[1]!.positions.A
    rounds[1]!.positions.A = [a1!, a3!, a2!, a4!]
    for (const round of rounds.slice(0, 2)) {
      for (const id of round.playerIds) enter(round, id, Array<number>(18).fill(4))
    }
    const summary = summarizeTournament(rounds, SEED_PLAYERS)
    const position2 = summary.positions[1]!
    expect(position2.rounds).toBe(2)
    expect(position2.players.A).toEqual([a2, a3])
    expect(position2.players.B).toEqual([rounds[0]!.positions.B[1]])
  })
})

describe('zvednutá jamka ve hře na rány', () => {
  function duelRound(format: 'strokes-gross' | 'strokes-net') {
    const round = round1()
    round.games[3]!.options.format = format
    // Pozice 1: Ota (p3, A1) zvedl jedničku (par 4), Pavlos (p2, B1) zahrál par.
    round.scores.p3!['0'] = 0
    round.scores.p2!['0'] = 4
    return round
  }

  it('výchozí pravidlo je netto dvojbogey: brutto par + 2 + rány, netto par + 2', () => {
    const gross = evaluateGame(
      duelRound('strokes-gross'),
      SEED_PLAYERS,
      duelRound('strokes-gross').games[3]!,
    )
    const ota = gross.duels!.find((d) => d.position === 1)!.sides[0]!
    expect(ota.value).toBe(4 + 2 + strokesReceived(round1(), 'p3', 0))
    const net = evaluateGame(
      duelRound('strokes-net'),
      SEED_PLAYERS,
      duelRound('strokes-net').games[3]!,
    )
    expect(net.duels!.find((d) => d.position === 1)!.sides[0]!.value).toBe(6)
    expect(net.duels!.find((d) => d.position === 1)!.leader).toBe(1)
  })

  it('centrální pravidlo turnaje mění počet ran: 2 × par, 2 × par + 2, vlastní', () => {
    const round = duelRound('strokes-gross')
    const game = round.games[3]!
    const value = (rule: { timesPar: number; plus: number; addStrokes: boolean }) =>
      evaluateGame(round, SEED_PLAYERS, game, rule).duels!.find((d) => d.position === 1)!
        .sides[0]!.value
    expect(value({ timesPar: 2, plus: 0, addStrokes: false })).toBe(8)
    expect(value({ timesPar: 2, plus: 2, addStrokes: false })).toBe(10)
    expect(value({ timesPar: 1, plus: 3, addStrokes: false })).toBe(7)
    // Netto formát od brutto hodnoty odečte rány z handicapu.
    const net = duelRound('strokes-net')
    const strokes = strokesReceived(net, 'p3', 0)
    expect(
      evaluateGame(net, SEED_PLAYERS, net.games[3]!, {
        timesPar: 2,
        plus: 0,
        addStrokes: false,
      }).duels!.find((d) => d.position === 1)!.sides[0]!.value,
    ).toBe(8 - strokes)
  })

  it('jamkovku, Stableford ani Skins pravidlo nemění (zvednutí = prohraná jamka, nula)', () => {
    const round = duelRound('strokes-gross')
    round.games[3]!.options.format = 'match-play'
    const rule = { timesPar: 5, plus: 5, addStrokes: false }
    const match = evaluateGame(round, SEED_PLAYERS, round.games[3]!, rule)
    expect(match.duels!.find((d) => d.position === 1)!.leader).toBe(1)
    const stableford = evaluateGame(round, SEED_PLAYERS, round.games[0]!, rule)
    expect(stableford.rows.find((r) => r.id === 'p3')!.value).toBe(0)
  })
})

describe('extra body (centrální nastavení, vedlejší sázka v každém kole)', () => {
  const config = (): BonusConfig => ({
    ...DEFAULT_BONUS_CONFIG,
    values: { ...DEFAULT_BONUS_CONFIG.values, nearest: 2, birdie: 1, eagle: 3 },
    teamPerPoint: 0.5,
  })

  it('nearest na tříparové jamce, birdie z ran, potvrzení parem, násobič při birdie', () => {
    const round = round1()
    // Jamka 3 (index 2) je par 3: Mac birdie (2 rány) + nearest -> 2 + 1.
    round.scores.p1!['2'] = 2
    round.bonuses.p1!['2'] = ['nearest']
    // Jamka 1 (par 4): Pavlos sandie, ale bogey - bonus propadá.
    round.scores.p2!['0'] = 5
    round.bonuses.p2!['0'] = ['sandie']
    // Jamka 5 (index 4, par 5): Ferry eagle (3 rány) = jen eagle, ne birdie; sandie ×3.
    round.scores.p6!['4'] = 3
    round.bonuses.p6!['4'] = ['sandie']
    const summary = bonusSummary(round, SEED_PLAYERS, config())!
    const row = (id: string) => summary.rows.find((r) => r.id === id)!
    expect(row('p1').value).toBe(3)
    expect(row('p1').secondary).toBe(2)
    expect(row('p2').value).toBe(0)
    expect(row('p6').value).toBe(3 + 3)
    expect(summary.rows[0]!.id).toBe('p6')
    // Vedlejší sázka sama týmové body nedává - jdou přes hru s `options.bonuses`.
    expect(summary.teamPoints).toEqual({ A: 0, B: 0 })
    expect(bonusAwardsAt(round, config(), 'p2', 0)[0]).toMatchObject({
      void: true,
      points: 0,
    })
    // Sandie na par (jamka 2) platí jedenkrát.
    round.scores.p2!['1'] = 4
    round.bonuses.p2!['1'] = ['sandie']
    expect(bonusPointsAt(round, config(), 'p2', 1)).toBe(1)
  })

  it('longest drží jediný hráč; dva držitelé = nikdo, zvednutá jamka = nic, osobní par', () => {
    const round = round1()
    // Jamka 5 (index 4, par 5, SI 10): Mac (13 ran) má ránu -> bogey je osobní par.
    round.scores.p1!['4'] = 6
    round.scores.p3!['4'] = 5
    round.bonuses.p1!['4'] = ['longest']
    round.bonuses.p3!['4'] = ['longest']
    expect(bonusPointsAt(round, config(), 'p1', 4)).toBe(0)
    delete round.bonuses.p3!['4']
    expect(strokesReceived(round, 'p1', 4)).toBe(1)
    expect(bonusPointsAt(round, config(), 'p1', 4)).toBe(1)
    // Bez osobního paru je bogey nepotvrzený.
    expect(
      bonusPointsAt(round, { ...config(), longestByPersonalPar: false }, 'p1', 4),
    ).toBe(0)
    // Bez potvrzování platí i při dvojbogey.
    round.scores.p1!['4'] = 7
    expect(bonusPointsAt(round, { ...config(), confirmLongest: false }, 'p1', 4)).toBe(1)
    round.scores.p1!['4'] = 0
    expect(bonusPointsAt(round, { ...config(), confirmLongest: false }, 'p1', 4)).toBe(0)
    // Nezapsaná jamka: bonus čeká, nepočítá se.
    delete round.scores.p1!['4']
    expect(bonusAwardsAt(round, config(), 'p1', 4)[0]).toMatchObject({
      pending: true,
      points: 0,
    })
  })

  it('bonus s nulovou hodnotou se nenabízí ani nepočítá; bez bonusů žádná tabulka', () => {
    const round = round1()
    round.scores.p1!['0'] = 4
    round.bonuses.p1!['0'] = ['sandie']
    const off = { ...config(), values: { ...config().values, sandie: 0 } }
    expect(bonusPointsAt(round, off, 'p1', 0)).toBe(0)
    // Longest a Nearest se nabízejí i na paru 4 (jamka 1) - kde se hrají, rozhodne flight.
    expect(availableBonuses(off, round, 0).map((b) => b.id)).toEqual([
      'longest',
      'nearest',
      'water',
      'barkie',
      'arnie',
    ])
    expect(availableBonuses(config(), round, 4).map((b) => b.id)[0]).toBe('longest')
    const none = { ...config(), values: {} }
    expect(bonusSummary(round, SEED_PLAYERS, none)).toBeNull()
  })

  it('agregace: extra body do součtů jednotlivců a týmové body kola', () => {
    const round = round1()
    round.scores.p1!['2'] = 2
    const summary = summarizeTournament([round], SEED_PLAYERS, undefined, config())
    expect(summary.individuals.find((i) => i.id === 'p1')?.bonus).toBe(1)
    // Vedlejší sázka sama týmu nic nedává.
    expect(summary.rounds[0]!.teamPoints).toEqual({ A: 0, B: 0 })
    expect(roundTeamPoints([], summary.rounds[0]!.bonuses)).toEqual({ A: 0, B: 0 })
    // Do týmu jdou extra body přes hru, která je má zapnuté: sazba 0,5 b. za bod.
    const withGame = {
      ...round,
      games: round.games.map((g) =>
        g.kind === 'team-skins'
          ? { ...g, countsForTeam: true, options: { ...g.options, bonuses: true } }
          : g,
      ),
    }
    const summaryOn = summarizeTournament([withGame], SEED_PLAYERS, undefined, config())
    expect(summaryOn.rounds[0]!.teamPoints.A).toBe(0.5)
  })
})

describe('pevný hrací HCP po celý turnaj', () => {
  it('v pevném režimu je hrací HCP zaokrouhlený index bez ohledu na odpaliště', () => {
    const round = round1()
    round.handicapMode = 'fixed'
    expect(courseHandicapOf(round, 'p1')).toBe(13) // 12,7
    expect(courseHandicapOf(round, 'p6')).toBe(9) // 9,4
    round.defaultTeeId = 'yellow'
    expect(courseHandicapOf(round, 'p1')).toBe(13)
    // Ruční přepis má přednost, bez indexu nula.
    round.courseHandicapOverride.p1 = 11
    expect(courseHandicapOf(round, 'p1')).toBe(11)
    expect(courseHandicapOf(round, 'p4')).toBe(0)
    // Podle hřiště ze žlutých: 12,7 × 118/113 + (68,1 − 72) = 9,4 -> 9.
    delete round.courseHandicapOverride.p1
    round.handicapMode = 'course'
    expect(courseHandicapOf(round, 'p1')).toBe(9)
  })
})

describe('dvojité body na 9. a 18. jamce', () => {
  it('Stableford: body za devítku a osmnáctku ×2, ostatní jamky beze změny', () => {
    const round = round1()
    enter(round, 'p1', [4, null, null, null, null, null, null, null, 5])
    const options = { net: false, allowance: 1 }
    expect(stablefordAt(round, 'p1', 0, options)).toBe(2)
    expect(stablefordAt(round, 'p1', 8, options)).toBe(2)
    expect(stablefordAt(round, 'p1', 0, { ...options, doubleHoles: true })).toBe(2)
    expect(stablefordAt(round, 'p1', 8, { ...options, doubleHoles: true })).toBe(4)
    const result = evaluateGame(round, SEED_PLAYERS, {
      id: 's',
      kind: 'individual-stableford',
      options: { ...options, doubleHoles: true },
      countsForTeam: false,
      teamPoints: {},
    })
    expect(result.rows.find((r) => r.id === 'p1')!.value).toBe(6)
  })

  it('Skins: devítka je za dva skiny, i přes všech osm', () => {
    const round = round1()
    for (const id of round.playerIds) {
      round.scores[id]!['8'] = id === 'p1' ? 4 : 6
    }
    const result = evaluateGame(round, SEED_PLAYERS, {
      id: 'k',
      kind: 'individual-skins',
      options: { net: false, allowance: 1, scope: 'all', carry: true, doubleHoles: true },
      countsForTeam: false,
      teamPoints: {},
    })
    expect(result.rows.find((r) => r.id === 'p1')!.value).toBe(2)
    expect(result.holes.find((h) => h.hole === 8)!.value).toBe(2)
  })
})

describe('nepotvrzený Longest/Nearest jde soupeřům', () => {
  it('v týmové hře s extra body dostane sazbu druhý tým; vedlejší sázka ho jen škrtne', () => {
    const round = round1()
    const config = { ...DEFAULT_BONUS_CONFIG, teamPerPoint: 1 }
    // Mac (A) má na pětce (par 5) Longest, ale zahrál dvojbogey (má tam ránu, bogey by prošel).
    for (const id of round.playerIds) round.scores[id]!['4'] = 5
    round.scores.p1!['4'] = 7
    round.bonuses.p1!['4'] = ['longest']
    const award = bonusAwardsAt(round, config, 'p1', 4).find(
      (a) => a.bonus.id === 'longest',
    )!
    expect(award).toMatchObject({ void: true, forfeit: true, points: 0 })
    expect(bonusPointsAt(round, config, 'p1', 4)).toBe(0)
    expect(bonusSummary(round, SEED_PLAYERS, config)!.teamPoints).toEqual({ A: 0, B: 0 })
    const teamGame = {
      ...round.games.find((g) => g.kind === 'team-skins')!,
      countsForTeam: true,
      // Brutto, ať pětka dopadne remízou a jediný týmový bod je ten odevzdaný Longest.
      options: { allowance: 1, net: false, carry: true, bonuses: true },
    }
    expect(
      evaluateGame(round, SEED_PLAYERS, teamGame, undefined, config).teamPoints,
    ).toEqual({ A: 0, B: 1 })
    // Dva držitelé: nikomu nic, ani soupeřům.
    round.bonuses.p3!['4'] = ['longest']
    expect(
      bonusAwardsAt(round, config, 'p1', 4).find((a) => a.bonus.id === 'longest')!
        .forfeit,
    ).toBe(false)
  })
})
