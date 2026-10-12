import { t } from '../i18n'
import { playingHandicap, shortName, teamOf } from '../model/round'
import {
  compareSides,
  compareStrokes,
  flightCompany,
  roundAllowance,
} from '../model/strokes'
import { matchGame } from '../model/games'
import { texasHandicap, texasShares, texasStrokesAt } from '../evaluations/texas'
import type { Player, PlayerId, TournamentRound } from '../model/types'
import { TeamBadge, sideLabel } from './common'

interface Props {
  round: TournamentRound
  players: Player[]
  me: PlayerId
  onClose: () => void
  /** Tlačítko do zápisu; chybí u kola, kde se nezapisuje. */
  onEnter?: () => void
}

/**
 * Náhled scorekarty před zápasem: u každé jamky, proti komu z flightu má
 * hráč ránu navíc (zeleně) a kdo ji má na něj (červeně). Soupeř ze zápasu
 * je první sloupec, parťák poslední. Čísla jsou z přidělených ran kola,
 * tedy totéž, s čím pak počítají netto hry.
 */
export default function StrokesSheet({ round, players, me, onClose, onEnter }: Props) {
  const allowance = roundAllowance(round)
  const company = flightCompany(round, players, me)
  // Texas scramble: rány má dvojice, ne hráč - jeden sloupec, naše dvojice proti jejich.
  const match = matchGame(round)
  const texas =
    match?.kind === 'texas-scramble' && company.pairs && company.opponents.length > 0
      ? match
      : undefined
  const mySide = [me, ...company.partners]
  const columns: {
    id: string
    tag: string | null
    label: string
    comparison: ReturnType<typeof compareStrokes>
  }[] = texas
    ? [
        {
          id: company.opponents[0]!,
          tag: 'opponent',
          label: sideLabel(players, company.opponents),
          comparison: compareSides(
            round,
            mySide,
            company.opponents,
            (side, hole) => texasStrokesAt(round, side, hole, texas.options),
            (side) => texasHandicap(round, side, texas.options),
          ),
        },
      ]
    : [
        ...company.opponents.map((id) => ({
          id,
          tag: company.pairs ? 'opponent' : 'duel',
        })),
        ...company.others.map((id) => ({ id, tag: null })),
        ...company.partners.map((id) => ({ id, tag: 'partner' })),
      ].map((column) => ({
        ...column,
        label: shortName(players, column.id),
        comparison: compareStrokes(round, me, column.id, allowance),
      }))
  const myHandicap = texas
    ? texasHandicap(round, mySide, texas.options)
    : playingHandicap(round, me, allowance)

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet strokes-sheet"
        role="dialog"
        aria-label={t('strokes.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head px">
          <h2>{t('strokes.title')}</h2>
          <p className="hint">
            {texas
              ? t('strokes.texasHint', {
                  pair: sideLabel(players, mySide),
                  hcp: myHandicap,
                  low: Math.round(texasShares(texas.options).low * 100),
                  high: Math.round(texasShares(texas.options).high * 100),
                })
              : t('strokes.hint', {
                  hcp: myHandicap,
                  allowance:
                    allowance === 1
                      ? ''
                      : t('strokes.allowance', { percent: Math.round(allowance * 100) }),
                })}
          </p>
        </div>
        {columns.length === 0 ? (
          <p className="hint center px">{t('strokes.noFlight')}</p>
        ) : (
          <div className="strokes-scroll">
            <table className="strokes-table">
              <thead>
                <tr>
                  <th className="num">{t('strokes.hole')}</th>
                  <th className="num">{t('strokes.par')}</th>
                  <th className="num">{t('strokes.si')}</th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className={`who${column.tag ? ` ${column.tag}` : ''}`}
                    >
                      <span className="who-name">
                        <TeamBadge teamId={teamOf(players, column.id)} />
                        {column.label}
                      </span>
                      <span className="who-meta">
                        {t('strokes.hcp', { value: column.comparison.handicap })}
                        {column.tag && (
                          <span
                            className={`tag ${column.tag === 'partner' ? 'navy' : 'gold'}`}
                          >
                            {t(
                              column.tag === 'partner'
                                ? 'strokes.partnerTag'
                                : column.tag === 'duel'
                                  ? 'strokes.duelTag'
                                  : 'strokes.opponentTag',
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns[0]!.comparison.holes.map((row, index) => (
                  <tr key={row.hole}>
                    <td className="num hole">{row.hole + 1}</td>
                    <td className="num">{row.par}</td>
                    <td className="num si">{row.si}</td>
                    {columns.map((column) => {
                      const cell = column.comparison.holes[index]!
                      const cls = cell.diff > 0 ? 'gain' : cell.diff < 0 ? 'loss' : 'even'
                      return (
                        <td key={column.id} className={`cell ${cls}`}>
                          {cell.diff > 0
                            ? `+${cell.diff}`
                            : cell.diff < 0
                              ? `−${-cell.diff}`
                              : cell.mine > 0
                                ? t('strokes.both')
                                : '·'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>{t('strokes.total')}</th>
                  {columns.map((column) => (
                    <td key={column.id} className="cell sum">
                      <span className="gain">
                        {t('strokes.up', { count: column.comparison.up })}
                      </span>
                      <span className="loss">
                        {t('strokes.down', { count: column.comparison.down })}
                      </span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="hint center px strokes-legend">{t('strokes.legend')}</p>
        <div className="px sheet-actions">
          {onEnter && (
            <button type="button" className="btn primary" onClick={onEnter}>
              {t('live.enter')}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
