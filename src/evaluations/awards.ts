import type { BonusConfig, Player, PlayerId, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import { holeCount, netScoreAt, parAt, scoreAt } from '../model/round'
import { stablefordPoints } from '../scoring/whs'
import { bonusAwardsAt } from './bonuses'
import { playerSkinsSummary } from './teamSkinsTotal'

/**
 * Odznaky zájezdu - individuální statistiky z raw skóre přes odehraná kola
 * (živá i dohraná). Nic se neukládá, počítá se při zobrazení jako hry.
 *
 * Brutto výsledek jamky proti paru (birdie, par, bogey…) bere skutečné
 * rány; zvednutá jamka se počítá jako čtyřbogey a hůř a jako jamka bez
 * Stablefordova bodu. Stablefordovy body jsou netto s plným hracím HCP
 * kola (jako hra Stableford s allowance 100 %), ať se počítají i v kole,
 * kde se Stableford nehraje. Odznak drží vedoucí hráč (při shodě všichni),
 * jen když má aspoň jeden bod; „hůř je víc“ odznaky (Bogie Man…) jsou
 * parodie, ale počítají se stejně.
 */

export type AwardId =
  | 'stb'
  | 'birdie'
  | 'eagle'
  | 'par'
  | 'bogey'
  | 'double'
  | 'triple'
  | 'glutton'
  | 'nostable'
  | 'streak'
  | 'skins'
  | 'longest'
  | 'nearest'
  | 'collector'
  | 'none'

export interface AwardDefinition {
  id: AwardId
  /** Znak na medaili (text, ne obrázek - vykresluje se v CSS). */
  mark: string
  /** Barevná řada medaile: zlatá, stříbrná, bronzová, červená (parodie), zelená. */
  tone: 'gold' | 'silver' | 'bronze' | 'red' | 'green' | 'navy'
}

export const AWARDS: AwardDefinition[] = [
  { id: 'stb', mark: 'StB', tone: 'red' },
  { id: 'birdie', mark: '🐦', tone: 'gold' },
  { id: 'eagle', mark: '🦅', tone: 'gold' },
  { id: 'par', mark: '=', tone: 'green' },
  { id: 'streak', mark: '🔥', tone: 'gold' },
  { id: 'skins', mark: '💰', tone: 'navy' },
  { id: 'longest', mark: 'L', tone: 'silver' },
  { id: 'nearest', mark: 'N', tone: 'silver' },
  { id: 'bogey', mark: '+1', tone: 'bronze' },
  { id: 'double', mark: '+2', tone: 'bronze' },
  { id: 'triple', mark: '+3', tone: 'bronze' },
  { id: 'glutton', mark: '🍗', tone: 'red' },
  { id: 'nostable', mark: '0', tone: 'red' },
  // Odvozené z ostatních: kdo drží nejvíc odznaků, a kdo nedrží žádný.
  { id: 'collector', mark: '×', tone: 'gold' },
  { id: 'none', mark: '◇', tone: 'silver' },
]

/** Odznaky počítané z ostatních odznaků, ne ze skóre. */
const META_AWARDS: AwardId[] = ['collector', 'none']

export interface AwardRow {
  id: PlayerId
  value: number
  /** Pořadí, při shodě sdílené. */
  position: number
}

export interface AwardResult {
  award: AwardDefinition
  rows: AwardRow[]
  /** Držitelé: vedoucí s hodnotou > 0 (při shodě víc). */
  holders: PlayerId[]
  value: number
}

export interface AwardsSummary {
  results: AwardResult[]
  /** Kolik kol se počítá (živá i dohraná). */
  rounds: number
  /** Datum posledního započteného kola. */
  date: string | null
}

type Tally = Record<AwardId, Map<PlayerId, number>>

function blank(players: Player[]): Tally {
  const tally = {} as Tally
  for (const award of AWARDS) {
    tally[award.id] = new Map(players.map((p) => [p.id, 0]))
  }
  return tally
}

function add(tally: Tally, id: AwardId, playerId: PlayerId, by = 1) {
  tally[id].set(playerId, (tally[id].get(playerId) ?? 0) + by)
}

export function computeAwards(
  rounds: TournamentRound[],
  players: Player[],
  bonuses: BonusConfig,
): AwardsSummary {
  const played = rounds.filter((r) => r.status !== 'planned')
  const tally = blank(players)
  const streakBest = new Map<PlayerId, number>(players.map((p) => [p.id, 0]))

  for (const round of played) {
    // Stableford netto s plným HCP kola; hra Stableford kola má přednost, když je.
    const stb = round.games.find((g) => g.kind === 'individual-stableford')
    const options = {
      net: stb?.options.net ?? true,
      allowance: stb?.options.allowance ?? 1,
    }
    for (const player of players) {
      let streak = 0
      for (let hole = 0; hole < holeCount(round); hole++) {
        const score = scoreAt(round, player.id, hole)
        if (score === undefined) {
          streak = 0
          continue
        }
        const par = parAt(round, hole)
        const diff = score === PICKED_UP ? Number.POSITIVE_INFINITY : score - par
        if (diff <= -2) add(tally, 'eagle', player.id)
        else if (diff === -1) add(tally, 'birdie', player.id)
        else if (diff === 0) add(tally, 'par', player.id)
        else if (diff === 1) add(tally, 'bogey', player.id)
        else if (diff === 2) add(tally, 'double', player.id)
        else if (diff === 3) add(tally, 'triple', player.id)
        else add(tally, 'glutton', player.id)

        if (diff <= 0) {
          streak += 1
          if (streak > (streakBest.get(player.id) ?? 0)) streakBest.set(player.id, streak)
        } else streak = 0

        const net = netScoreAt(round, player.id, hole, options)
        const points =
          net === undefined || !Number.isFinite(net) ? 0 : stablefordPoints(net - par)
        add(tally, 'stb', player.id, points)
        if (points === 0) add(tally, 'nostable', player.id)

        for (const award of bonusAwardsAt(round, bonuses, player.id, hole)) {
          if (award.points <= 0) continue
          if (award.bonus.id === 'longest') add(tally, 'longest', player.id)
          if (award.bonus.id === 'nearest') add(tally, 'nearest', player.id)
        }
      }
    }
  }
  for (const [id, best] of streakBest) tally.streak.set(id, best)
  // Skinař: Skins jednotlivců ve flightu netto ve všech odehraných kolech -
  // jednotně, i kde se Skins nehrály (rozpis netto i brutto ukazuje odznak).
  for (const [id, skins] of playerSkinsSummary(rounds, players, 'net').totals)
    tally.skins.set(id, skins)

  const rank = (values: Map<PlayerId, number>, ascending = false): AwardRow[] => {
    const sorted = [...values.entries()]
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
    let position = 0
    return sorted.map((row, index) => {
      if (index === 0 || row.value !== sorted[index - 1]!.value) position = index + 1
      return { ...row, position }
    })
  }
  const base = AWARDS.filter((award) => !META_AWARDS.includes(award.id)).map((award) => {
    const rows = rank(tally[award.id])
    const top = rows[0]?.value ?? 0
    return {
      award,
      rows,
      value: top,
      holders: top > 0 ? rows.filter((r) => r.value === top).map((r) => r.id) : [],
    }
  })
  // Sběrač odznaků: kolik odznaků hráč drží (vedoucí, aspoň jeden).
  // Ani piču: kdo nedrží žádný - v tabulce počet odznaků od nejmenšího.
  const held = new Map<PlayerId, number>(players.map((p) => [p.id, 0]))
  if (played.length > 0)
    for (const result of base)
      for (const id of result.holders) held.set(id, (held.get(id) ?? 0) + 1)
  const collectorRows = rank(held)
  const collectorTop = collectorRows[0]?.value ?? 0
  const noneRows = rank(held, true)
  const meta: Record<'collector' | 'none', AwardResult> = {
    collector: {
      award: AWARDS.find((a) => a.id === 'collector')!,
      rows: collectorRows,
      value: collectorTop,
      holders:
        collectorTop > 0
          ? collectorRows.filter((r) => r.value === collectorTop).map((r) => r.id)
          : [],
    },
    none: {
      award: AWARDS.find((a) => a.id === 'none')!,
      rows: noneRows,
      value: 0,
      holders:
        played.length > 0 ? noneRows.filter((r) => r.value === 0).map((r) => r.id) : [],
    },
  }
  const results: AwardResult[] = AWARDS.map((award) =>
    award.id === 'collector' || award.id === 'none'
      ? meta[award.id]
      : base.find((r) => r.award.id === award.id)!,
  )

  const dates = played.map((r) => r.date).sort()
  return { results, rounds: played.length, date: dates.at(-1) ?? null }
}

/** Odznaky, které hráč drží - podklad pro gratulaci po otevření aplikace. */
export function awardsOf(summary: AwardsSummary, playerId: PlayerId): AwardResult[] {
  return summary.results.filter((r) => r.holders.includes(playerId))
}

/** Otisk držení odznaku - gratulace se ukáže znovu, až se změní hodnota nebo držitelé. */
export function awardSignature(result: AwardResult): string {
  return `${result.award.id}:${result.value}:${result.holders.join(',')}`
}
