/**
 * Jádro jamkovky (match play) pro dvě strany - čistý algoritmus.
 *
 * Zápas se nehraje na celkový počet ran, ale jamka po jamce: kdo zahraje
 * jamku líp, jde o jednu nahoru, shodná jamka je dělená. Přepsáno podle
 * `matchStateOf()` z Golfgames. Rána strany je libovolné číslo (netto,
 * lepší míč dvojice), `Infinity` = strana jamku vzdala, `undefined` = jamka
 * ještě není rozhodnutá.
 *
 * Jamky po matematickém rozhodnutí zápasu (náskok větší než zbývající jamky)
 * se už nepočítají - zápas skončil, zbytek se dohrává jen pro ostatní hry.
 */

export interface MatchHole {
  hole: number
  decided: boolean
  /** 0 nebo 1 = vítěz jamky, null = dělená nebo nerozhodnutá. */
  winner: 0 | 1 | null
  /** Jamka už se nehraje - zápas byl rozhodnutý dřív. */
  outOfPlay: boolean
}

export interface MatchState {
  holes: MatchHole[]
  /** Vyhrané jamky obou stran. */
  won: [number, number]
  halved: number
  /** Jamky, které ještě nejsou rozhodnuté (ani odehrané). */
  remaining: number
  /** Náskok vedoucí strany. */
  lead: number
  leaderIndex: 0 | 1 | null
  /** Je zápas matematicky rozhodnutý? */
  decided: boolean
  /** Byla odehraná poslední jamka (nebo zápas skončil dřív)? */
  finished: boolean
  /** Golfová notace stavu: `AS`, `2 UP`, `3&2`, `1 UP` (po dohrání). */
  notation: string
  /** Kolik jamek ještě není rozhodnutých. */
  pending: number
}

export interface MatchInput {
  holeOrder: number[]
  scoreOf: (side: 0 | 1, hole: number) => number | undefined
}

export function computeMatch(input: MatchInput): MatchState {
  const won: [number, number] = [0, 0]
  let halved = 0
  let pending = 0
  let decidedAt: number | null = null
  const holes: MatchHole[] = []
  const total = input.holeOrder.length

  input.holeOrder.forEach((hole, played) => {
    if (decidedAt !== null) {
      holes.push({ hole, decided: false, winner: null, outOfPlay: true })
      return
    }
    const a = input.scoreOf(0, hole)
    const b = input.scoreOf(1, hole)
    if (a === undefined || b === undefined) {
      pending += 1
      holes.push({ hole, decided: false, winner: null, outOfPlay: false })
      return
    }
    let winner: 0 | 1 | null = null
    if (a < b) winner = 0
    else if (b < a) winner = 1
    if (winner === null) halved += 1
    else won[winner] += 1
    holes.push({ hole, decided: true, winner, outOfPlay: false })

    const lead = Math.abs(won[0] - won[1])
    const remainingAfter = total - (played + 1)
    if (pending === 0 && lead > remainingAfter) decidedAt = played
  })

  const lead = Math.abs(won[0] - won[1])
  const leaderIndex: 0 | 1 | null = won[0] === won[1] ? null : won[0] > won[1] ? 0 : 1
  const playedCount = won[0] + won[1] + halved
  const remaining = total - playedCount - pending
  const decided = decidedAt !== null
  const finished = decided || (pending === 0 && remaining === 0)

  let notation: string
  if (decided && decidedAt !== null) {
    const left = total - (decidedAt + 1)
    notation = left > 0 ? `${lead}&${left}` : `${lead} UP`
  } else if (leaderIndex === null) {
    notation = 'AS'
  } else {
    notation = `${lead} UP`
  }

  return {
    holes,
    won,
    halved,
    remaining: Math.max(0, remaining),
    lead,
    leaderIndex,
    decided,
    finished,
    notation,
    pending,
  }
}
