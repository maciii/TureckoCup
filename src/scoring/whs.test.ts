import { describe, expect, it } from 'vitest'
import {
  courseHandicap,
  formatHandicapIndex,
  normalizeStrokeIndex,
  parseHandicapIndex,
  playerCourseHandicap,
  stablefordPoints,
  strokesForHole,
} from './whs'

/** Testy převzaté z Golfgames (`handicap.test.ts`) - vzorce se nesmí rozejít. */

const SI_18 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

describe('zadání handicapového indexu', () => {
  it('parseHandicapIndex přijme tečku i čárku', () => {
    expect(parseHandicapIndex('30.1')).toBe(30.1)
    expect(parseHandicapIndex('30,1')).toBe(30.1)
    expect(parseHandicapIndex('')).toBeNull()
  })

  it('formatHandicapIndex zobrazí obojí zadání stejně', () => {
    expect(formatHandicapIndex(12.7)).toBe('12,7')
    expect(formatHandicapIndex(18)).toBe('18')
    expect(formatHandicapIndex(null)).toBe('')
  })
})

describe('courseHandicap', () => {
  it('na neutrálním hřišti vrací index zaokrouhlený', () => {
    expect(courseHandicap(18.4, 113, 72, 72)).toBe(18)
  })

  it('těžší slope handicap zvedá', () => {
    expect(courseHandicap(18.4, 132, 72, 72)).toBe(21)
  })

  it('rozdíl CR a paru se přičítá', () => {
    expect(courseHandicap(10, 113, 74.5, 72)).toBe(13)
  })

  it('plusový hráč dostává záporný handicap', () => {
    expect(courseHandicap(-2.4, 113, 72, 72)).toBe(-2)
  })

  it('devítka z osmnáctijamkové normy dává polovinu ran', () => {
    expect(courseHandicap(18.4, 132, 72, 72, 9, 18)).toBe(11)
    expect(courseHandicap(10, 113, 74.5, 72, 9, 18)).toBe(6)
  })

  it('turnajová hřiště: Mac 12,7 z bílých', () => {
    // Aspendos white 70,5/130 par 72: 12,7 × 130/113 − 1,5 = 13,1 -> 13
    expect(courseHandicap(12.7, 130, 70.5, 72)).toBe(13)
    // Lykia Links white 74,7/133 par 73: 14,95 + 1,7 = 16,65 -> 17
    expect(courseHandicap(12.7, 133, 74.7, 73)).toBe(17)
    // Carya white 72,3/136 par 72: 15,29 + 0,3 = 15,59 -> 16
    expect(courseHandicap(12.7, 136, 72.3, 72)).toBe(16)
    // Kaya Palazzo white 71,0/127 par 72: 14,27 − 1 = 13,27 -> 13
    expect(courseHandicap(12.7, 127, 71, 72)).toBe(13)
  })
})

describe('playerCourseHandicap', () => {
  it('z různých odpališť vyjdou různé rány', () => {
    const yellow = { courseRating: 72.9, slopeRating: 132, par: 73 }
    const red = { courseRating: 68.6, slopeRating: 122, par: 73 }
    expect(playerCourseHandicap(18.4, yellow, 18, 73)).toBe(21)
    expect(playerCourseHandicap(30.1, red, 18, 73)).toBe(28)
    expect(playerCourseHandicap(30.1, yellow, 18, 73)).toBe(35)
  })

  it('odpaliště bez normy bere index rovnou jako rány', () => {
    expect(playerCourseHandicap(18.4, { par: 73 }, 18, 73)).toBe(18)
    expect(playerCourseHandicap(18.4, undefined, 18, 73)).toBe(18)
  })
})

describe('strokesForHole', () => {
  it('handicap 0 nedává rány nikde', () => {
    for (const si of SI_18) expect(strokesForHole(0, si, 18)).toBe(0)
  })

  it('handicap 9 dává ránu na devíti nejtěžších jamkách', () => {
    const total = SI_18.reduce((sum, si) => sum + strokesForHole(9, si, 18), 0)
    expect(total).toBe(9)
    expect(strokesForHole(9, 9, 18)).toBe(1)
    expect(strokesForHole(9, 10, 18)).toBe(0)
  })

  it('handicap 27 dává dvě rány na devíti nejtěžších, jinde jednu', () => {
    expect(strokesForHole(27, 1, 18)).toBe(2)
    expect(strokesForHole(27, 10, 18)).toBe(1)
    const total = SI_18.reduce((sum, si) => sum + strokesForHole(27, si, 18), 0)
    expect(total).toBe(27)
  })

  it('plusový handicap rány naopak bere, a to od nejlehčí jamky', () => {
    expect(strokesForHole(-3, 18, 18)).toBe(-1)
    expect(strokesForHole(-3, 16, 18)).toBe(-1)
    expect(strokesForHole(-3, 15, 18)).toBe(0)
  })
})

describe('normalizeStrokeIndex', () => {
  it('SI, které už je pořadím, nechává být', () => {
    expect(normalizeStrokeIndex([3, 1, 2], 3)).toEqual([3, 1, 2])
  })

  it('zachovává pořadí obtížnosti, ne jen hodnoty', () => {
    expect(normalizeStrokeIndex([11, 3, 17, 1], 4)).toEqual([3, 2, 4, 1])
  })

  it('chybějící nebo nesedící SI nahradí pořadím jamek', () => {
    expect(normalizeStrokeIndex([], 3)).toEqual([1, 2, 3])
  })
})

describe('stablefordPoints', () => {
  it('par jsou dva body, každá rána nad par jeden dolů', () => {
    expect(stablefordPoints(-2)).toBe(4)
    expect(stablefordPoints(-1)).toBe(3)
    expect(stablefordPoints(0)).toBe(2)
    expect(stablefordPoints(1)).toBe(1)
    expect(stablefordPoints(2)).toBe(0)
    expect(stablefordPoints(5)).toBe(0)
  })
})
