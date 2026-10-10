import { describe, expect, it } from 'vitest'
import { PICKED_UP } from '../model/types'
import { DEFAULT_BONUS_CONFIG } from '../model/bonuses'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import { previewRounds, PREVIEW_PLAYERS } from '../data/preview'
import { awardSignature, awardsOf, computeAwards } from './awards'

function round1() {
  const round = seedRounds()[0]!
  round.status = 'live'
  return round
}

const by = (summary: ReturnType<typeof computeAwards>, id: string) =>
  summary.results.find((r) => r.award.id === id)!

describe('odznaky zájezdu', () => {
  it('plánovaná kola se nepočítají, bez skóre nikdo nic nedrží', () => {
    const summary = computeAwards(seedRounds(), SEED_PLAYERS, DEFAULT_BONUS_CONFIG)
    expect(summary.rounds).toBe(0)
    expect(summary.results.every((r) => r.holders.length === 0)).toBe(true)
    expect(summary.date).toBeNull()
  })

  it('počítá výsledky proti paru, Stableford netto, série a zvednutou jamku', () => {
    const round = round1()
    // Aspendos: pary 4,4,3,4,5 … Mac (13 ran z bílých? kolo hraje ze žlutých) - bere se
    // hrací HCP kola; brutto výsledky jsou nezávislé na HCP.
    round.scores.p1 = { '0': 3, '1': 4, '2': 3, '3': 5, '4': 7, '5': 6, '6': PICKED_UP }
    round.scores.p2 = { '0': 4, '1': 4, '2': 2, '3': 4 }
    const summary = computeAwards([round], SEED_PLAYERS, DEFAULT_BONUS_CONFIG)
    expect(summary.rounds).toBe(1)
    expect(summary.date).toBe(round.date)
    expect(by(summary, 'birdie').rows.find((r) => r.id === 'p1')!.value).toBe(1)
    expect(by(summary, 'par').rows.find((r) => r.id === 'p1')!.value).toBe(2)
    expect(by(summary, 'bogey').rows.find((r) => r.id === 'p1')!.value).toBe(1)
    // Sedmička na par 5 i šestka na par 4 jsou dvojbogey.
    expect(by(summary, 'double').rows.find((r) => r.id === 'p1')!.value).toBe(2)
    expect(by(summary, 'triple').rows.find((r) => r.id === 'p1')!.value).toBe(0)
    expect(by(summary, 'glutton').rows.find((r) => r.id === 'p1')!.value).toBe(1)
    // Pavlos: par, par, eagle? Dvojka na par 3 je birdie; nejdelší série par a lepší = 4.
    expect(by(summary, 'eagle').rows.find((r) => r.id === 'p2')!.value).toBe(0)
    expect(by(summary, 'birdie').rows.find((r) => r.id === 'p2')!.value).toBe(1)
    expect(by(summary, 'streak').rows.find((r) => r.id === 'p2')!.value).toBe(4)
    expect(by(summary, 'streak').holders).toEqual(['p2'])
    // Stableford: každý má body, zvednutá jamka je bez bodu.
    expect(by(summary, 'stb').rows.find((r) => r.id === 'p1')!.value).toBeGreaterThan(0)
    expect(
      by(summary, 'nostable').rows.find((r) => r.id === 'p1')!.value,
    ).toBeGreaterThanOrEqual(1)
    // Shoda: Birdie Man drží oba.
    expect(by(summary, 'birdie').holders.sort()).toEqual(['p1', 'p2'])
    expect(
      by(summary, 'birdie')
        .rows.slice(0, 3)
        .map((r) => r.position),
    ).toEqual([1, 1, 3])
  })

  it('testovací verze: každý odznak má držitele a otisk se mění s hodnotou', () => {
    const summary = computeAwards(previewRounds(), PREVIEW_PLAYERS, DEFAULT_BONUS_CONFIG)
    expect(summary.rounds).toBe(4)
    for (const result of summary.results) {
      expect(result.rows).toHaveLength(8)
      if (result.award.id !== 'eagle') expect(result.holders.length).toBeGreaterThan(0)
    }
    const stb = by(summary, 'stb')
    expect(awardsOf(summary, stb.holders[0]!).map((r) => r.award.id)).toContain('stb')
    expect(awardSignature(stb)).toBe(`stb:${stb.value}:${stb.holders.join(',')}`)
  })
})
