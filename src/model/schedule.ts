import type { Flight, TournamentRound } from './types'
import { flightHolesStarted, flightCurrentHole, holeCount, isEntered } from './round'

/**
 * Program kola (odjezd na hřiště, tee time flightů) a stav rozehranosti
 * flightu. Časy jsou místní čas v Beleku jako text `HH:MM` - přesně to, co
 * stojí v potvrzení od hřiště; převod přes časová pásma by jen pletl.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value)
}

/**
 * Čas z toho, co admin napíše na telefonu: `1550`, `15:50`, `15.50`, `9:05`
 * i `905` dají `HH:MM`. Nesmysl vrátí `null`.
 */
export function normalizeTime(input: string): string | null {
  const text = input.trim().replace(/[.,h ]/g, ':')
  const match = /^(\d{1,2}):?(\d{2})$/.exec(text)
  if (!match) return null
  const value = `${match[1]!.padStart(2, '0')}:${match[2]}`
  return isValidTime(value) ? value : null
}

/** Čas posunutý o minuty, dokola přes půlnoc (`15:50` + 10 = `16:00`). */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = ((((h ?? 0) * 60 + (m ?? 0) + minutes) % 1440) + 1440) % 1440
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** Rozestup tee timů, když admin zadá jen první flight - flighty jdou za sebou. */
export const TEE_INTERVAL_MINUTES = 10

/** Má kolo zadaný aspoň jeden čas programu? */
export function hasSchedule(round: TournamentRound): boolean {
  return isValidTime(round.departure) || round.flights.some((f) => isValidTime(f.teeTime))
}

/**
 * Kolo, které hráče zajímá teď: rozehrané, jinak nejbližší plánované od
 * dneška (plánované kolo z minulosti, které admin zapomněl přepnout, už ne).
 */
export function upcomingRound(
  rounds: TournamentRound[],
  today: string,
): TournamentRound | undefined {
  const live = rounds.find((r) => r.status === 'live')
  if (live) return live
  return [...rounds]
    .filter((r) => r.status === 'planned' && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)[0]
}

/** Dnešní datum `YYYY-MM-DD` v místním čase telefonu. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export interface FlightProgress {
  /** Jamky, na kterých někdo z flightu zapsal. */
  started: number
  /** Všichni zapsali všechny jamky. */
  finished: boolean
  /** Jamka (index), na které flight nejspíš je. */
  hole: number
}

export function flightProgress(round: TournamentRound, flight: Flight): FlightProgress {
  const count = holeCount(round)
  let complete = 0
  for (let hole = 0; hole < count; hole++) {
    if (flight.players.every((id) => isEntered(round, id, hole))) complete += 1
  }
  return {
    started: flightHolesStarted(round, flight),
    finished: flight.players.length > 0 && complete === count,
    hole: flightCurrentHole(round, flight),
  }
}
