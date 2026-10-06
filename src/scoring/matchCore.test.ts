import { describe, expect, it } from 'vitest'
import { computeMatch } from './matchCore'

function match(a: (number | undefined)[], b: (number | undefined)[]) {
  return computeMatch({
    holeOrder: a.map((_, i) => i),
    scoreOf: (side, hole) => (side === 0 ? a[hole] : b[hole]),
  })
}

describe('jamkovka', () => {
  it('vede strana s víc vyhranými jamkami', () => {
    const state = match([4, 4, 3, undefined, undefined], [5, 4, 4, undefined, undefined])
    expect(state.won).toEqual([2, 0])
    expect(state.halved).toBe(1)
    expect(state.leaderIndex).toBe(0)
    expect(state.notation).toBe('2 UP')
    expect(state.decided).toBe(false)
  })

  it('shoda je AS', () => {
    expect(match([4, 5], [5, 4]).notation).toBe('AS')
  })

  it('zápas končí, když náskok převýší zbývající jamky', () => {
    // 3 jamky vyhrané z pěti, zbývají 2: 3&2.
    const state = match([3, 3, 3, undefined, undefined], [4, 4, 4, undefined, undefined])
    expect(state.decided).toBe(true)
    expect(state.notation).toBe('3&2')
    expect(state.holes[3]?.outOfPlay).toBe(true)
    expect(state.finished).toBe(true)
  })

  it('rozhodnutí až na poslední jamce je "1 UP"', () => {
    const state = match([4, 4], [4, 5])
    expect(state.decided).toBe(true)
    expect(state.notation).toBe('1 UP')
  })

  it('nerozhodnutá jamka drží zápas otevřený a brání rozhodnutí', () => {
    const state = match([3, undefined, 3], [4, 4, 4])
    expect(state.pending).toBe(1)
    expect(state.won).toEqual([2, 0])
    expect(state.decided).toBe(false)
  })

  it('zvednutá jamka připadá soupeři', () => {
    const state = match([Infinity], [6])
    expect(state.won).toEqual([0, 1])
  })

  it('oba zvedli = dělená jamka', () => {
    expect(match([Infinity], [Infinity]).halved).toBe(1)
  })
})
