import type { BonusConfig, PlayerId, TournamentRound } from './types'
import { holeKey } from './round'

/**
 * Extra body - longest, nearest, sandie a spol. Definice jsou převzaté
 * z Golfgames (`BONUSES`): texty podle id (`bonus.<id>.name`). Longest a
 * Nearest drží na jamce jediný hráč a nabízejí se na každé jamce - na které
 * se hrají, si řekne flight (longest i na dlouhém paru 4, nearest na druhou
 * ránu), par je jen obvyklé místo pro nápovědu a ukázková data. Birdie a eagle jsou navíc proti Golfgames: nezaškrtávají se, spočítají
 * se ze zapsaných ran, a ve výchozím nastavení jsou vypnuté.
 *
 * Zapsané bonusy žijí v `round.bonuses[hráč][jamka]` (seznam id); která se
 * hrají a za kolik, říká centrální nastavení turnaje (`tournament.bonuses`),
 * stejné pro všechna kola a všechny hry - jako `bonusValues` v Golfgames.
 */

export type BonusId =
  'longest' | 'nearest' | 'sandie' | 'water' | 'barkie' | 'arnie' | 'birdie' | 'eagle'

export interface BonusDefinition {
  id: BonusId
  /** Písmeno u jména v zápisu a ve scorekartě. */
  mark: string
  defaultValue: number
  /** Počítá se automaticky z ran, nezaškrtává se. */
  auto?: boolean
  /** Par, kde se obvykle hraje - jen nápověda a ukázková data, nabídka ho nehlídá. */
  typicalPar?: number
  /** Na jamce ho může mít jen jeden hráč; hodnota se nenásobí výsledkem. */
  exclusive?: boolean
}

export const BONUSES: BonusDefinition[] = [
  { id: 'longest', mark: 'L', defaultValue: 1, typicalPar: 5, exclusive: true },
  { id: 'nearest', mark: 'N', defaultValue: 1, typicalPar: 3, exclusive: true },
  { id: 'sandie', mark: 'S', defaultValue: 1 },
  { id: 'water', mark: 'W', defaultValue: 1 },
  { id: 'barkie', mark: 'T', defaultValue: 1 },
  { id: 'arnie', mark: 'A', defaultValue: 1 },
  { id: 'birdie', mark: 'B', defaultValue: 0, auto: true },
  { id: 'eagle', mark: 'E', defaultValue: 0, auto: true },
]

export const BONUS_IDS: BonusId[] = BONUSES.map((b) => b.id)

export function getBonus(id: string): BonusDefinition | undefined {
  return BONUSES.find((b) => b.id === id)
}

/** Výchozí nastavení = výchozí hodnoty Golfgames: bonusy za 1 bod, birdie ×2, eagle ×3. */
export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  values: Object.fromEntries(BONUSES.map((b) => [b.id, b.defaultValue])),
  confirmLongest: true,
  confirmNearest: true,
  longestByPersonalPar: true,
  multipliers: { birdie: 2, eagle: 3 },
  teamPerPoint: 0,
}

/** Nastavení turnaje doplněné o výchozí hodnoty (starší data nemusí mít všechno). */
export function bonusConfigOf(config: Partial<BonusConfig> | undefined): BonusConfig {
  return {
    ...DEFAULT_BONUS_CONFIG,
    ...(config ?? {}),
    values: { ...DEFAULT_BONUS_CONFIG.values, ...(config?.values ?? {}) },
    multipliers: { ...DEFAULT_BONUS_CONFIG.multipliers, ...(config?.multipliers ?? {}) },
  }
}

export function bonusValue(config: BonusConfig, id: string): number {
  return config.values[id] ?? 0
}

/** Hraje se o extra body vůbec? */
export function hasBonuses(config: BonusConfig): boolean {
  return BONUSES.some((b) => bonusValue(config, b.id) > 0)
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

/**
 * Bonusy, které jde na jamce zaškrtnout: zapnuté a ruční. Par se nehlídá -
 * dřív byl Longest jen na par 5 a Nearest na par 3 a na hřišti začínajícím
 * parem 4 pak v zápisu „chyběly“; kde se hrají, rozhodne flight.
 */
export function availableBonuses(
  config: BonusConfig,
  _round: TournamentRound,
  _hole: number,
): BonusDefinition[] {
  return BONUSES.filter((bonus) => !bonus.auto && bonusValue(config, bonus.id) > 0)
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
