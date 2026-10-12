import { CONCEDED, holeOrder, netScoreAt, parAt, teamPlayers } from '../model/round'
import type {
  GameConfig,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'
import { TEAM_IDS } from '../model/types'
import { individualSkins, teamSkins, teamBestBall } from './skins'
import type { EvaluationContext } from './types'
import { DEFAULT_PICKUP } from '../model/pickup'
import { DEFAULT_BONUS_CONFIG } from '../model/bonuses'

/**
 * Team Skins přes všechna odehraná kola - souhrnná statistika vedle her kola.
 * Každé kolo se spočítá stejnou evaluací jako hra Team Skins, ale jednotně:
 * celé kolo, přenos dělených jamek, plný HCP (u netto). Nezávisí na tom, jestli
 * a jak měl admin Team Skins v kole nastavené - je to srovnání týmů brutto
 * i netto přes celý zájezd. Do týmového skóre nic nepřidává.
 */

export type SkinsMode = 'gross' | 'net'

export interface TeamSkinsHole {
  hole: number
  par: number
  /** Tým, který skin vzal; `null` = dělená jamka (skin jde do banku). */
  winner: TeamId | null
  /** Skiny rozdané na jamce (včetně přenesených); u dělené 0. */
  skins: number
  /** Bank po jamce. */
  carry: number
  /** Kdo z vítězného týmu zahrál rozhodující (nejlepší) ránu. */
  players: PlayerId[]
  /** Nejlepší rána každého týmu na jamce (brutto nebo netto); `null` = zvedli všichni. */
  best: Record<TeamId, number | null>
}

export interface TeamSkinsRound {
  round: TournamentRound
  totals: Record<TeamId, number>
  /** Jen rozhodnuté jamky v pořadí hraní. */
  holes: TeamSkinsHole[]
  /** Skiny, které zůstaly v banku po poslední rozhodnuté jamce. */
  carry: number
  /** Jamky, které ještě nemají zápis všech osmi. */
  pending: number
}

export interface TeamSkinsSummary {
  mode: SkinsMode
  totals: Record<TeamId, number>
  rounds: TeamSkinsRound[]
}

function overviewGame(net: boolean): GameConfig {
  return {
    id: `team-skins-overview-${net ? 'net' : 'gross'}`,
    kind: 'team-skins',
    options: { net, allowance: 1, carry: true },
    countsForTeam: false,
    teamPoints: {},
  }
}

export function teamSkinsSummary(
  rounds: TournamentRound[],
  players: Player[],
  mode: SkinsMode,
): TeamSkinsSummary {
  const net = mode === 'net'
  const game = overviewGame(net)
  const totals: Record<TeamId, number> = { A: 0, B: 0 }
  const result: TeamSkinsRound[] = []
  for (const round of rounds) {
    if (round.status === 'planned') continue
    const context: EvaluationContext = {
      round,
      players,
      pickup: DEFAULT_PICKUP,
      bonuses: DEFAULT_BONUS_CONFIG,
    }
    const evaluated = teamSkins(context, game)
    const options = { net, allowance: 1 }
    const order = holeOrder(round, round.flights[0])
    const byHole = new Map(evaluated.holes.map((h) => [h.hole, h]))
    const holes: TeamSkinsHole[] = []
    for (const hole of order) {
      const outcome = byHole.get(hole)
      if (!outcome?.decided) continue
      const best = Object.fromEntries(
        TEAM_IDS.map((team) => {
          const value = teamBestBall(
            context,
            teamPlayers(round, players, team),
            hole,
            options,
          )
          return [team, value === undefined || value === CONCEDED ? null : value]
        }),
      ) as Record<TeamId, number | null>
      const winnerPlayers = outcome.winners
      const winner =
        winnerPlayers.length > 0
          ? (TEAM_IDS.find((team) =>
              teamPlayers(round, players, team).includes(winnerPlayers[0]!),
            ) ?? null)
          : null
      const winningScore = winner ? best[winner] : null
      holes.push({
        hole,
        par: parAt(round, hole),
        winner,
        skins: winner ? (outcome.value ?? 1) : 0,
        carry: outcome.carry ?? 0,
        players:
          winner && winningScore !== null
            ? teamPlayers(round, players, winner).filter(
                (id) => netScoreAt(round, id, hole, options) === winningScore,
              )
            : [],
        best,
      })
    }
    const roundTotals: Record<TeamId, number> = {
      A: evaluated.rows.find((r) => r.id === 'A')?.value ?? 0,
      B: evaluated.rows.find((r) => r.id === 'B')?.value ?? 0,
    }
    totals.A += roundTotals.A
    totals.B += roundTotals.B
    result.push({
      round,
      totals: roundTotals,
      holes,
      carry: evaluated.carry ?? 0,
      pending: evaluated.pending,
    })
  }
  return { mode, totals, rounds: result }
}

/* --- Skins jednotlivců přes kola (odznak Skinař) --------------------------- */

export interface PlayerSkinsHole {
  hole: number
  par: number
  /** Kdo skin vzal; `null` = dělená jamka (skin jde do banku). */
  winner: PlayerId | null
  skins: number
  carry: number
  /** Rána vítěze a nejlepší rána ostatních ve flightu; `null` = zvednuto. */
  score: number | null
  others: number | null
}

export interface PlayerSkinsFlight {
  index: number
  players: PlayerId[]
  holes: PlayerSkinsHole[]
  carry: number
  pending: number
}

export interface PlayerSkinsRound {
  round: TournamentRound
  flights: PlayerSkinsFlight[]
}

export interface PlayerSkinsSummary {
  mode: SkinsMode
  totals: Map<PlayerId, number>
  rounds: PlayerSkinsRound[]
}

/**
 * Skins jednotlivců ve flightu přes všechna odehraná kola, jednotně: každý
 * flight má své skiny, dělená jamka přenáší, plný HCP (netto). Stejná evaluace
 * jako hra Skins - nezávisí na tom, jestli a jak se Skins v kole hrály.
 */
export function playerSkinsSummary(
  rounds: TournamentRound[],
  players: Player[],
  mode: SkinsMode,
): PlayerSkinsSummary {
  const net = mode === 'net'
  const options = { net, allowance: 1 }
  const game: GameConfig = {
    id: `skins-overview-${mode}`,
    kind: 'individual-skins',
    options: { net, allowance: 1, scope: 'flight', carry: true },
    countsForTeam: false,
    teamPoints: {},
  }
  const totals = new Map<PlayerId, number>(players.map((p) => [p.id, 0]))
  const result: PlayerSkinsRound[] = []
  for (const round of rounds) {
    if (round.status === 'planned') continue
    const context: EvaluationContext = {
      round,
      players,
      pickup: DEFAULT_PICKUP,
      bonuses: DEFAULT_BONUS_CONFIG,
    }
    const evaluated = individualSkins(context, game)
    for (const row of evaluated.rows)
      totals.set(row.id, (totals.get(row.id) ?? 0) + row.value)
    const scoreOf = (id: PlayerId, hole: number) => {
      const value = netScoreAt(round, id, hole, options)
      return value === undefined || value === CONCEDED ? null : value
    }
    const flights: PlayerSkinsFlight[] = round.flights.map((flight, index) => {
      const outcomes = evaluated.holes.filter(
        (h) => h.group?.some((id) => flight.players.includes(id)) ?? false,
      )
      const holes = holeOrder(round, flight)
        .map((hole) => outcomes.find((o) => o.hole === hole))
        .filter((o): o is NonNullable<typeof o> => Boolean(o?.decided))
        .map((outcome) => {
          const winner = outcome.winners[0] ?? null
          const rest = flight.players
            .filter((id) => id !== winner)
            .map((id) => scoreOf(id, outcome.hole))
            .filter((v): v is number => v !== null)
          return {
            hole: outcome.hole,
            par: parAt(round, outcome.hole),
            winner,
            skins: winner ? (outcome.value ?? 1) : 0,
            carry: outcome.carry ?? 0,
            score: winner ? scoreOf(winner, outcome.hole) : null,
            others: rest.length > 0 ? Math.min(...rest) : null,
          }
        })
      const last = outcomes.filter((o) => o.decided).at(-1)
      return {
        index,
        players: flight.players,
        holes,
        carry: holes.at(-1)?.carry ?? last?.carry ?? 0,
        pending: outcomes.filter((o) => !o.decided).length,
      }
    })
    result.push({ round, flights })
  }
  return { mode, totals, rounds: result }
}
