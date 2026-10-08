import { useEffect } from 'react'
import { useData } from '../data'
import type { EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import { flightIndexOf, shortName } from '../model/round'
import type { TournamentRound } from '../model/types'
import { navigate } from '../nav'
import { flightProgressLabel, formatDay, gameTitle } from './common'
import { DuelRow } from './GameResults'

interface Props {
  round: TournamentRound
  results: EvaluationResult[]
}

/**
 * Karta živého kola hned pod hlavičkou: kde oba flighty jsou, stav všech
 * zápasů kola (Four-ball, Best + Součet, singly pozic) a pro přihlášeného
 * hráče či admina tlačítko rovnou do zápisu vlastního flightu. Návštěvník
 * tu má přihlášení, aby k zápisu nemusel přes menu.
 */
export default function LiveNow({ round, results }: Props) {
  const { state, meta, store } = useData()
  const signedIn = meta.account !== null
  const canWrite = meta.role === 'admin' || meta.role === 'writer'
  // SDK přihlášení dopředu jako v menu - popup musí jít otevřít hned z klepnutí.
  useEffect(() => {
    if (!signedIn) store.prepareSignIn()
  }, [signedIn, store])

  const playerId = meta.account?.playerId ?? null
  const ownIndex = playerId ? flightIndexOf(round, playerId) : -1
  const ownFlight = ownIndex >= 0 ? ownIndex : null
  const matches = results.filter((result) => (result.duels?.length ?? 0) > 0)

  return (
    <section className="live-now" aria-label={t('schedule.live')}>
      <p className="eyebrow">
        {t('schedule.live')} · {formatDay(round.date)}
      </p>
      <button
        type="button"
        className="schedule-title"
        onClick={() => navigate({ view: 'round', roundId: round.id })}
      >
        {t('round.title', { number: round.number })} · {round.course.name}
        <span className="chev">›</span>
      </button>

      <div className="live-enter">
        {canWrite ? (
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                navigate({ view: 'play', roundId: round.id, flight: ownFlight })
              }
            >
              {t('live.enter')}
            </button>
            <p className="hint center">
              {ownFlight !== null
                ? t('live.ownFlight', { number: ownFlight + 1 })
                : t('live.chooseFlight')}
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost"
              disabled={!meta.authReady}
              onClick={() => void store.signIn()}
            >
              {meta.authReady ? t('admin.signIn') : t('admin.signingIn')}
            </button>
            <p className="hint center">{t('play.signInRequired')}</p>
          </>
        )}
      </div>

      <ul className="list live-flights">
        {round.flights.map((flight, index) => (
          <li key={index} className={`row${index === ownFlight ? ' own' : ''}`}>
            <span className="row-main">
              <span className="row-title">
                <span>
                  {t('round.flight', { number: index + 1 })} ·{' '}
                  {flightProgressLabel(round, flight)}
                </span>
                {index === ownFlight && (
                  <span className="tag gold">{t('live.yours')}</span>
                )}
              </span>
              <span className="row-meta">
                {flight.players.map((id) => shortName(state.players, id)).join(', ')}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {matches.map((result) => (
        <div key={result.game.id} className="live-game">
          <p className="live-game-title">
            {gameTitle(result.game)}
            {result.pending > 0 &&
              ` · ${t('round.pendingHoles', { count: result.pending })}`}
          </p>
          <ul className="list">
            {(result.duels ?? []).map((duel) => (
              <DuelRow
                key={duel.id}
                duel={duel}
                players={state.players}
                format={result.game.options.format ?? 'strokes-net'}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
