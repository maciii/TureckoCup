import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, PICKED_UP } from '../model/types'
import type { TournamentRound } from '../model/types'
import { flightCurrentHole, holeCount, holeOrder, isEntered } from '../model/round'
import { evaluateRound } from '../evaluations'
import { summarizeTournament } from '../evaluations/tournament'
import { applyOp, findInvalidValue } from './ops'
import { PREVIEW_PLAYERS, PREVIEW_SEED, previewRounds, previewState } from './preview'

const rounds = previewRounds()

function entered(round: TournamentRound): number {
  return round.playerIds.reduce(
    (sum, id) => sum + Object.keys(round.scores[id] ?? {}).length,
    0,
  )
}

/** Otisk her kola: druh, formát, rozsah, bodování - bez id a názvu. */
function gamesFingerprint(round: TournamentRound): string {
  return JSON.stringify(
    round.games.map((g) => [
      g.kind,
      g.options,
      g.holes ?? null,
      g.countsForTeam,
      g.teamPoints,
      g.sides?.length ?? 0,
    ]),
  )
}

describe('testovací verze turnaje', () => {
  it('má tři dohraná kola, jedno rozehrané a jedno plánované', () => {
    expect(rounds.map((r) => r.status)).toEqual([
      'finished',
      'finished',
      'finished',
      'live',
      'planned',
    ])
    for (const round of rounds.slice(0, 3)) {
      expect(entered(round)).toBe(8 * holeCount(round))
    }
    expect(entered(rounds[4]!)).toBe(0)
  })

  it('čtvrté kolo: první flight dohrál, druhý je na patnácté jamce', () => {
    const round = rounds[3]!
    const [first, second] = round.flights
    for (const id of first!.players) {
      expect(Object.keys(round.scores[id]!)).toHaveLength(18)
    }
    expect(flightCurrentHole(round, second!)).toBe(14)
    // Patnáctka zapsaná jen u první dvojice, šestnáctka u nikoho.
    expect(second!.players.map((id) => isEntered(round, id, 14))).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(second!.players.some((id) => isEntered(round, id, 15))).toBe(false)
    // Ukázkový zapisovatel (Ferry) má co dopsat.
    expect(second!.players).toContain('p6')
  })

  it('každý den jiné hry, pozice i nastavení kola', () => {
    const played = rounds.slice(0, 4)
    expect(new Set(played.map(gamesFingerprint)).size).toBe(4)
    expect(new Set(played.map((r) => JSON.stringify(r.positions))).size).toBe(4)
    expect(new Set(played.map((r) => r.course.id)).size).toBe(4)
    expect(rounds[0]!.defaultTeeId).toBe('yellow')
    expect(rounds[1]!.playerTees).toEqual({ p8: 'red' })
    expect(rounds[2]!.flights[1]!.startHole).toBe(9)
    expect(holeOrder(rounds[2]!, rounds[2]!.flights[1])[0]).toBe(9)
    expect(rounds[3]!.courseHandicapOverride).toEqual({ p8: 30 })
    // Všechny druhy her se aspoň jednou objeví.
    const kinds = new Set(played.flatMap((r) => r.games.map((g) => g.kind)))
    expect(kinds.size).toBe(5)
  })

  it('flighty odpovídají pozicím kola a každý hráč hraje právě jednou', () => {
    for (const round of rounds) {
      const { A, B } = round.positions
      expect(round.flights[0]!.players).toEqual([A[0], A[1], B[0], B[1]])
      expect(round.flights[1]!.players).toEqual([A[2], A[3], B[2], B[3]])
      expect(new Set(round.flights.flatMap((f) => f.players)).size).toBe(8)
    }
  })

  it('skóre je realistické: rozumné rány, pár zvednutých jamek', () => {
    const values = rounds.flatMap((r) =>
      Object.values(r.scores).flatMap((holes) => Object.values(holes)),
    )
    const picked = values.filter((v) => v === PICKED_UP).length
    expect(values.every((v) => Number.isInteger(v) && v >= 0 && v <= 20)).toBe(true)
    expect(picked).toBeGreaterThan(0)
    expect(picked / values.length).toBeLessThan(0.06)
  })

  it('stejné semínko dá stejný turnaj, jiné jiný', () => {
    expect(previewRounds(PREVIEW_SEED)).toEqual(rounds)
    expect(previewRounds(PREVIEW_SEED + 1)[0]!.scores).not.toEqual(rounds[0]!.scores)
  })

  it('všechny hry dají výsledky a týmové skóre není prázdné', () => {
    for (const round of rounds.slice(0, 4)) {
      for (const result of evaluateRound(round, PREVIEW_PLAYERS)) {
        expect(result.rows.length, `${round.id}/${result.game.id}`).toBeGreaterThan(0)
        if (result.duels) {
          expect(result.duels.length, `${round.id}/${result.game.id}`).toBeGreaterThan(0)
        }
      }
    }
    const fourBall = evaluateRound(rounds[2]!, PREVIEW_PLAYERS).find(
      (r) => r.game.kind === 'team-match',
    )
    expect(fourBall?.duels).toHaveLength(2)
    expect(fourBall?.duels?.every((d) => d.finished)).toBe(true)

    const summary = summarizeTournament(rounds, PREVIEW_PLAYERS)
    expect(summary.rounds).toHaveLength(4)
    expect(summary.teamPoints.A + summary.teamPoints.B).toBeGreaterThan(0)
    expect(summary.provisional).toBe(false)
    // Pozice 3 a 4 hrají ve čtvrtém kole v rozehraném druhém flightu.
    expect(summary.positions.map((p) => p.rounds)).toEqual([4, 4, 3, 3])
  })

  it('projde stejnou kontrolou dat jako Firestore a založí se operací init', () => {
    const state = previewState()
    expect(findInvalidValue(state)).toBeNull()
    expect(PREVIEW_PLAYERS.every((p) => typeof p.handicapIndex === 'number')).toBe(true)
    expect(Object.keys(state.access.playerEmails)).toHaveLength(8)
    const initialized = applyOp(EMPTY_STATE, { kind: 'init', ...state })
    expect(initialized.rounds).toHaveLength(5)
    expect(initialized.rounds[3]!.scores).toEqual(rounds[3]!.scores)
  })
})
