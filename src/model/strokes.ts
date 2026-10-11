import {
  flightIndexOf,
  hasHandicap,
  holeCount,
  matchSides,
  parAt,
  playingHandicap,
  strokeIndexRanked,
  strokesReceived,
  teamOf,
} from './round'
import type { Player, PlayerId, TeamId, TournamentRound } from './types'
import { SIDED_KINDS } from './round'
import { TEAM_IDS } from './types'

/**
 * Rány na soupeře před zápasem: na kterých jamkách má hráč oproti soupeři
 * ránu navíc a kde ji má soupeř na něj. Počítá se z přidělených ran obou
 * (hrací HCP kola × allowance hry, rozdělený podle SI) - stejně, jako
 * netto rány v evaluacích, takže náhled sedí s tím, co pak spočítají hry.
 */

export interface StrokeHole {
  hole: number
  par: number
  si: number
  /** Rány hráče a soupeře na jamce. */
  mine: number
  theirs: number
  /** Kladné = hráč má navíc, záporné = soupeř má navíc. */
  diff: number
}

export interface StrokeComparison {
  opponent: PlayerId
  handicap: number
  holes: StrokeHole[]
  /** Počet jamek, kde má hráč ránu navíc / kde ji má soupeř. */
  up: number
  down: number
}

/** Allowance, kterou kolo hraje: singly pozic, jinak první netto hra, jinak plný HCP. */
export function roundAllowance(round: TournamentRound): number {
  const game =
    round.games.find((g) => g.kind === 'position-duel') ??
    round.games.find((g) => g.options.net)
  return game?.options.allowance ?? 1
}

export function compareStrokes(
  round: TournamentRound,
  me: PlayerId,
  opponent: PlayerId,
  allowance = roundAllowance(round),
): StrokeComparison {
  const si = strokeIndexRanked(round)
  const holes: StrokeHole[] = Array.from({ length: holeCount(round) }, (_, hole) => {
    const mine = strokesReceived(round, me, hole, allowance)
    const theirs = strokesReceived(round, opponent, hole, allowance)
    return {
      hole,
      par: parAt(round, hole),
      si: si[hole] ?? hole + 1,
      mine,
      theirs,
      diff: mine - theirs,
    }
  })
  return {
    opponent,
    handicap: playingHandicap(round, opponent, allowance),
    holes,
    up: holes.filter((h) => h.diff > 0).length,
    down: holes.filter((h) => h.diff < 0).length,
  }
}

export interface FlightCompany {
  /** Soupeři ze zápasu hráče (single pozic nebo druhá dvojice). */
  opponents: PlayerId[]
  /** Parťák ve hře dvojic. */
  partners: PlayerId[]
  /** Ostatní hráči flightu mimo zápas hráče. */
  others: PlayerId[]
  /** Hraje se ve flightu hra dvojic? */
  pairs: boolean
}

/**
 * S kým hráč ve flightu hraje: ve hře dvojic je soupeřem druhá dvojice
 * a parťákem spoluhráč, jinak soupeř ze singlu pozic (stejná pozice druhého
 * týmu), pokud jde ve stejném flightu. Zbytek flightu jsou „ostatní“.
 */
export function flightCompany(
  round: TournamentRound,
  players: Player[],
  me: PlayerId,
): FlightCompany {
  const index = flightIndexOf(round, me)
  const flight = round.flights[index]
  if (!flight) return { opponents: [], partners: [], others: [], pairs: false }
  const mates = flight.players.filter((id) => id !== me)
  const pairs = round.games.some((game) => SIDED_KINDS.includes(game.kind))
  if (pairs) {
    const sides = matchSides(round, players).filter((side) =>
      side.id.startsWith(`f${index}`),
    )
    const own = sides.find((side) => side.players.includes(me))
    const other = sides.find((side) => side !== own)
    if (own && other) {
      const partners = own.players.filter((id) => id !== me)
      const opponents = other.players
      const inMatch = new Set([...partners, ...opponents])
      return {
        opponents,
        partners,
        others: mates.filter((id) => !inMatch.has(id)),
        pairs: true,
      }
    }
  }
  const team = teamOf(players, me)
  const duel = round.games.some((game) => game.kind === 'position-duel')
  if (team && duel) {
    const position = round.positions[team].indexOf(me)
    const otherTeam: TeamId | undefined = TEAM_IDS.find((id) => id !== team)
    const opponent =
      otherTeam && position >= 0 ? round.positions[otherTeam][position] : undefined
    if (opponent && mates.includes(opponent)) {
      return {
        opponents: [opponent],
        partners: [],
        others: mates.filter((id) => id !== opponent),
        pairs: false,
      }
    }
  }
  return { opponents: [], partners: [], others: mates, pairs }
}

/** Má kolo handicapy pro hráče i všechny spoluhráče flightu? */
export function flightHasHandicaps(round: TournamentRound, me: PlayerId): boolean {
  const index = flightIndexOf(round, me)
  const flight = round.flights[index]
  if (!flight) return false
  return flight.players.every((id) => hasHandicap(round, id))
}
