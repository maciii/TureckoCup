import type { DuelResult } from '../evaluations'
import { texasGrossAt, texasHandicap, texasStrokesAt } from '../evaluations/texas'
import { t } from '../i18n'
import { gameUsesHandicap } from '../model/games'
import {
  CONCEDED,
  gameHoles,
  holeOrder,
  parAt,
  playingHandicap,
  scoreAt,
  shortName,
  strokesReceived,
} from '../model/round'
import type {
  DuelFormat,
  GameConfig,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'
import { PICKED_UP } from '../model/types'
import DetailSheet from './DetailSheet'
import { Pill, ScoreMark, TeamBadge, gameTitle, sideLabel } from './common'

/** Sloupec rán v rozpisu: hráč, u Texasu dvojice (hraje jeden míček). */
interface ScoreColumn {
  key: string
  label: string
  score: (hole: number) => number | undefined
  strokes: (hole: number) => number
}

type Running = 'match' | 'diff' | 'points' | 'skins'

/** Formát zápasu, jak ho bere evaluace (výchozí podle druhu hry). */
export function duelFormat(game: GameConfig): DuelFormat {
  return (
    game.options.format ?? (game.kind === 'position-duel' ? 'strokes-net' : 'match-play')
  )
}

/**
 * Rozpis zápasu po jamkách (singl pozic, Four-ball, Texas, Best + Součet,
 * Four-ball Skins): rány všech hráčů s ranami z HCP, hodnota strany, se kterou
 * zápas počítá, kdo jamku vzal (barva týmu) a průběžný stav. Všechno z raw
 * skóre a výsledku evaluace - nic se neukládá.
 */
export default function MatchDetail({
  round,
  game,
  duel,
  players,
  onClose,
}: {
  round: TournamentRound
  game: GameConfig
  duel: DuelResult
  players: Player[]
  onClose: () => void
}) {
  const [left, right] = duel.sides
  if (!left || !right) return null
  const format = duelFormat(game)
  const usesHcp = gameUsesHandicap(game)
  const texas = game.kind === 'texas-scramble'
  const allowance = game.options.allowance
  const holes = gameHoles(round, game)
  const order = holeOrder(
    round,
    round.flights.find((f) => f.players.includes(left.players[0] ?? '')),
  ).filter((hole) => holes.includes(hole))

  const running: Running =
    game.kind === 'best-aggregate'
      ? 'points'
      : game.kind === 'four-ball-skins'
        ? 'skins'
        : format === 'match-play'
          ? 'match'
          : 'diff'
  const higherWins = game.kind === 'best-aggregate' || format === 'stableford'

  const columnsOf = (ids: PlayerId[]): ScoreColumn[] =>
    texas
      ? [
          {
            key: ids.join('+'),
            label: '',
            score: (hole) => {
              const gross = texasGrossAt(round, ids, hole)
              return gross === CONCEDED ? PICKED_UP : gross
            },
            strokes: (hole) =>
              usesHcp ? texasStrokesAt(round, ids, hole, game.options) : 0,
          },
        ]
      : ids.map((id) => ({
          key: id,
          label: shortName(players, id).slice(0, 3),
          score: (hole) => scoreAt(round, id, hole),
          strokes: (hole) => (usesHcp ? strokesReceived(round, id, hole, allowance) : 0),
        }))
  const sides = [left, right].map((side) => ({
    ...side,
    columns: columnsOf(side.players),
  }))

  const handicapOf = (ids: PlayerId[]) =>
    texas
      ? String(texasHandicap(round, ids, game.options))
      : ids.map((id) => playingHandicap(round, id, allowance)).join(' / ')

  const valueLabel =
    game.kind === 'best-aggregate' || format === 'stableford'
      ? t('detail.points')
      : usesHcp
        ? t('detail.net')
        : t('detail.gross')

  // Průběžný stav po jamkách v pořadí hraní.
  let lead = 0
  const totals: [number, number] = [0, 0]
  const rows = order.map((hole) => {
    const key = String(hole)
    const winner = duel.holeWinners?.[key]
    const values = duel.holeValues?.[key]
    let status: { text: string; team: TeamId | undefined } | null = null
    if (winner !== undefined) {
      if (running === 'match') {
        lead += winner === 0 ? 1 : winner === 1 ? -1 : 0
        status = {
          text: lead === 0 ? 'AS' : t('detail.up', { count: Math.abs(lead) }),
          team: lead === 0 ? undefined : (lead > 0 ? left : right).teamId,
        }
      } else if (running === 'diff') {
        const [a, b] = values ?? [null, null]
        if (a !== null && a !== undefined && b !== null && b !== undefined) {
          lead += higherWins ? a - b : b - a
        }
        status = {
          text: lead === 0 ? 'AS' : `+${Math.abs(lead)}`,
          team: lead === 0 ? undefined : (lead > 0 ? left : right).teamId,
        }
      } else if (running === 'points') {
        const points = duel.holePoints?.[key]
        totals[0] += points?.[0]?.total ?? 0
        totals[1] += points?.[1]?.total ?? 0
        status = {
          text: `${totals[0]}:${totals[1]}`,
          team:
            totals[0] === totals[1]
              ? undefined
              : (totals[0] > totals[1] ? left : right).teamId,
        }
      } else {
        const skins = duel.holeSkins?.[key] ?? 0
        if (winner !== null) totals[winner] += skins
        status = {
          text: `${totals[0]}:${totals[1]}`,
          team:
            totals[0] === totals[1]
              ? undefined
              : (totals[0] > totals[1] ? left : right).teamId,
        }
      }
    }
    return { hole, winner, values, status }
  })

  const valueText = (value: number | null | undefined) =>
    value === undefined ? '' : value === null ? '×' : String(value)

  return (
    <DetailSheet
      title={gameTitle(game)}
      className="match-detail"
      onClose={onClose}
      subtitle={
        <>
          <p className="hint">
            {game.kind === 'best-aggregate' || game.kind === 'four-ball-skins'
              ? ''
              : `${t(`format.${format}`)}${format === 'match-play' ? ` · ${usesHcp ? t('detail.net') : t('detail.gross')}` : ''}`}
            {duel.position !== undefined &&
              ` · ${t('overview.positionShort')} ${duel.position}`}
          </p>
          <div className="md-sides">
            {sides.map((side, index) => (
              <div key={side.id} className={`md-side${index === 1 ? ' right' : ''}`}>
                <span className="md-side-name">
                  <TeamBadge teamId={side.teamId} />
                  {sideLabel(players, side.players)}
                </span>
                {usesHcp && (
                  <span className="md-side-hcp">
                    {t('detail.hcp', { value: handicapOf(side.players) })}
                  </span>
                )}
              </div>
            ))}
            <span className="md-notation">
              {duel.leader === null ? (
                <span className="v">
                  {duel.sides.some((side) => side.holes > 0) ? duel.notation : '–'}
                </span>
              ) : (
                <Pill teamId={duel.sides[duel.leader]?.teamId}>{duel.notation}</Pill>
              )}
            </span>
          </div>
        </>
      }
    >
      <div className="md-scroll">
        <table className="md-table">
          <thead>
            <tr>
              <th className="num">{t('strokes.hole')}</th>
              <th className="num">{t('strokes.par')}</th>
              {sides[0]!.columns.map((column) => (
                <th key={column.key} className="who">
                  {column.label || <TeamBadge teamId={left.teamId} />}
                </th>
              ))}
              <th className="val">{valueLabel}</th>
              <th className="status">{t('detail.status')}</th>
              <th className="val">{valueLabel}</th>
              {sides[1]!.columns.map((column) => (
                <th key={column.key} className="who">
                  {column.label || <TeamBadge teamId={right.teamId} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hole}>
                <td className="num hole">{row.hole + 1}</td>
                <td className="num par">{parAt(round, row.hole)}</td>
                {sides[0]!.columns.map((column) => (
                  <MarkCell
                    key={column.key}
                    column={column}
                    hole={row.hole}
                    round={round}
                  />
                ))}
                <td className="val">
                  <span
                    className={`md-val${row.winner === 0 ? ` win team-${(left.teamId ?? 'a').toLowerCase()}` : ''}`}
                  >
                    {valueText(row.values?.[0])}
                  </span>
                </td>
                <td className="status">
                  {row.status ? (
                    <span
                      className={`md-status${row.status.team ? ` team-${row.status.team.toLowerCase()}` : ''}`}
                    >
                      {row.status.text}
                    </span>
                  ) : null}
                </td>
                <td className="val">
                  <span
                    className={`md-val${row.winner === 1 ? ` win team-${(right.teamId ?? 'b').toLowerCase()}` : ''}`}
                  >
                    {valueText(row.values?.[1])}
                  </span>
                </td>
                {sides[1]!.columns.map((column) => (
                  <MarkCell
                    key={column.key}
                    column={column}
                    hole={row.hole}
                    round={round}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint center px md-legend">
        {usesHcp ? t('detail.legendHcp') : t('detail.legend')}
      </p>
    </DetailSheet>
  )
}

function MarkCell({
  column,
  hole,
  round,
}: {
  column: ScoreColumn
  hole: number
  round: TournamentRound
}) {
  const strokes = column.strokes(hole)
  return (
    <td className="mark-cell">
      <ScoreMark score={column.score(hole)} par={parAt(round, hole)} />
      {strokes > 0 && <span className="md-dots">{'•'.repeat(strokes)}</span>}
    </td>
  )
}
