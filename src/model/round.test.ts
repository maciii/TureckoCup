import { describe, expect, it } from 'vitest'
import { findInvalidValue } from '../data/ops'
import {
  assignPosition,
  flightPairs,
  matchSides,
  normalizePositions,
  playOrder,
} from './round'
import { SEED_PLAYERS, seedRounds } from '../data/seed'

describe('assignPosition', () => {
  it('doplní prázdné pozice, nikdy nenechá díru v poli', () => {
    const list = assignPosition([], 2, 'p3')
    expect(list).toEqual(['', '', 'p3', ''])
    expect(findInvalidValue(list)).toBeNull()
  })

  it('zachová ostatní pozice', () => {
    expect(assignPosition(['p1', 'p2', 'p3', 'p4'], 1, 'p5')).toEqual([
      'p1',
      'p5',
      'p3',
      'p4',
    ])
  })

  it('hráč z jiné pozice se prohodí s původním', () => {
    expect(assignPosition(['p1', 'p2', 'p3', 'p4'], 0, 'p3')).toEqual([
      'p3',
      'p2',
      'p1',
      'p4',
    ])
  })

  it('pomlčka pozici vyprázdní', () => {
    expect(assignPosition(['p1', 'p2'], 1, '')).toEqual(['p1', '', '', ''])
  })

  it('poškozená data (null, kratší pole) opraví', () => {
    expect(assignPosition([null, undefined, 'p3'], 3, 'p4')).toEqual(['', '', 'p3', 'p4'])
  })
})

describe('normalizePositions', () => {
  it('vrátí vždy čtyři místa bez děr', () => {
    expect(normalizePositions(undefined)).toEqual(['', '', '', ''])
    expect(normalizePositions(['p1'])).toEqual(['p1', '', '', ''])
  })
})

describe('playOrder', () => {
  const round = seedRounds()[0]!
  const flight = round.flights[0]!
  const [a1, a2, b1, b2] = flight.players as [string, string, string, string]
  const sided = {
    ...round,
    games: [
      ...round.games,
      {
        id: 'best',
        kind: 'best-aggregate' as const,
        options: { allowance: 1, net: true },
        countsForTeam: true,
        teamPoints: { win: 1, halve: 0.5 },
      },
    ],
  }

  it('bez hry dvojic drží pořadí flightu', () => {
    const mixed = { ...flight, players: [a1, b1, a2, b2] }
    expect(playOrder(round, mixed, SEED_PLAYERS)).toEqual([a1, b1, a2, b2])
  })

  it('s hrou dvojic partneři pod sebou: tým A, pak tým B, bez týmu na konec', () => {
    const mixed = { ...flight, players: [a1, b1, a2, b2] }
    expect(playOrder(sided, mixed, SEED_PLAYERS)).toEqual([a1, a2, b1, b2])
    const stranger = { ...flight, players: [b1, 'px', a1] }
    expect(playOrder(sided, stranger, SEED_PLAYERS)).toEqual([a1, b1, 'px'])
  })
})

describe('flightPairs', () => {
  const round = seedRounds()[0]!

  it('dvojice jsou dva hráči téhož týmu ve flightu, tým A vlevo', () => {
    const pairs = flightPairs(round, SEED_PLAYERS)
    expect(pairs).toHaveLength(2)
    expect(pairs[0]!.valid).toBe(true)
    expect(pairs[0]!.sides![0]).toEqual({
      id: 'f0a',
      players: round.flights[0]!.players.slice(0, 2),
    })
    expect(pairs[0]!.sides![1]).toEqual({
      id: 'f0b',
      players: round.flights[0]!.players.slice(2, 4),
    })
    expect(matchSides(round, SEED_PLAYERS).map((s) => s.id)).toEqual([
      'f0a',
      'f0b',
      'f1a',
      'f1b',
    ])
  })

  it('flight bez dvou a dvou hráčů zápas nemá', () => {
    const [a1, a2, b1, b2] = round.flights[0]!.players
    const [a3] = round.flights[1]!.players
    const odd = {
      ...round,
      flights: [
        { ...round.flights[0]!, players: [a1!, a2!, a3!, b1!] },
        { ...round.flights[1]!, players: [b2!] },
      ],
    }
    const pairs = flightPairs(odd, SEED_PLAYERS)
    expect(pairs.map((p) => p.valid)).toEqual([false, false])
    expect(pairs[0]!.byTeam).toEqual({ A: [a1, a2, a3], B: [b1] })
    expect(matchSides(odd, SEED_PLAYERS)).toEqual([])
  })
})
