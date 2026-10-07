import { describe, expect, it } from 'vitest'
import type { TournamentRound } from './types'
import { seedRounds } from '../data/seed'
import {
  addMinutes,
  flightProgress,
  hasSchedule,
  isValidTime,
  localToday,
  normalizeTime,
  upcomingRound,
} from './schedule'

function rounds(): TournamentRound[] {
  return seedRounds()
}

describe('program kola', () => {
  it('pozná platný čas HH:MM', () => {
    expect(isValidTime('15:50')).toBe(true)
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('')).toBe(false)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:05')).toBe(false)
    expect(isValidTime(undefined)).toBe(false)
  })

  it('posune čas o minuty i přes celou hodinu a půlnoc', () => {
    expect(addMinutes('15:50', 10)).toBe('16:00')
    expect(addMinutes('09:05', 20)).toBe('09:25')
    expect(addMinutes('23:55', 10)).toBe('00:05')
    expect(addMinutes('00:05', -10)).toBe('23:55')
  })

  it('seed má program prvního kola, ostatní zatím ne', () => {
    const [first, second] = rounds()
    expect(first!.departure).toBe('14:45')
    expect(first!.flights.map((f) => f.teeTime)).toEqual(['15:50', '16:00'])
    expect(hasSchedule(first!)).toBe(true)
    expect(hasSchedule(second!)).toBe(false)
    // Bez času klíč chybí, Firestore neumí undefined.
    expect('teeTime' in second!.flights[0]!).toBe(false)
    expect('departure' in second!).toBe(false)
    expect(hasSchedule({ ...second!, departure: '' })).toBe(false)
  })

  it('nejbližší kolo: rozehrané, jinak první plánované od dneška', () => {
    const list = rounds()
    expect(upcomingRound(list, '2026-10-07')?.id).toBe('r1')
    expect(upcomingRound(list, '2026-10-08')?.id).toBe('r1')
    // Kolo 1 je pryč a admin ho zapomněl přepnout: ukáže se další den.
    expect(upcomingRound(list, '2026-10-09')?.id).toBe('r2')
    expect(upcomingRound(list, '2026-10-11')?.id).toBe('r4')
    expect(upcomingRound(list, '2026-10-14')).toBeUndefined()
    const live = list.map((r) => (r.id === 'r2' ? { ...r, status: 'live' as const } : r))
    expect(upcomingRound(live, '2026-10-14')?.id).toBe('r2')
    const done = list.map((r) =>
      r.id === 'r1' ? { ...r, status: 'finished' as const } : r,
    )
    expect(upcomingRound(done, '2026-10-08')?.id).toBe('r2')
  })

  it('dnešek je místní datum telefonu', () => {
    expect(localToday(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08')
    expect(localToday(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02')
  })

  it('stav flightu: nezačal, na jamce, dohrál', () => {
    const round = rounds()[0]!
    const flight = { ...round.flights[0]!, startHole: 9 }
    expect(flightProgress(round, flight)).toEqual({
      started: 0,
      finished: false,
      hole: 9,
    })

    const scores = { ...round.scores }
    for (const id of flight.players) {
      scores[id] = { '9': 4, '10': 5 }
    }
    // Jedenáctka (index 10) zapsaná, další je dvanáctka - po pořadí od desítky.
    expect(flightProgress({ ...round, scores }, flight)).toEqual({
      started: 2,
      finished: false,
      hole: 11,
    })

    const full = { ...round.scores }
    for (const id of flight.players) {
      full[id] = Object.fromEntries(
        Array.from({ length: 18 }, (_, hole) => [String(hole), hole % 5 === 0 ? 0 : 4]),
      )
    }
    expect(flightProgress({ ...round, scores: full }, flight).finished).toBe(true)
  })
})

describe('zadání času', () => {
  it('převede běžné zápisy na HH:MM', () => {
    expect(normalizeTime('1550')).toBe('15:50')
    expect(normalizeTime('15:50')).toBe('15:50')
    expect(normalizeTime('15.50')).toBe('15:50')
    expect(normalizeTime(' 9:05 ')).toBe('09:05')
    expect(normalizeTime('905')).toBe('09:05')
    expect(normalizeTime('2400')).toBeNull()
    expect(normalizeTime('15:7')).toBeNull()
    expect(normalizeTime('abc')).toBeNull()
    expect(normalizeTime('')).toBeNull()
  })
})
