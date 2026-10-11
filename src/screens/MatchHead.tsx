import type { DuelResult, EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import { SIDED_KINDS, playOrder, shortName } from '../model/round'
import type {
  DuelFormat,
  Flight,
  Player,
  PlayerId,
  TournamentRound,
} from '../model/types'
import { TEAM_IDS } from '../model/types'
import { TeamBadge } from './common'

export interface MatchGroup {
  key: string
  label: string
  players: PlayerId[]
  duel: DuelResult | null
  format: DuelFormat | undefined
}

/**
 * Zápis seskupený po duelech: když se singly pozic hrají uvnitř flightu
 * (A1 s B1 v jednom flightu), stojí soupeři pod sebou pod hlavičkou
 * se stavem zápasu. Strana týmu A je vždy první. Hráči bez duelu ve
 * flightu (soupeř jde v druhém flightu) jsou ve skupině bez hlavičky.
 * Když ve flightu žádný duel není (nebo kolo hraje dvojice), vrací prázdný
 * seznam a zápis zůstane plochý.
 */
export function duelGroups(
  results: EvaluationResult[],
  flight: Flight,
  players: Player[],
  round: TournamentRound,
): MatchGroup[] {
  // Hra dvojic (Four-ball, Best + Součet, Four-ball Skins) řadí partnery pod sebe
  // a má vlastní kartu zápasu - duely pozic ji nepřeskládají.
  if (round.games.some((game) => SIDED_KINDS.includes(game.kind))) return []
  const result = results.find((r) => r.game.kind === 'position-duel' && r.duels)
  if (!result?.duels) return []
  const inFlight = new Set<PlayerId>(flight.players)
  const duels = result.duels
    .filter((duel) =>
      duel.sides.every((side) => side.players.every((id) => inFlight.has(id))),
    )
    .map((duel) => ({
      ...duel,
      sides: [...duel.sides].sort(
        (a, b) => TEAM_IDS.indexOf(a.teamId ?? 'A') - TEAM_IDS.indexOf(b.teamId ?? 'A'),
      ),
    }))
  if (duels.length === 0) return []
  const format = result.game.options.format
  const groups: MatchGroup[] = duels.map((duel) => ({
    key: duel.id,
    label: t('play.match.vs', {
      a: shortName(players, duel.sides[0]!.players[0]!),
      b: shortName(players, duel.sides[1]!.players[0]!),
    }),
    players: duel.sides.flatMap((side) => side.players),
    duel,
    format,
  }))
  const grouped = new Set(groups.flatMap((g) => g.players))
  const rest = playOrder(round, flight, players).filter((id) => !grouped.has(id))
  if (rest.length > 0) {
    groups.push({
      key: 'rest',
      label: t('play.match.others'),
      players: rest,
      duel: null,
      format,
    })
  }
  return groups
}

/**
 * Hlavička duelu: jména obou stran s odznakem týmu, uprostřed stav zápasu
 * v barvě vedoucího týmu (nebo „vyrovnáno“), pod ním, komu připadla tahle jamka.
 * Součtové formáty ukážou u jmen průběžný součet, jamkovka jen notaci.
 */
export default function MatchHead({
  duel,
  players,
  hole,
  format,
}: {
  duel: DuelResult
  players: Player[]
  hole: number
  format: DuelFormat | undefined
}) {
  const [left, right] = duel.sides
  if (!left || !right) return null
  const leader = duel.leader === null ? null : duel.sides[duel.leader]
  const sumFormat = format !== undefined && format !== 'match-play'
  const winner = duel.holeWinners?.[String(hole)]
  const onHole =
    winner === undefined
      ? duel.finished
        ? t('play.status.decided')
        : t('play.status.pending')
      : winner === null
        ? t('play.status.halved')
        : t('play.status.holeTo', {
            name: shortName(players, duel.sides[winner]!.players[0]!),
          })
  const started = duel.sides.some((side) => side.holes > 0)
  const state = !started
    ? t('play.match.notStarted')
    : leader
      ? `${shortName(players, leader.players[0]!)} ${duel.notation}`.trim()
      : t('play.status.allSquare')
  const toneClass = leader?.teamId ? ` lead-${leader.teamId.toLowerCase()}` : ''
  const side = (s: DuelResult['sides'][number], align: 'left' | 'right') => (
    <span className={`match-side ${align}`}>
      {align === 'left' && <TeamBadge teamId={s.teamId} />}
      <span className="match-side-name">{shortName(players, s.players[0]!)}</span>
      {sumFormat && started && <span className="match-side-value">{s.value}</span>}
      {align === 'right' && <TeamBadge teamId={s.teamId} />}
    </span>
  )
  return (
    <div className="match-head">
      {side(left, 'left')}
      <span className="match-state">
        <span className={`match-pill${toneClass}${duel.finished ? ' done' : ''}`}>
          {state}
        </span>
        <span className="match-hole">{onHole}</span>
      </span>
      {side(right, 'right')}
    </div>
  )
}
