/**
 * World Handicap System - čisté výpočty.
 *
 * Převzato z Golfgames (`src/handicap.ts`) beze změny vzorců, jen bez vazby na
 * tamní model kola. Aplikace žádný oficiální handicap nevede, jen pracuje
 * s indexem, který zadá administrátor.
 */

/** Slope neutrálního hřiště. Vzorec pro hrací handicap je k němu vztažený. */
export const NEUTRAL_SLOPE = 113

/** Jamky plného kola. Index je vztažený k osmnáctce. */
const FULL_ROUND_HOLES = 18

/**
 * Hrací handicap = index × (SR / 113) + (CR − par), zaokrouhleno na celé rány.
 *
 * Kratší kolo než osmnáctka krátí index počtem hraných jamek a `CR − par`
 * tím, kolika jamek se norma týká (turnaj hraje jen osmnáctky, ale vzorec
 * zůstává obecný, ať sedí s Golfgames a jeho testy).
 */
export function courseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number,
  holeCount = FULL_ROUND_HOLES,
  ratedHoles = holeCount,
): number {
  const indexShare = holeCount / FULL_ROUND_HOLES
  const ratingShare = ratedHoles > 0 ? holeCount / ratedHoles : 1
  return Math.round(
    handicapIndex * indexShare * (slopeRating / NEUTRAL_SLOPE) +
      (courseRating - par) * ratingShare,
  )
}

/** Norma odpaliště v podobě, ve které vstupuje do hracího handicapu. */
export interface HandicapTee {
  courseRating?: number
  slopeRating?: number
  /** Par, ke kterému se norma vztahuje. */
  par?: number
  /** Kolika jamek se norma týká; bez hodnoty sedí přesně na hrané jamky. */
  ratedHoles?: number
}

/**
 * Hrací handicap hráče z normy **jeho** odpaliště. Bez normy se index bere
 * rovnou jako počet ran - jinak by nešlo hrát netto vůbec.
 */
export function playerCourseHandicap(
  handicapIndex: number,
  tee: HandicapTee | undefined,
  holeCount: number,
  fallbackPar: number,
): number {
  if (tee?.courseRating === undefined || tee.slopeRating === undefined) {
    return Math.round(handicapIndex)
  }
  return courseHandicap(
    handicapIndex,
    tee.slopeRating,
    tee.courseRating,
    tee.par ?? fallbackPar,
    holeCount,
    tee.ratedHoles ?? holeCount,
  )
}

/** Přepočte stroke index na pořadí 1..holeCount; nesedící SI nahradí pořadím jamek. */
export function normalizeStrokeIndex(strokeIndex: number[], holeCount: number): number[] {
  const usable = strokeIndex.length === holeCount
  if (!usable) return Array.from({ length: holeCount }, (_, i) => i + 1)

  const alreadyRanked = strokeIndex.every((si) => si >= 1 && si <= holeCount)
  if (alreadyRanked) return [...strokeIndex]

  const order = strokeIndex.map((si, hole) => ({ si, hole })).sort((a, b) => a.si - b.si)
  const ranked = Array<number>(holeCount).fill(1)
  order.forEach((entry, index) => {
    ranked[entry.hole] = index + 1
  })
  return ranked
}

/**
 * Kolik ran hráč dostane na jedné jamce: `floor(HCP / jamky)` všude, zbytek
 * po jedné od nejtěžší jamky. Plusový handicap rány vrací od nejlehčí jamky.
 */
export function strokesForHole(
  playingHandicap: number,
  strokeIndex: number,
  holeCount: number,
): number {
  if (!Number.isFinite(playingHandicap) || playingHandicap === 0) return 0
  if (holeCount <= 0) return 0

  const sign = playingHandicap > 0 ? 1 : -1
  const amount = Math.abs(Math.round(playingHandicap))
  const base = Math.floor(amount / holeCount)
  const extra = amount % holeCount

  const rank = sign > 0 ? strokeIndex : holeCount + 1 - strokeIndex
  const strokes = base + (rank <= extra ? 1 : 0)

  return strokes === 0 ? 0 : sign * strokes
}

/** Stablefordovy body z rozdílu netto skóre vůči paru; nikdy záporné. */
export function stablefordPoints(netDiff: number): number {
  return Math.max(0, 2 - netDiff)
}

/** Zadaný index; prázdné pole znamená „bez handicapu". Přijme tečku i čárku. */
export function parseHandicapIndex(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Index s nejvýš jedním desetinným místem a českou čárkou. */
export function formatHandicapIndex(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(value)
}
