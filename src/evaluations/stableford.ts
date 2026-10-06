import type { PlayerId, TeamId, TournamentRound } from '../model/types'
import { gameHoles, grossTotal, netScoreAt, parAt, teamOf } from '../model/round'
import { stablefordPoints } from '../scoring/whs'
import type { Evaluate, EvaluationResult, HoleOutcome } from './types'
import { rankRows } from './types'

/**
 * Individuální Stableford - každý sám za sebe, počítá se průběžně.
 *
 * Par dva body, birdie tři, bogey jeden, netto dvojbogey a horší nic.
 * Zvednutá jamka je nula bodů. Hraje-li se netto, počítá se po odečtu ran
 * podle hracího handicapu a stroke indexu.
 */
export const individualStableford: Evaluate = (
  { round, players },
  game,
): EvaluationResult => {
  const options = { net: game.options.net, allowance: game.options.allowance }
  const holes = gameHoles(round, game)
  const outcomes: HoleOutcome[] = holes.map((hole) => ({
    hole,
    decided: round.playerIds.every(
      (id) => netScoreAt(round, id, hole, options) !== undefined,
    ),
    winners: [],
  }))

  const rows = round.playerIds.map((id) => {
    let points = 0
    let played = 0
    for (const hole of holes) {
      const net = netScoreAt(round, id, hole, options)
      if (net === undefined) continue
      played += 1
      if (!Number.isFinite(net)) continue
      points += stablefordPoints((net as number) - parAt(round, hole))
    }
    return {
      id,
      players: [id],
      value: points,
      secondary: grossTotal(round, id),
      holes: played,
      teamId: teamOf(players, id),
    }
  })

  const teamPoints: Record<TeamId, number> = { A: 0, B: 0 }
  return {
    game,
    rows: rankRows(rows, 'highest', 'lowest'),
    holes: outcomes,
    teamPoints,
    pending: outcomes.filter((o) => !o.decided).length,
  }
}

/** Body hráče na jedné jamce - pro scorekartu a hlavičku zápisu. */
export function stablefordAt(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
  options: { net: boolean; allowance: number },
): number | undefined {
  const net = netScoreAt(round, playerId, hole, options)
  if (net === undefined) return undefined
  if (!Number.isFinite(net)) return 0
  return stablefordPoints((net as number) - parAt(round, hole))
}
