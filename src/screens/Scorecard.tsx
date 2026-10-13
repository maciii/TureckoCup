import type { Flight, Player, PlayerId, TeamId, TournamentRound } from '../model/types'
import { PICKED_UP } from '../model/types'
import {
  CONCEDED,
  flightPairs,
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
import { texasGrossAt, texasHandicap } from '../evaluations/texas'
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

/** Řádek karty: hráč, u Texas scramble dvojice (hraje jeden míček). */
interface CardRow {
  key: string
  ids: PlayerId[]
  team: TeamId | undefined
}

/**
 * Scorekarta jako klasická golfová karta: jamky ve sloupcích, dvě devítky pod
 * sebou, hráči v řádcích (vzor Zavařovák). Jamka v hlavičce je kolečko
 * obarvené týmem, který na ní vzal skin. U Texas scramble hraje dvojice jeden
 * míček, takže má jeden řádek s ranou dvojice a jejím HCP.
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
  const texas = round.games.find((game) => game.kind === 'texas-scramble')
  const pairs = texas ? flightPairs(round, players) : []
  const flights = round.flights
    .map((flight, index) => rowsOf(flight, index))
    .filter((_, i) => flightIndex === undefined || i === flightIndex)

  function rowsOf(flight: Flight, index: number): CardRow[] {
    const sides = pairs[index]?.sides
    if (sides) {
      const paired = new Set(sides.flatMap((side) => side.players))
      return [
        ...sides.map((side) => ({
          key: side.id,
          ids: side.players,
          team: teamOf(players, side.players[0]!),
        })),
        ...flight.players
          .filter((id) => !paired.has(id))
          .map((id) => ({ key: id, ids: [id], team: teamOf(players, id) })),
      ]
    }
    return playOrder(round, flight, players).map((id) => ({
      key: id,
      ids: [id],
      team: teamOf(players, id),
    }))
  }

  /** Rána řádku: hráče, u dvojice Texasu nejlepší zapsaná (vše zvednuté = ×). */
  function rowScore(row: CardRow, hole: number): number | undefined {
    if (row.ids.length === 1) return scoreAt(round, row.ids[0]!, hole)
    const gross = texasGrossAt(round, row.ids, hole)
    return gross === CONCEDED ? PICKED_UP : gross
  }

  function rowHandicap(row: CardRow): number | null {
    if (!row.ids.every((id) => hasHandicap(round, id))) return null
    return texas && row.ids.length > 1
      ? texasHandicap(round, row.ids, texas.options)
      : playingHandicap(round, row.ids[0]!)
  }

  function rowTotals(row: CardRow): { played: number; gross: number; toPar: number } {
    if (row.ids.length === 1) {
      const id = row.ids[0]!
      const gross = grossTotal(round, id)
      return {
        played: holesCompleted(round, id),
        gross,
        toPar: gross - parForPlayedHoles(round, id),
      }
    }
    let played = 0
    let gross = 0
    let par = 0
    for (let hole = 0; hole < count; hole++) {
      const score = rowScore(row, hole)
      // Jako u hráče: dohraná jamka je zapsaná rána, zvednutá se nepočítá.
      if (score === undefined || score === PICKED_UP) continue
      played += 1
      gross += score
      par += parAt(round, hole)
    }
    return { played, gross, toPar: gross - par }
  }
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

  function skinWon(row: CardRow, hole: number): boolean {
    const winners = skins?.holes.find((h) => h.hole === hole)?.winners ?? []
    return row.ids.some((id) => winners.includes(id))
  }

  function sum(row: CardRow, from: number, to: number): number | null {
    let strokes = 0
    let played = 0
    for (let hole = from; hole < to; hole++) {
      const score = rowScore(row, hole)
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
          {flights.flatMap((rows, fi) =>
            rows.map((row, pi) => {
              const hcp = rowHandicap(row)
              const marks = (hole: number) =>
                row.ids.flatMap((id) => bonusAwardsAt(round, bonusConfig, id, hole))
              return (
                <tr
                  key={row.key}
                  className={fi > 0 && pi === 0 ? 'flight-gap' : undefined}
                >
                  <th
                    className={`player-label${row.ids.length > 1 ? ' pair' : ''}`}
                    title={row.ids.map((id) => shortName(players, id)).join(' + ')}
                  >
                    <span
                      className={`team-badge team-${(row.team ?? 'a').toLowerCase()}`}
                    >
                      {row.team}
                    </span>
                    <span className="names">
                      {row.ids.map((id) => (
                        <span key={id}>{shortName(players, id)}</span>
                      ))}
                    </span>
                    {hcp !== null && <span className="hcp">{hcp}</span>}
                  </th>
                  {holes.map((hole) => (
                    <td key={hole} className={skinWon(row, hole) ? 'skin' : undefined}>
                      <ScoreMark score={rowScore(row, hole)} par={parAt(round, hole)} />
                      {marks(hole).length > 0 && (
                        <span className="cell-marks">
                          {marks(hole).map((award, k) => (
                            <span
                              key={`${award.bonus.id}-${k}`}
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
                  <td className="sum">{sum(row, from!, to!) ?? t('common.dash')}</td>
                </tr>
              )
            }),
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
          {flights.flatMap((rows) =>
            rows.map((row) => {
              const { played, gross, toPar } = rowTotals(row)
              const hcp = rowHandicap(row)
              return (
                <tr key={row.key}>
                  <th className="player-label">
                    {row.ids.map((id) => shortName(players, id)).join(' + ')}
                  </th>
                  <td className="par-cell" style={{ textAlign: 'left' }}>
                    {played > 0 ? t('common.holes', { count: played }) : ''}
                  </td>
                  <td className="sum" style={{ textAlign: 'right' }}>
                    {played > 0 ? `${gross} (${formatToPar(toPar)})` : t('common.dash')}
                  </td>
                  <td className="sum" style={{ textAlign: 'right' }}>
                    {played === count && hcp !== null ? gross - hcp : t('common.dash')}
                  </td>
                  {withBonuses && (
                    <td className="sum bonus-sum" style={{ textAlign: 'right' }}>
                      {row.ids.reduce(
                        (total, id) => total + bonusTotal(round, bonusConfig, id),
                        0,
                      )}
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
