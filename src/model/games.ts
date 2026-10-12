import { SIDED_KINDS } from './round'
import type { GameConfig, GameKind, TournamentRound } from './types'

/** Hry s volbou formátu zápasu (rány / Stableford / jamkovka). */
const FORMAT_KINDS: GameKind[] = ['position-duel', 'team-match', 'texas-scramble']

/**
 * Počítá hra s ranami z HCP? Duel s formátem rozhoduje formátem (brutto rány
 * nikdy, jamkovka podle přepínače Netto, netto rány a Stableford vždy), ostatní
 * hry přepínačem Netto. Podle toho editor schovává allowance a uvítání náhled
 * ran na soupeře.
 */
export function gameUsesHandicap(game: GameConfig): boolean {
  if (FORMAT_KINDS.includes(game.kind)) {
    const format =
      game.options.format ??
      (game.kind === 'position-duel' ? 'strokes-net' : 'match-play')
    if (format === 'strokes-gross') return false
    if (format === 'match-play') return game.options.net
    return true
  }
  return game.options.net
}

/** Hlavní zápas kola pro hráče: hra dvojic, jinak singly pozic. */
export function matchGame(round: TournamentRound): GameConfig | undefined {
  return (
    round.games.find((game) => SIDED_KINDS.includes(game.kind)) ??
    round.games.find((game) => game.kind === 'position-duel')
  )
}

/** Má smysl ukazovat rány na soupeře? Rozhoduje hlavní zápas, bez něj kterákoli netto hra. */
export function roundUsesHandicap(round: TournamentRound): boolean {
  const match = matchGame(round)
  if (match) return gameUsesHandicap(match)
  return round.games.some(gameUsesHandicap)
}
