import { describe, expect, it } from 'vitest'
import { EMPTY_STATE } from '../model/types'
import type { TournamentState } from '../model/types'
import { SEED_ACCESS, SEED_PLAYERS, SEED_TOURNAMENT, seedRounds } from './seed'
import { DELETE_FIELD, applyOp, opToWrites } from './ops'
import type { Op, OpMeta } from './ops'

const meta: OpMeta = {
  uid: 'u1',
  email: 'a@b.cz',
  clientAt: '2026-10-08T07:00:00Z',
  appVersion: '0.1.0',
}

function initial(): TournamentState {
  return applyOp(EMPTY_STATE, {
    kind: 'init',
    tournament: SEED_TOURNAMENT,
    players: SEED_PLAYERS,
    rounds: seedRounds(),
    access: SEED_ACCESS,
  })
}

/**
 * Ruční aplikace field-path zápisu na dokument - napodobuje, co dělá
 * Firestore `update()` s tečkovou notací.
 */
function applyFieldPaths(doc: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split('.')
    let target: Record<string, unknown> = doc
    for (const part of parts.slice(0, -1)) {
      const next = target[part]
      if (typeof next !== 'object' || next === null) {
        target[part] = {}
      }
      target = target[part] as Record<string, unknown>
    }
    const last = parts[parts.length - 1]!
    if (value === DELETE_FIELD) delete target[last]
    else target[last] = value
  }
}

describe('applyOp a opToWrites se shodují', () => {
  it('zápis, oprava i smazání jedné buňky', () => {
    let state = initial()
    const ops: Op[] = [
      { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 0, value: 4 },
      { kind: 'setScore', roundId: 'r1', playerId: 'p2', hole: 0, value: 0 },
      { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 0, value: 5 },
      { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 17, value: 3 },
      { kind: 'setScore', roundId: 'r1', playerId: 'p2', hole: 0, value: null },
    ]
    const doc = structuredClone(state.rounds[0]!) as unknown as Record<string, unknown>

    for (const op of ops) {
      const writes = opToWrites(op, meta, state)
      const roundWrite = writes.find((w) => w.path.join('/') === 'rounds/r1')!
      expect(roundWrite.mode).toBe('update')
      const { lastEdit: _edit, ...fields } = roundWrite.data
      applyFieldPaths(doc, fields)
      state = applyOp(state, op)
    }

    expect(state.rounds[0]!.scores).toEqual((doc as { scores: unknown }).scores)
    expect(state.rounds[0]!.scores.p1).toEqual({ '0': 5, '17': 3 })
    expect(state.rounds[0]!.scores.p2).toEqual({})
  })

  it('zápis skóre loguje odkud kam', () => {
    let state = initial()
    state = applyOp(state, {
      kind: 'setScore',
      roundId: 'r1',
      playerId: 'p1',
      hole: 3,
      value: 4,
    })
    const writes = opToWrites(
      { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 3, value: 6 },
      meta,
      state,
    )
    const log = writes.find((w) => w.autoId)!
    expect(log.path).toEqual(['rounds', 'r1', 'edits'])
    expect(log.data).toMatchObject({
      playerId: 'p1',
      hole: '3',
      from: 4,
      to: 6,
      by: 'u1',
    })
  })

  it('vymazání skóre kola nechá hráče s prázdnými mapami', () => {
    let state = initial()
    state = applyOp(state, {
      kind: 'setScore',
      roundId: 'r1',
      playerId: 'p1',
      hole: 3,
      value: 4,
    })
    state = applyOp(state, { kind: 'clearScores', roundId: 'r1' })
    expect(Object.keys(state.rounds[0]!.scores)).toHaveLength(8)
    expect(state.rounds[0]!.scores.p1).toEqual({})
  })

  it('úprava hráče a kola se promítne', () => {
    let state = initial()
    state = applyOp(state, {
      kind: 'updatePlayer',
      playerId: 'p4',
      patch: { handicapIndex: 20.3 },
    })
    state = applyOp(state, {
      kind: 'updateRound',
      roundId: 'r2',
      patch: { status: 'live' },
    })
    expect(state.players.find((p) => p.id === 'p4')?.handicapIndex).toBe(20.3)
    expect(state.rounds[1]?.status).toBe('live')
  })

  it('init píše turnaj, oprávnění, hráče i kola', () => {
    const writes = opToWrites(
      {
        kind: 'init',
        tournament: SEED_TOURNAMENT,
        players: SEED_PLAYERS,
        rounds: seedRounds(),
        access: SEED_ACCESS,
      },
      meta,
      EMPTY_STATE,
    )
    expect(writes).toHaveLength(1 + 1 + 8 + 5)
    const round = writes.find((w) => w.path.join('/') === 'rounds/r1')!
    expect(round.data).toHaveProperty('scores.p8')
  })
})
