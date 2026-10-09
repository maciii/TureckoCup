import { describe, expect, it } from 'vitest'
import { findInvalidValue } from '../data/ops'
import { assignPosition, normalizePositions, playOrder } from './round'
import { seedRounds } from '../data/seed'

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

  it('bez hry se stranami drží pořadí flightu', () => {
    expect(playOrder(round, flight)).toEqual(flight.players)
  })

  it('podle dvojic hry: partneři pod sebou, hráč mimo strany na konci', () => {
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
          // Dvojice napříč: A1 + B2 proti B1 + A2 (jako Mac + Honza vs Ferry + Soldík).
          sides: [
            { id: 's1', players: [a1, b2] },
            { id: 's2', players: [b1, a2] },
          ],
        },
      ],
    }
    expect(playOrder(sided, flight)).toEqual([a1, b2, b1, a2])
    // Druhý flight nemá ve stranách nikoho - zůstává v pořadí flightu.
    expect(playOrder(sided, round.flights[1]!)).toEqual(round.flights[1]!.players)
    // Hráč, kterého strany nezmiňují, jde na konec.
    const partial = {
      ...sided,
      games: [{ ...sided.games.at(-1)!, sides: [{ id: 's1', players: [b2, a1] }] }],
    }
    expect(playOrder(partial, flight)).toEqual([b2, a1, a2, b1])
  })
})
