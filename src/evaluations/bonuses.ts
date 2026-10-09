import type {
  BonusConfig,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  holeCount,
  holesPlayed,
  parAt,
  scoreAt,
  strokesReceived,
  teamOf,
} from '../model/round'
import type { BonusDefinition } from '../model/bonuses'
import {
  BONUSES,
  bonusValue,
  bonusesAt,
  hasBonuses,
  holdersOf,
  roundBonusConfig,
} from '../model/bonuses'
import type { StandingRow } from './types'
import { rankRows } from './types'

/**
 * Extra body jako vedlejší sázka podle Golfgames (`sideBets.ts`): hrají se
 * vedle her v každém kole, s jedním centrálním nastavením turnaje.
 *
 *   - Hodnota bonusu platí za **brutto** par; birdie a lepší ji násobí
 *     (`multipliers`), bogey a horší bonus nepřizná. Rozdané rány mění, kdo
 *     jamku vyhrál, ne to, jak se zahrála.
 *   - Longest a Nearest drží na jamce jediný hráč a hodnota se nenásobí.
 *     S potvrzením musí hráč jamku zahrát na par nebo líp: Longest osobním
 *     parem (par + rány z handicapu, volitelně), Nearest vždy brutto parem.
 *     Nepotvrzený bod (bogey a horší, zvednutá jamka) **jde soupeřům**
 *     (`forfeit`): ve hře dvojic k bodům druhé dvojice, v týmové hře druhému
 *     týmu; ve vedlejší sázce jednotlivců soupeř není, tam jen propadá.
 *   - Mají-li exkluzivní bonus omylem dva (zápis bez signálu ze dvou
 *     telefonů), nedostane bod nikdo. Zvednutá jamka bonus nedává.
 *   - Birdie a eagle (navíc proti Golfgames) se počítají z ran, pokud mají
 *     hodnotu; eagle a lepší dostane jen eagle, ne birdie navíc.
 */

export interface BonusAward {
  bonus: BonusDefinition
  points: number
  /** Zapsaný, ale nepočítá se (nepotvrzený, dva držitelé, zvednuto, bogey). */
  void: boolean
  /** Nepotvrzený Longest/Nearest: hodnota jde soupeřům (ne při dvou držitelích). */
  forfeit: boolean
  /** Jamka ještě není zapsaná - není jasno. */
  pending: boolean
}

export interface BonusSummary {
  rows: StandingRow[]
  teamPoints: Record<TeamId, number>
  /** Jamky, na kterých ještě nezapsali všichni. */
  pending: number
}

function resultMultiplier(config: BonusConfig, diff: number): number {
  if (diff > 0) return 0
  if (diff === 0) return 1
  if (diff === -1) return config.multipliers.birdie
  return config.multipliers.eagle
}

/** Bonusy hráče na jamce i s tím, jestli a za kolik se počítají. */
export function bonusAwardsAt(
  round: TournamentRound,
  baseConfig: BonusConfig,
  playerId: PlayerId,
  hole: number,
): BonusAward[] {
  // Longest a Nearest mohou mít v kole vlastní pravidlo (hraje se, potvrzení).
  const config = roundBonusConfig(round, baseConfig)
  const score = scoreAt(round, playerId, hole)
  const par = parAt(round, hole)
  const picked = score === PICKED_UP
  const diff = score === undefined || picked ? undefined : score - par
  const awards: BonusAward[] = []
  for (const bonus of BONUSES) {
    const value = bonusValue(config, bonus.id)
    if (value <= 0) continue
    if (bonus.auto) {
      if (diff === undefined) continue
      const hit = bonus.id === 'birdie' ? diff === -1 : diff <= -2
      if (hit)
        awards.push({ bonus, points: value, void: false, forfeit: false, pending: false })
      continue
    }
    if (!bonusesAt(round, playerId, hole).includes(bonus.id)) continue
    const pending = score === undefined
    if (bonus.exclusive) {
      const shared = holdersOf(round, hole, bonus.id).length > 1
      const confirm =
        bonus.id === 'longest' ? config.confirmLongest : config.confirmNearest
      const byPersonalPar =
        bonus.id === 'longest' ? config.longestByPersonalPar : config.nearestByPersonalPar
      const personal = byPersonalPar ? strokesReceived(round, playerId, hole) : 0
      const confirmed = !confirm || (diff !== undefined && diff - personal <= 0)
      // Zvednutá jamka par nedala - nepotvrzený bod, stejně jako bogey.
      const failed = !pending && (picked || !confirmed)
      const isVoid = picked || shared || failed
      awards.push({
        bonus,
        points: isVoid || pending ? 0 : value,
        void: isVoid,
        forfeit: !shared && failed && confirm,
        pending: pending && !isVoid,
      })
      continue
    }
    const multiplier = diff === undefined ? 0 : resultMultiplier(config, diff)
    const isVoid = picked || (!pending && multiplier === 0)
    awards.push({
      bonus,
      points: isVoid || pending ? 0 : value * multiplier,
      void: isVoid,
      forfeit: false,
      pending: pending && !isVoid,
    })
  }
  return awards
}

export function bonusPointsAt(
  round: TournamentRound,
  config: BonusConfig,
  playerId: PlayerId,
  hole: number,
): number {
  return bonusAwardsAt(round, config, playerId, hole).reduce(
    (sum, a) => sum + a.points,
    0,
  )
}

/** Body, které hráč na jamce nepotvrzeným Longest/Nearest odevzdal soupeřům. */
export function bonusForfeitAt(
  round: TournamentRound,
  config: BonusConfig,
  playerId: PlayerId,
  hole: number,
): number {
  return bonusAwardsAt(round, config, playerId, hole).reduce(
    (sum, a) => sum + (a.forfeit ? bonusValue(config, a.bonus.id) : 0),
    0,
  )
}

/** Odevzdané body hráče za celé kolo. */
export function bonusForfeitTotal(
  round: TournamentRound,
  config: BonusConfig,
  playerId: PlayerId,
): number {
  let points = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    points += bonusForfeitAt(round, config, playerId, hole)
  }
  return points
}

/** Extra body hráče za celé kolo. */
export function bonusTotal(
  round: TournamentRound,
  config: BonusConfig,
  playerId: PlayerId,
) {
  let points = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    points += bonusPointsAt(round, config, playerId, hole)
  }
  return points
}

/** Součet bodů hráče podle bonusu za celé kolo - do popisku ve výsledcích. */
export function bonusBreakdown(
  round: TournamentRound,
  config: BonusConfig,
  playerId: PlayerId,
): { bonus: BonusDefinition; count: number; points: number }[] {
  const counts = new Map<string, { count: number; points: number }>()
  for (let hole = 0; hole < holeCount(round); hole++) {
    for (const award of bonusAwardsAt(round, config, playerId, hole)) {
      if (award.void || award.pending) continue
      const entry = counts.get(award.bonus.id) ?? { count: 0, points: 0 }
      entry.count += 1
      entry.points += award.points
      counts.set(award.bonus.id, entry)
    }
  }
  return BONUSES.filter((b) => counts.has(b.id)).map((bonus) => ({
    bonus,
    ...counts.get(bonus.id)!,
  }))
}

/** Tabulka extra bodů kola; `null`, když se o ně nehraje. */
export function bonusSummary(
  round: TournamentRound,
  players: Player[],
  config: BonusConfig,
): BonusSummary | null {
  if (!hasBonuses(config)) return null
  const rows = round.playerIds.map((id) => {
    let count = 0
    for (let hole = 0; hole < holeCount(round); hole++) {
      count += bonusAwardsAt(round, config, id, hole).filter(
        (a) => !a.void && !a.pending,
      ).length
    }
    return {
      id,
      players: [id],
      value: bonusTotal(round, config, id),
      secondary: count,
      holes: holesPlayed(round, id),
      teamId: teamOf(players, id),
    }
  })
  // Do týmu jdou extra body jen přes hru, která je má zapnuté (evaluateGame);
  // tabulka vedlejší sázky sama týmové body nedává.
  const teamPoints: Record<TeamId, number> = { A: 0, B: 0 }
  let pending = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    if (!round.playerIds.every((id) => scoreAt(round, id, hole) !== undefined))
      pending += 1
  }
  return { rows: rankRows(rows, 'highest', 'highest'), teamPoints, pending }
}
