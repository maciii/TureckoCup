import type { Player, TeamId, TournamentRound } from '../model/types'
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
  teamOf,
  playOrder,
} from '../model/round'
import type { EvaluationResult } from '../evaluations'
import { bonusConfigOf, hasBonuses } from '../model/bonuses'
import { bonusAwardsAt, bonusTotal } from '../evaluations/bonuses'
import { useData } from '../data'
import { t } from '../i18n'
import { ScoreMark, formatToPar } from './common'

interface Props {
  round: TournamentRound
  players: Player[]
  /** Team Skins - vítězný tým obarví kolečko jamky. */
  teamSkins?: EvaluationResult
  /** Skins jednotlivců - vítězná buňka dostane zlatý rámeček. */
  skins?: EvaluationResult
  currentHole?: number
  /** Jen tenhle flight (zápis skóre), jinak oba. */
  flightIndex?: number
}

/**
 * Scorekarta jako klasická golfová karta: jamky ve sloupcích, dvě devítky pod
 * sebou, hráči v řádcích (vzor Zavařovák). Jamka v hlavičce je kolečko
 * obarvené týmem, který na ní vzal skin.
 */
export default function Scorecard({
  round,
  players,
  teamSkins,
  skins,
  currentHole,
  flightIndex,
}: Props) {
  const bonusConfig = bonusConfigOf(useData().state.tournament?.bonuses)
  const withBonuses = hasBonuses(bonusConfig)
  const flights =
    flightIndex === undefined
      ? round.flights
      : round.flights.filter((_, i) => i === flightIndex)
  const count = holeCount(round)
  const nines =
    count === 18
      ? [
          [0, 9],
          [9, 18],
        ]
      : [[0, count]]

  function holeTeam(hole: number): TeamId | undefined {
    const outcome = teamSkins?.holes.find((h) => h.hole === hole)
    const winner = outcome?.winners[0]
    return winner ? teamOf(players, winner) : undefined
  }

  function holePlayed(hole: number): boolean {
    return round.playerIds.some((id) => scoreAt(round, id, hole) !== undefined)
  }

  function skinWon(id: string, hole: number): boolean {
    return skins?.holes.find((h) => h.hole === hole)?.winners.includes(id) ?? false
  }

  function sum(id: string, from: number, to: number): number | null {
    let strokes = 0
    let played = 0
    for (let hole = from; hole < to; hole++) {
      const score = scoreAt(round, id, hole)
      if (score === undefined || score === PICKED_UP) continue
      strokes += score
      played += 1
    }
    return played > 0 ? strokes : null
  }

  const nine = ([from, to]: number[], label: string) => {
    const holes: number[] = []
    for (let hole = from!; hole < to!; hole++) holes.push(hole)
    const parSum = holes.reduce((s, h) => s + parAt(round, h), 0)
    return (
      <table className="scorecard" key={label}>
        <colgroup>
          <col style={{ width: 72 }} />
          {holes.map((hole) => (
            <col key={hole} />
          ))}
          <col style={{ width: 28 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="row-label">{t('round.holeShort')}</th>
            {holes.map((hole) => {
              const team = holeTeam(hole)
              const cls = team
                ? `team-${team.toLowerCase()}`
                : hole === currentHole
                  ? 'current'
                  : holePlayed(hole)
                    ? 'played'
                    : ''
              return (
                <th key={hole}>
                  <span className={`hole-dot ${cls}`}>{hole + 1}</span>
                </th>
              )
            })}
            <th className="row-label" style={{ textAlign: 'right' }}>
              {label}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="row-par">
            <th className="row-label">{t('common.par')}</th>
            {holes.map((hole) => (
              <td key={hole} className="par-cell">
                {parAt(round, hole)}
              </td>
            ))}
            <td className="par-cell">{parSum}</td>
          </tr>
          {flights.flatMap((flight, fi) =>
            playOrder(round, flight, players).map((id, pi) => (
              <tr key={id} className={fi > 0 && pi === 0 ? 'flight-gap' : undefined}>
                <th className="player-label" title={shortName(players, id)}>
                  <span
                    className={`team-badge team-${(teamOf(players, id) ?? 'a').toLowerCase()}`}
                  >
                    {teamOf(players, id)}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shortName(players, id)}
                  </span>
                  {hasHandicap(round, id) && (
                    <span className="hcp">{playingHandicap(round, id)}</span>
                  )}
                </th>
                {holes.map((hole) => (
                  <td key={hole} className={skinWon(id, hole) ? 'skin' : undefined}>
                    <ScoreMark
                      score={scoreAt(round, id, hole)}
                      par={parAt(round, hole)}
                    />
                    {bonusAwardsAt(round, bonusConfig, id, hole).length > 0 && (
                      <span className="cell-marks">
                        {bonusAwardsAt(round, bonusConfig, id, hole).map((award) => (
                          <span
                            key={award.bonus.id}
                            className={
                              award.void ? 'void' : award.pending ? 'pending' : ''
                            }
                          >
                            {award.bonus.mark}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                ))}
                <td className="sum">{sum(id, from!, to!) ?? t('common.dash')}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    )
  }

  return (
    <div className="px stack">
      {nines.map((range, i) => nine(range, i === 0 ? t('round.out') : t('round.in')))}
      <table className="scorecard">
        <colgroup>
          <col style={{ width: 72 }} />
          <col />
          <col style={{ width: 70 }} />
          <col style={{ width: 54 }} />
          {withBonuses && <col style={{ width: 48 }} />}
        </colgroup>
        <tbody>
          <tr className="row-par">
            <th className="row-label">{t('round.total')}</th>
            <td />
            <th className="row-label" style={{ textAlign: 'right' }}>
              {t('common.strokesShort')}
            </th>
            <th className="row-label" style={{ textAlign: 'right' }}>
              {t('round.net')}
            </th>
            {withBonuses && (
              <th className="row-label" style={{ textAlign: 'right' }}>
                {t('bonus.short')}
              </th>
            )}
          </tr>
          {flights.flatMap((flight) =>
            playOrder(round, flight, players).map((id) => {
              const played = holesCompleted(round, id)
              const gross = grossTotal(round, id)
              const toPar = gross - parForPlayedHoles(round, id)
              const hcp = playingHandicap(round, id)
              return (
                <tr key={id}>
                  <th className="player-label">{shortName(players, id)}</th>
                  <td className="par-cell" style={{ textAlign: 'left' }}>
                    {played > 0 ? t('common.holes', { count: played }) : ''}
                  </td>
                  <td className="sum" style={{ textAlign: 'right' }}>
                    {played > 0 ? `${gross} (${formatToPar(toPar)})` : t('common.dash')}
                  </td>
                  <td className="sum" style={{ textAlign: 'right' }}>
                    {played === count && hasHandicap(round, id)
                      ? gross - hcp
                      : t('common.dash')}
                  </td>
                  {withBonuses && (
                    <td className="sum bonus-sum" style={{ textAlign: 'right' }}>
                      {bonusTotal(round, bonusConfig, id)}
                    </td>
                  )}
                </tr>
              )
            }),
          )}
        </tbody>
      </table>
    </div>
  )
}
