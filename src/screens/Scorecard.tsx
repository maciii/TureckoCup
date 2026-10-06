import { Fragment } from 'react'
import type { Player, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  grossTotal,
  hasHandicap,
  holeCount,
  holesCompleted,
  parAt,
  parForPlayedHoles,
  playingHandicap,
  scoreAt,
  shortName,
  strokeIndexRanked,
  strokesReceived,
} from '../model/round'
import type { EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import { ScoreMark, TeamBadge, formatToPar } from './common'

interface Props {
  round: TournamentRound
  players: Player[]
  /** Skins (jednotlivců nebo týmů) - vítězné jamky se zvýrazní. */
  skins?: EvaluationResult
  /** Zvýrazněná jamka (živý zápis). */
  currentHole?: number
  /** Jen tenhle flight (zápis skóre), jinak oba. */
  flightIndex?: number
}

/**
 * Scorekarta se značkami podle golfové konvence (vzor Golfgames): kroužek pod
 * par, čtvereček nad par, tečky za rány z handicapu. Flighty jsou skupiny
 * sloupců, mezisoučet po devítce jako na turnajové kartě.
 */
export default function Scorecard({
  round,
  players,
  skins,
  currentHole,
  flightIndex,
}: Props) {
  const flights =
    flightIndex === undefined
      ? round.flights
      : round.flights.filter((_, i) => i === flightIndex)
  const columns = flights.flatMap((flight, index) =>
    flight.players.map((id) => ({ id, flight: flightIndex ?? index })),
  )
  const count = holeCount(round)
  const strokeIndex = strokeIndexRanked(round)
  const net = round.games.some((g) => g.options.net)

  function skinClass(id: string, hole: number): string {
    const outcome = skins?.holes.find((h) => h.hole === hole)
    return outcome?.winners.includes(id) ? ' skin-awarded' : ''
  }

  function subtotal(
    id: string,
    from: number,
    to: number,
  ): { strokes: number; par: number } {
    let strokes = 0
    let par = 0
    for (let hole = from; hole < to; hole++) {
      const score = scoreAt(round, id, hole)
      if (score === undefined || score === PICKED_UP) continue
      strokes += score
      par += parAt(round, hole)
    }
    return { strokes, par }
  }

  const summaryRow = (label: string, from: number, to: number, key: string) => (
    <tr className="scorecard-turn-row" key={key}>
      <th scope="row" className="scorecard-turn-label">
        {label}
      </th>
      <td className="par-cell">
        {round.course.pars.slice(from, to).reduce((sum, p) => sum + p, 0)}
      </td>
      {net && <td className="par-cell" />}
      {columns.map((column) => {
        const { strokes } = subtotal(column.id, from, to)
        return (
          <td
            key={column.id}
            className={column.flight % 2 === 0 ? 'player-col-a' : 'player-col-b'}
          >
            {strokes > 0 ? strokes : t('common.dash')}
          </td>
        )
      })}
    </tr>
  )

  return (
    <div className="scorecard-wrap">
      <table className="scorecard">
        <thead>
          {flights.length > 1 && (
            <tr className="group-row">
              <th scope="col" colSpan={net ? 3 : 2} />
              {flights.map((flight, index) => (
                <th key={index} scope="colgroup" colSpan={flight.players.length}>
                  {t('round.flight', { number: (flightIndex ?? index) + 1 })}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th scope="col">{t('round.holeShort')}</th>
            <th scope="col">{t('common.par')}</th>
            {net && <th scope="col">{t('round.strokeIndexShort')}</th>}
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={column.flight % 2 === 0 ? 'player-col-a' : 'player-col-b'}
              >
                <span className="col-name">{shortName(players, column.id)}</span>
                <TeamBadge teamId={players.find((p) => p.id === column.id)?.teamId} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, hole) => (
            <Fragment key={hole}>
              <tr className={hole === currentHole ? 'current-hole' : undefined}>
                <th scope="row">{hole + 1}</th>
                <td className="par-cell">{parAt(round, hole)}</td>
                {net && <td className="par-cell">{strokeIndex[hole]}</td>}
                {columns.map((column) => {
                  const strokes = strokesReceived(round, column.id, hole)
                  return (
                    <td
                      key={column.id}
                      className={`${column.flight % 2 === 0 ? 'player-col-a' : 'player-col-b'}${skinClass(column.id, hole)}`}
                    >
                      <span className="scorecard-player-cell">
                        <ScoreMark
                          score={scoreAt(round, column.id, hole)}
                          par={parAt(round, hole)}
                        />
                        {strokes > 0 && (
                          <span
                            className="scorecard-hcp-dots"
                            aria-label={t('play.strokesReceived', { count: strokes })}
                          >
                            {'•'.repeat(Math.min(strokes, 4))}
                          </span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
              {count === 18 && hole === 8 && summaryRow(t('round.out'), 0, 9, 'out')}
            </Fragment>
          ))}
          {count === 18 && summaryRow(t('round.in'), 9, 18, 'in')}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('round.total')}</th>
            <td>{round.course.pars.reduce((sum, p) => sum + p, 0)}</td>
            {net && <td />}
            {columns.map((column) => {
              const played = holesCompleted(round, column.id)
              const total = grossTotal(round, column.id)
              const toPar = total - parForPlayedHoles(round, column.id)
              return (
                <td key={column.id}>
                  {played > 0 ? (
                    <span className="scorecard-player-cell">
                      {total}
                      <span className="scorecard-hcp-dots">{formatToPar(toPar)}</span>
                    </span>
                  ) : (
                    t('common.dash')
                  )}
                </td>
              )
            })}
          </tr>
          {net && (
            <tr>
              <th scope="row">{t('round.hcp')}</th>
              <td />
              <td />
              {columns.map((column) => (
                <td key={column.id}>
                  {hasHandicap(round, column.id)
                    ? playingHandicap(round, column.id)
                    : '?'}
                </td>
              ))}
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}
