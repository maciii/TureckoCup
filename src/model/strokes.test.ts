import { describe, expect, it } from 'vitest'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import {
  compareStrokes,
  flightCompany,
  flightHasHandicaps,
  roundAllowance,
} from './strokes'
import { playingHandicap, strokesReceived } from './round'

const players = SEED_PLAYERS
const round = seedRounds(players)[0]!
const flight = round.flights[0]!

describe('rány na soupeře', () => {
  it('rozdíl ran po jamkách odpovídá přiděleným ranám obou hráčů', () => {
    const [me, opponent] = flight.players as [string, string]
    const allowance = roundAllowance(round)
    const comparison = compareStrokes(round, me, opponent)
    expect(comparison.holes).toHaveLength(18)
    expect(comparison.handicap).toBe(playingHandicap(round, opponent, allowance))
    for (const h of comparison.holes) {
      expect(h.mine).toBe(strokesReceived(round, me, h.hole, allowance))
      expect(h.theirs).toBe(strokesReceived(round, opponent, h.hole, allowance))
      expect(h.diff).toBe(h.mine - h.theirs)
    }
    expect(comparison.up).toBe(comparison.holes.filter((h) => h.diff > 0).length)
    expect(comparison.down).toBe(comparison.holes.filter((h) => h.diff < 0).length)
    // Rozdíl hracích HCP = součet rozdílů po jamkách (rány se jen rozdělují po SI).
    const total = comparison.holes.reduce((sum, h) => sum + h.diff, 0)
    expect(total).toBe(
      playingHandicap(round, me, allowance) - playingHandicap(round, opponent, allowance),
    )
  })

  it('soupeř ze singlu pozic je ve flightu, když tam hraje stejná pozice druhého týmu', () => {
    const me = flight.players[0]!
    const company = flightCompany(round, players, me)
    expect(company.pairs).toBe(false)
    expect(company.opponents.length + company.others.length).toBe(3)
    // Soupeř (je-li) je z druhého týmu na stejné pozici.
    const team = players.find((p) => p.id === me)!.teamId!
    const other = team === 'A' ? 'B' : 'A'
    const position = round.positions[team].indexOf(me)
    const expected = round.positions[other][position]
    if (expected && flight.players.includes(expected)) {
      expect(company.opponents).toEqual([expected])
    } else {
      expect(company.opponents).toEqual([])
    }
  })

  it('bez handicapu ve flightu náhled nedává smysl', () => {
    const me = flight.players[0]!
    expect(flightHasHandicaps(round, me)).toBe(true)
    const stripped = {
      ...round,
      playerIndex: { ...round.playerIndex, [flight.players[1]!]: null },
      courseHandicapOverride: {},
    }
    expect(flightHasHandicaps(stripped, me)).toBe(false)
  })
})
