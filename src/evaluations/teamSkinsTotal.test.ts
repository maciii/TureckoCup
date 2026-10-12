import { describe, expect, it } from 'vitest'
import { SEED_PLAYERS, seedRounds } from '../data/seed'
import type { TournamentRound } from '../model/types'
import { parAt } from '../model/round'
import { teamSkinsSummary } from './teamSkinsTotal'

/** Všech osm hráčů zapíše jamky; `overrides` mění ránu hráče na jamce. */
function played(
  round: TournamentRound,
  holes: number,
  overrides: Record<string, Record<number, number>> = {},
) {
  round.status = 'live'
  for (const id of round.playerIds)
    for (let hole = 0; hole < holes; hole++) {
      round.scores[id]![String(hole)] = overrides[id]?.[hole] ?? parAt(round, hole)
    }
}

describe('Team Skins přes odehraná kola', () => {
  it('brutto: kdo zahrál nejlepší ránu týmu, bere skin i s bankem', () => {
    const rounds = seedRounds()
    const round = rounds[0]!
    // Jamka 1 a 2 dělené (všichni par), jamka 3: Ota (tým A) o ránu líp -> 3 skiny.
    const par3 = parAt(round, 2) - 1
    played(round, 3, { p3: { 2: par3 } })
    const summary = teamSkinsSummary(rounds, SEED_PLAYERS, 'gross')
    expect(summary.rounds).toHaveLength(1)
    const holes = summary.rounds[0]!.holes
    expect(holes.map((h) => h.winner)).toEqual([null, null, 'A'])
    expect(holes[2]!.skins).toBe(3)
    expect(holes[2]!.players).toEqual(['p3'])
    expect(holes[2]!.best.A).toBe(par3)
    expect(summary.totals).toEqual({ A: 3, B: 0 })
  })

  it('plánovaná kola se nepočítají, netto bere rány z HCP', () => {
    const rounds = seedRounds()
    played(rounds[0]!, 2)
    const gross = teamSkinsSummary(rounds, SEED_PLAYERS, 'gross')
    const net = teamSkinsSummary(rounds, SEED_PLAYERS, 'net')
    expect(gross.rounds).toHaveLength(1)
    expect(net.rounds).toHaveLength(1)
    expect(net.mode).toBe('net')
    // Všichni par: brutto jsou jamky dělené; netto rozhodnou rány z HCP.
    expect(gross.totals).toEqual({ A: 0, B: 0 })
    expect(gross.rounds[0]!.carry).toBe(2)
  })
})
