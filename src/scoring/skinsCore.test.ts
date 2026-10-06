import { describe, expect, it } from 'vitest'
import { computeSkins } from './skinsCore'

/**
 * Scénáře převzaté z Golfgames (`skins.test.ts`), přepsané na matici stran.
 *
 * jamka 1: 4 / 4 / 5 -> shoda na nejnižším skóre, skin se přenáší
 * jamka 2: 3 / 5 / 5 -> Adam bere jamku i přenesený skin (2 skiny)
 * jamka 3: 5 / 5 / 5 -> shoda, skin se přenáší a na konci kola propadá
 */
const sample = [
  [4, 3, 5], // Adam
  [4, 5, 5], // Bára
  [5, 5, 5], // Cyril
]

function run(matrix: (number | undefined)[][], carry = true) {
  return computeSkins({
    holeOrder: [0, 1, 2].slice(0, matrix[0]?.length ?? 0),
    scoreOf: (side, hole) => matrix[side]?.[hole],
    sideCount: matrix.length,
    carry,
  })
}

describe('Skins - rozdělení jamek', () => {
  it('při shodě nepřidělí skin a přenese ho dál', () => {
    const result = run(sample)
    expect(result.holes[0]).toEqual({
      hole: 0,
      decided: true,
      winner: null,
      skins: 0,
      carry: 1,
    })
  })

  it('vítěz další jamky bere i přenesený skin', () => {
    const result = run(sample)
    expect(result.holes[1]?.skins).toBe(2)
    expect(result.holes[1]?.winner).toBe(0)
    expect(result.totals).toEqual([2, 0, 0])
  })

  it('nerozdělené skiny na konci kola propadají', () => {
    const result = run(sample)
    expect(result.holes[2]?.winner).toBeNull()
    expect(result.carry).toBe(1)
  })

  it('kdo jamku zvedl, o skin se ucházet nemůže', () => {
    const result = run([
      [3, 4],
      [5, Infinity],
    ])
    expect(result.holes[1]).toEqual({
      hole: 1,
      decided: true,
      winner: 0,
      skins: 1,
      carry: 0,
    })
  })

  it('když zvedli všichni, jamka je dělená', () => {
    const result = run([
      [3, Infinity],
      [5, Infinity],
    ])
    expect(result.holes[1]?.winner).toBeNull()
    expect(result.holes[1]?.carry).toBe(1)
  })

  it('jamka, kde někdo nezapsal, není rozhodnutá a bank se nemění', () => {
    const result = run([
      [3, 4, 4],
      [5, undefined, 5],
    ])
    expect(result.holes[1]).toEqual({
      hole: 1,
      decided: false,
      winner: null,
      skins: 0,
      carry: 0,
    })
    expect(result.pending).toBe(1)
    // Třetí jamka se vyhodnotí i přes nerozhodnutou druhou.
    expect(result.holes[2]?.winner).toBe(0)
    expect(result.totals).toEqual([2, 0])
  })

  it('bez přenosu dělená jamka propadá hned', () => {
    const result = run(sample, false)
    expect(result.holes[0]?.carry).toBe(0)
    expect(result.holes[1]?.skins).toBe(1)
  })

  it('respektuje pořadí hraní (start z desítky)', () => {
    const result = computeSkins({
      holeOrder: [1, 0],
      scoreOf: (side, hole) =>
        [
          [3, 4],
          [5, 4],
        ][side]?.[hole],
      sideCount: 2,
    })
    // Nejdřív se hraje jamka s indexem 1 (shoda -> přenos), pak jamka 0.
    expect(result.holes[0]).toEqual({
      hole: 1,
      decided: true,
      winner: null,
      skins: 0,
      carry: 1,
    })
    expect(result.holes[1]).toEqual({
      hole: 0,
      decided: true,
      winner: 0,
      skins: 2,
      carry: 0,
    })
  })
})
