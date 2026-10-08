import { describe, expect, it } from 'vitest'
import { EMPTY_STATE } from '../model/types'
import type { TournamentRound, TournamentState } from '../model/types'
import {
  SEED_ACCESS,
  SEED_PLAYERS,
  SEED_TOURNAMENT,
  indexSyncOps,
  playerIndexOps,
  positionFixOps,
  rosterOutdated,
  rosterSnapshot,
  seedRounds,
} from './seed'
import {
  DELETE_FIELD,
  applyOp,
  checkOp,
  findInvalidValue,
  findInvalidWrite,
  opProblemMessage,
  opToWrites,
} from './ops'
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

describe('kontrola dat podle pravidel Firestoru', () => {
  it('findInvalidValue najde undefined i díru v poli', () => {
    expect(findInvalidValue({ a: 1, b: undefined })).toBe('b')
    expect(findInvalidValue(undefined)).toBe('/')
    const sparse: string[] = []
    sparse[2] = 'x'
    expect(findInvalidValue({ positions: { A: sparse } })).toBe('positions.A[0]')
  })

  it('findInvalidValue najde pole v poli', () => {
    expect(findInvalidValue({ flights: [['p1']] })).toBe('flights[0]')
  })

  it('platná data i sentinely projdou', () => {
    expect(
      findInvalidValue({
        'scores.p1.0': 4,
        'scores.p1.1': DELETE_FIELD,
        flights: [{ players: ['p1'], startHole: 0 }],
        positions: { A: ['p1', '', '', ''] },
      }),
    ).toBeNull()
  })

  it('findInvalidWrite vrátí cestu dokumentu a pole', () => {
    const state = initial()
    const sparse: string[] = []
    sparse[1] = 'p1'
    const writes = opToWrites(
      {
        kind: 'updateRound',
        roundId: 'r1',
        patch: { positions: { A: sparse, B: ['p2', 'p4', 'p6', 'p8'] } },
      },
      meta,
      state,
    )
    expect(findInvalidWrite(writes)).toBe('rounds/r1/positions.A[0]')
  })

  it('zápis skóre (field path s tečkami) je platný', () => {
    const state = initial()
    const writes = opToWrites(
      { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 0, value: 4 },
      meta,
      state,
    )
    expect(findInvalidWrite(writes)).toBeNull()
  })
})

describe('checkOp - stejná pravidla pro ukázkový režim i Firestore', () => {
  const score: Op = { kind: 'setScore', roundId: 'r1', playerId: 'p1', hole: 0, value: 4 }
  const config: Op = { kind: 'updateRound', roundId: 'r1', patch: { status: 'live' } }

  it('visitor nezapíše nic', () => {
    expect(checkOp(score, 'visitor', [])).toEqual({ kind: 'signInFirst' })
  })

  it('zapisovatel zapíše skóre, ale ne konfiguraci kola', () => {
    expect(checkOp(score, 'writer', opToWrites(score, meta, initial()))).toBeNull()
    expect(checkOp(config, 'writer', [])).toEqual({ kind: 'adminOnly' })
  })

  it('admin projde, ale neplatná data ne', () => {
    expect(checkOp(config, 'admin', opToWrites(config, meta, initial()))).toBeNull()
    const problem = checkOp(config, 'admin', [
      { path: ['rounds', 'r1'], mode: 'update', data: { note: undefined } },
    ])
    expect(problem).toEqual({ kind: 'invalidData', field: 'rounds/r1/note' })
    expect(opProblemMessage(problem!)).toContain('rounds/r1/note')
  })
})

describe('extra body', () => {
  it('zápis bonusu je jedna buňka s lastEdit, prázdný seznam klíč smaže', () => {
    let state = initial()
    const op: Op = {
      kind: 'setBonuses',
      roundId: 'r1',
      playerId: 'p1',
      hole: 4,
      value: ['longest'],
    }
    // Zápisy vznikají ze stavu před změnou - log nese předchozí hodnotu.
    const writes = opToWrites(op, meta, state)
    state = applyOp(state, op)
    expect(state.rounds[0]!.bonuses.p1).toEqual({ '4': ['longest'] })
    // Buňka + záznam v logu úprav: kdo komu kdy který bonus přiznal.
    expect(writes).toHaveLength(2)
    expect(writes[0]!.data).toEqual({
      'bonuses.p1.4': ['longest'],
      lastEdit: { playerId: 'p1', hole: '4', by: 'u1', at: expect.anything() },
    })
    expect(writes[1]!.path).toEqual(['rounds', 'r1', 'edits'])
    expect(writes[1]!.data).toMatchObject({
      playerId: 'p1',
      hole: '4',
      from: null,
      to: null,
      bonusFrom: [],
      bonusTo: ['longest'],
      by: 'u1',
      byEmail: 'a@b.cz',
    })
    expect(findInvalidWrite(writes)).toBeNull()
    expect(checkOp(op, 'writer', writes)).toBeNull()

    const clear: Op = { ...op, value: [] }
    state = applyOp(state, clear)
    expect(state.rounds[0]!.bonuses.p1).toEqual({})
    expect(opToWrites(clear, meta, state)[0]!.data['bonuses.p1.4']).toBe(DELETE_FIELD)
  })
})

describe('snímek soupisky do kola', () => {
  it('promítne HCP, pozice a flighty, ale nechá start, tee time, odpaliště i hry', () => {
    const state = initial()
    const round: TournamentRound = {
      ...state.rounds[0]!,
      defaultTeeId: 'yellow',
      flights: [
        { ...state.rounds[0]!.flights[0]!, startHole: 9, teeTime: '15:50' },
        { ...state.rounds[0]!.flights[1]!, teeTime: '16:00' },
      ],
    }
    expect(rosterOutdated(round, state.players)).toBe(false)
    // Firestore vrací klíče mapy v libovolném pořadí - pořadí týmů není rozdíl.
    const swapped = { B: round.positions.B, A: round.positions.A }
    expect(rosterOutdated({ ...round, positions: swapped }, state.players)).toBe(false)
    // Soldík dostane index a přejde do týmu A na pozici 1, Ota jde na trojku.
    const players = state.players.map((p) =>
      p.id === 'p4'
        ? { ...p, handicapIndex: 18.8, teamId: 'A' as const, position: 1 as const }
        : p.id === 'p3'
          ? { ...p, position: 3 as const }
          : p,
    )
    expect(rosterOutdated(round, players)).toBe(true)
    const patch = rosterSnapshot(round, players)
    expect(patch.playerIndex.p4).toBe(18.8)
    expect(patch.positions.A[0]).toBe('p4')
    expect(patch.flights[0]!.players).toContain('p4')
    expect(patch.flights[0]!.startHole).toBe(9)
    expect(patch.flights[0]!.teeTime).toBe('15:50')
    expect(patch.flights[1]!.teeTime).toBe('16:00')
    expect(Object.keys(patch)).toEqual([
      'handicapMode',
      'playerIndex',
      'positions',
      'flights',
    ])
    // Režim hracího HCP je taky součást snímku.
    expect(rosterOutdated(round, state.players, 'fixed')).toBe(true)
    expect(rosterSnapshot(round, state.players, 'fixed').handicapMode).toBe('fixed')
    const synced = applyOp(state, { kind: 'updateRound', roundId: 'r1', patch })
    expect(
      rosterOutdated({ ...synced.rounds[0]!, flights: patch.flights }, players),
    ).toBe(false)
    expect(
      findInvalidWrite(
        opToWrites({ kind: 'updateRound', roundId: 'r1', patch }, meta, state),
      ),
    ).toBeNull()
  })
})

describe('HCP index patří hráči', () => {
  it('změna indexu jde hráči a všem nedohraným kolům, dohrané si nechají snímek', () => {
    let state = initial()
    state = applyOp(state, {
      kind: 'updateRound',
      roundId: 'r1',
      patch: { status: 'finished' },
    })
    state = applyOp(state, {
      kind: 'updateRound',
      roundId: 'r2',
      patch: { status: 'live' },
    })
    const ops = playerIndexOps(state, 'p4', 18.8)
    expect(ops[0]).toEqual({
      kind: 'updatePlayer',
      playerId: 'p4',
      patch: { handicapIndex: 18.8 },
    })
    expect(
      ops.slice(1).map((op) => (op.kind === 'updateRound' ? op.roundId : '')),
    ).toEqual(['r2', 'r3', 'r4', 'r5'])
    for (const op of ops) state = applyOp(state, op)
    expect(state.players.find((p) => p.id === 'p4')?.handicapIndex).toBe(18.8)
    expect(state.rounds[0]!.playerIndex.p4).toBeNull()
    expect(state.rounds[1]!.playerIndex.p4).toBe(18.8)
    expect(state.rounds[4]!.playerIndex.p4).toBe(18.8)
    // Beze změny se nic nepíše.
    expect(playerIndexOps(state, 'p4', 18.8)).toHaveLength(1)
    for (const op of ops) expect(findInvalidWrite(opToWrites(op, meta, state))).toBeNull()
  })
})

describe('automatické srovnání soupisky', () => {
  it('indexSyncOps zapíše index hráče do nedohraných kol jedním zápisem na kolo', () => {
    let state = initial()
    state = applyOp(state, {
      kind: 'updateRound',
      roundId: 'r1',
      patch: { status: 'finished' },
    })
    state = applyOp(state, {
      kind: 'updatePlayer',
      playerId: 'p4',
      patch: { handicapIndex: 18.8 },
    })
    state = applyOp(state, {
      kind: 'updatePlayer',
      playerId: 'p8',
      patch: { handicapIndex: 20.7 },
    })
    const ops = indexSyncOps(state)
    expect(ops.map((op) => (op.kind === 'updateRound' ? op.roundId : ''))).toEqual([
      'r2',
      'r3',
      'r4',
      'r5',
    ])
    for (const op of ops) state = applyOp(state, op)
    expect(state.rounds[0]!.playerIndex.p4).toBeNull()
    expect(state.rounds[1]!.playerIndex).toMatchObject({ p4: 18.8, p8: 20.7, p1: 12.7 })
    expect(indexSyncOps(state)).toEqual([])
  })

  it('positionFixOps srovná duplicitní pozice podle pořadí', () => {
    const state = initial()
    // Soldík (B3) i Honza (B4) na trojce, Jarin (A3) a Vrbič (A4) na čtyřce.
    const players = state.players.map((p) =>
      p.id === 'p8'
        ? { ...p, position: 3 as const }
        : p.id === 'p5'
          ? { ...p, position: 4 as const }
          : p,
    )
    const ops = positionFixOps(players)
    // Jarin před Vrbičem (pořadí v soupisce) dostane trojku, Honza za Soldíkem čtyřku.
    expect(ops).toEqual([
      { kind: 'updatePlayer', playerId: 'p5', patch: { position: 3 } },
      { kind: 'updatePlayer', playerId: 'p8', patch: { position: 4 } },
    ])
    expect(positionFixOps(state.players)).toEqual([])
  })
})
