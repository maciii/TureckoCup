import type {
  GameConfig,
  PickupRule,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'

/**
 * Výstup vyhodnocení jedné hry nad jedním kolem. Jsou to data, ne texty:
 * jména a popisky skládá UI, aby šly výsledky agregovat přes kola.
 */

export interface StandingRow {
  /** Id hráče nebo strany. */
  id: string
  /** Hráči, kterých se řádek týká (jeden u jednotlivců). */
  players: PlayerId[]
  /** Hlavní hodnota (body, skiny, vyhrané jamky). */
  value: number
  /** Doplňková hodnota (rány, netto součet). */
  secondary?: number
  /** Kolik jamek se do řádku započítalo. */
  holes: number
  /** Pořadí, sdílené při shodě (1, 1, 3). */
  position: number
  teamId?: TeamId
}

export interface HoleOutcome {
  hole: number
  decided: boolean
  /** Komu jamka připadla (hráči), prázdné = dělená/nerozhodnutá. */
  winners: PlayerId[]
  /** Hodnota jamky (skiny, body); u skins včetně přenesených. */
  value?: number
  /** Skiny čekající v banku po jamce. */
  carry?: number
}

/** Stav jednoho duelu (pozice) nebo zápasu (hlavní hra). */
export interface DuelResult {
  id: string
  sides: {
    id: string
    players: PlayerId[]
    teamId?: TeamId
    value: number
    holes: number
  }[]
  /** 0, 1, nebo null při shodě. */
  leader: 0 | 1 | null
  /** Golfová notace (`2 UP`, `3&2`, `AS`) nebo rozdíl hodnot. */
  notation: string
  decided: boolean
  finished: boolean
  pending: number
  /** Index pozice 1-4, pokud jde o duel pozic. */
  position?: number
}

export interface EvaluationResult {
  game: GameConfig
  rows: StandingRow[]
  holes: HoleOutcome[]
  duels?: DuelResult[]
  /** Body do týmového skóre podle `game.teamPoints`. */
  teamPoints: Record<TeamId, number>
  /** Jamky, které ještě nejsou rozhodnuté. */
  pending: number
  /** Skiny v banku po poslední jamce (propadají). */
  carry?: number
}

export interface EvaluationContext {
  round: TournamentRound
  players: Player[]
  /** Centrální pravidlo turnaje pro zvednutou jamku ve hře na rány. */
  pickup: PickupRule
}

export type Evaluate = (context: EvaluationContext, game: GameConfig) => EvaluationResult

/** Řazení s pozicemi: při shodě sdílené, strany bez jediné jamky na konci. */
export function rankRows<T extends { value: number; holes: number; secondary?: number }>(
  rows: T[],
  order: 'highest' | 'lowest',
  secondaryOrder: 'highest' | 'lowest' = 'lowest',
): (T & { position: number })[] {
  const sorted = [...rows].sort((a, b) => {
    const aEmpty = a.holes === 0
    const bEmpty = b.holes === 0
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    if (a.value !== b.value)
      return order === 'highest' ? b.value - a.value : a.value - b.value
    const as = a.secondary ?? 0
    const bs = b.secondary ?? 0
    return secondaryOrder === 'highest' ? bs - as : as - bs
  })

  let position = 0
  let previous: T | undefined
  return sorted.map((row, index) => {
    const tie = previous !== undefined && previous.value === row.value && row.holes > 0
    if (!tie) position = index + 1
    previous = row
    return { ...row, position }
  })
}
