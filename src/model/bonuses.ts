import type { GameConfig, PlayerId, TournamentRound } from './types'
import { holeKey, parAt } from './round'

/**
 * Extra body - longest, nearest, birdie a spol. Definice jsou převzaté
 * z Golfgames (`BONUSES`): texty podle id (`bonus.<id>.name`), Longest jen
 * na pětiparových, Nearest na tříparových jamkách, oba drží na jamce jediný
 * hráč. Birdie a eagle se na rozdíl od Golfgames nezaškrtávají - spočítají
 * se ze zapsaných ran.
 *
 * Zapsané bonusy žijí v `round.bonuses[hráč][jamka]` (seznam id); která
 * jsou ve hře a za kolik, říká hra „Extra body“ (`options.bonusValues`).
 */

export type BonusId =
  'longest' | 'nearest' | 'birdie' | 'eagle' | 'sandie' | 'water' | 'barkie' | 'arnie'

export interface BonusDefinition {
  id: BonusId
  /** Písmeno u jména v zápisu a ve scorekartě. */
  mark: string
  defaultValue: number
  /** Počítá se automaticky z ran, nezaškrtává se. */
  auto?: boolean
  /** Nabízí se jen na jamkách s tímhle parem. */
  onlyPar?: number
  /** Na jamce ho může mít jen jeden hráč. */
  exclusive?: boolean
}

export const BONUSES: BonusDefinition[] = [
  { id: 'longest', mark: 'L', defaultValue: 1, onlyPar: 5, exclusive: true },
  { id: 'nearest', mark: 'N', defaultValue: 1, onlyPar: 3, exclusive: true },
  { id: 'birdie', mark: 'B', defaultValue: 1, auto: true },
  { id: 'eagle', mark: 'E', defaultValue: 2, auto: true },
  { id: 'sandie', mark: 'S', defaultValue: 1 },
  { id: 'water', mark: 'W', defaultValue: 1 },
  { id: 'barkie', mark: 'T', defaultValue: 1 },
  { id: 'arnie', mark: 'A', defaultValue: 1 },
]

export const BONUS_IDS: BonusId[] = BONUSES.map((b) => b.id)

export function getBonus(id: string): BonusDefinition | undefined {
  return BONUSES.find((b) => b.id === id)
}

/** Výchozí hodnoty hry Extra body: longest, nearest, birdie a eagle. */
export function defaultBonusValues(): Record<string, number> {
  return { longest: 1, nearest: 1, birdie: 1, eagle: 2 }
}

export function bonusValue(game: GameConfig, id: string): number {
  return game.options.bonusValues?.[id] ?? 0
}

/** Ručně zapsané bonusy hráče na jamce (id). */
export function bonusesAt(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
): string[] {
  const list = round.bonuses[playerId]?.[holeKey(hole)]
  return Array.isArray(list) ? list : []
}

/** Hra Extra body v kole, pokud je. */
export function bonusGameOf(round: TournamentRound): GameConfig | undefined {
  return round.games.find((game) => game.kind === 'bonuses')
}

/** Bonusy, které jde na jamce zaškrtnout: zapnuté ve hře a odpovídající paru. */
export function availableBonuses(
  game: GameConfig | undefined,
  round: TournamentRound,
  hole: number,
): BonusDefinition[] {
  if (!game) return []
  const par = parAt(round, hole)
  return BONUSES.filter(
    (bonus) =>
      !bonus.auto &&
      bonusValue(game, bonus.id) > 0 &&
      (bonus.onlyPar === undefined || bonus.onlyPar === par),
  )
}

/** Seznam po přepnutí bonusu; pořadí podle definic, aby se značky nepřehazovaly. */
export function toggleBonus(current: string[], id: string): string[] {
  const next = current.includes(id) ? current.filter((b) => b !== id) : [...current, id]
  return BONUS_IDS.filter((b) => next.includes(b))
}

/** Hráči, kteří mají na jamce zapsaný daný bonus. */
export function holdersOf(round: TournamentRound, hole: number, id: string): PlayerId[] {
  return round.playerIds.filter((playerId) =>
    bonusesAt(round, playerId, hole).includes(id),
  )
}
