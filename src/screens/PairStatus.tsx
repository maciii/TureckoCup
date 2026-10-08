import type { EvaluationResult } from '../evaluations'
import { CONCEDED } from '../model/round'
import type { Flight, Player, PlayerId } from '../model/types'
import { t } from '../i18n'
import { TeamBadge, sideLabel } from './common'

interface Props {
  result: EvaluationResult
  players: Player[]
  flight: Flight
  hole: number
}

/**
 * Best + Součet při zápisu (vzor Golfgames): u každé dvojice flightu lepší
 * míč, součet a body na téhle jamce, nahoře průběžné skóre zápasu. Vítězná
 * hodnota je zvýrazněná, ať je hned vidět, za co bod padl.
 */
export default function PairStatus({ result, players, flight, hole }: Props) {
  const inFlight = new Set<PlayerId>(flight.players)
  const duel = result.duels?.find((d) =>
    d.sides.some((side) => side.players.some((id) => inFlight.has(id))),
  )
  if (!duel || duel.sides.length < 2) return null
  const points = duel.holePoints?.[String(hole)]
  const label = (index: number) => sideLabel(players, duel.sides[index]!.players)
  const format = (value: number | null) =>
    value === null
      ? t('common.dash')
      : value === CONCEDED
        ? t('best.conceded')
        : String(value)

  return (
    <section
      className="pair-status"
      aria-label={result.game.name ?? t('games.best-aggregate.name')}
    >
      <div className="pair-status-head">
        <span className="pair-status-name">
          {result.game.name ?? t('games.best-aggregate.name')}
        </span>
        <span className="pair-status-score">
          {label(0)} <b>{t('best.points', { count: duel.sides[0]!.value })}</b>
          <span className="sep">·</span>
          {label(1)} <b>{t('best.points', { count: duel.sides[1]!.value })}</b>
        </span>
      </div>
      {duel.sides.map((side, index) => {
        const own = points?.[index]
        const lead = points !== undefined && duel.holeWinners?.[String(hole)] === index
        return (
          <div key={side.id} className={`pair-card${lead ? ' lead' : ''}`}>
            <span className="pair-name">
              <TeamBadge teamId={side.teamId} />
              <span>{sideLabel(players, side.players)}</span>
            </span>
            {own ? (
              <span className="pair-chips">
                <span className={`chip${own.best > 0 ? ' win' : ''}`}>
                  {t('best.best')} {format(own.bestBall)}
                </span>
                <span className={`chip${own.aggregate > 0 ? ' win' : ''}`}>
                  {t('best.aggregate')} {format(own.sum)}
                </span>
                {own.bonus > 0 && (
                  <span className="chip win">
                    {t('best.bonus')} +{own.bonus}
                  </span>
                )}
                {own.extra > 0 && (
                  <span className="chip win">
                    {t('bonus.short')} +{own.extra}
                  </span>
                )}
                <span className="chip total">
                  {t('best.points', { count: own.total })}
                </span>
              </span>
            ) : (
              <span className="pair-chips">
                <span className="chip">{t('play.status.pending')}</span>
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
