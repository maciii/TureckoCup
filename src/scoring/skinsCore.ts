/**
 * Jádro hry Skins - čistý algoritmus nad maticí ran stran.
 *
 * Každá jamka je jeden skin. Bere ho strana s nejnižší ránou; při shodě se
 * skin nepřiděluje a (volitelně) přenáší do další jamky, takže další
 * rozhodnutá jamka vynese víc skinů najednou. Přepsáno podle `skinResults()`
 * z Golfgames, bez vazby na tamní model.
 *
 * Vstupem jsou rány stran po jamkách v **pořadí hraní**:
 *   `undefined`  jamka ještě není rozhodnutá (někdo nezapsal) - bank se nemění
 *   `Infinity`   strana jamku vzdala / zvedla - o skin se ucházet nemůže
 *   číslo        rána (brutto nebo netto, podle hry)
 *
 * Rozhodnutí tam, kde pravidla mlčí: skiny přenesené z poslední jamky
 * propadají.
 */

export interface SkinHoleResult {
  /** Index jamky v kole. */
  hole: number
  /** Je jamka vyhodnocená (všechny strany zapsaly)? */
  decided: boolean
  /** Index vítězné strany, nebo null při shodě či nerozhodnuté jamce. */
  winner: number | null
  /** Kolik skinů se na jamce rozdělilo (včetně přenesených). */
  skins: number
  /** Kolik skinů se po jamce přenáší dál. */
  carry: number
}

export interface SkinsOutcome {
  holes: SkinHoleResult[]
  /** Vyhrané skiny po stranách. */
  totals: number[]
  /** Skiny čekající v banku po poslední vyhodnocené jamce. */
  carry: number
  /** Kolik jamek je ještě nerozhodnutých. */
  pending: number
}

export interface SkinsInput {
  /** Pořadí jamek, jak se hrály (indexy jamek v kole). */
  holeOrder: number[]
  /** Rána strany na jamce; `scoreOf(side, hole)`. */
  scoreOf: (side: number, hole: number) => number | undefined
  sideCount: number
  /** Dělená jamka přenáší skin dál (výchozí ano). */
  carry?: boolean
}

export function computeSkins(input: SkinsInput): SkinsOutcome {
  const { holeOrder, scoreOf, sideCount } = input
  const carryOver = input.carry ?? true
  const totals = Array<number>(sideCount).fill(0)
  const holes: SkinHoleResult[] = []
  let carry = 0
  let pending = 0

  for (const hole of holeOrder) {
    const scores = Array.from({ length: sideCount }, (_, side) => scoreOf(side, hole))

    if (scores.some((score) => score === undefined)) {
      // Jamka není rozhodnutá - bank se nemění, ale jamka stále "visí".
      pending += 1
      holes.push({ hole, decided: false, winner: null, skins: 0, carry })
      continue
    }

    const values = scores as number[]
    const lowest = Math.min(...values)
    const leaders = values.flatMap((value, side) => (value === lowest ? [side] : []))

    if (leaders.length === 1 && Number.isFinite(lowest)) {
      const winner = leaders[0] ?? 0
      const skins = carry + 1
      totals[winner] = (totals[winner] ?? 0) + skins
      carry = 0
      holes.push({ hole, decided: true, winner, skins, carry: 0 })
    } else {
      // Dělená jamka (nebo všichni zvedli): skin se přenáší, nebo propadá.
      carry = carryOver ? carry + 1 : 0
      holes.push({ hole, decided: true, winner: null, skins: 0, carry })
    }
  }

  return { holes, totals, carry, pending }
}
