import { useMemo, useState } from 'react'
import { useData } from '../data'
import { evaluateRound, roundTeamPoints } from '../evaluations'
import { t } from '../i18n'
import { goBack, navigate } from '../nav'
import { SCORE_CATEGORIES, ScoreMark, formatDate, roundTitle } from './common'
import GameResults from './GameResults'
import Scorecard from './Scorecard'

/** Kolo: výsledky všech her a scorekarta obou flightů. */
export default function RoundScreen({ roundId }: { roundId: string }) {
  const { state, meta } = useData()
  const [tab, setTab] = useState<'results' | 'scorecard'>('results')
  const round = state.rounds.find((r) => r.id === roundId)
  const results = useMemo(
    () => (round ? evaluateRound(round, state.players) : []),
    [round, state.players],
  )

  if (!round) {
    return (
      <div className="screen">
        <header className="app-header">
          <div className="screen-header-row">
            <button
              type="button"
              className="icon-button"
              onClick={goBack}
              aria-label={t('common.back')}
            >
              ‹
            </button>
            <h1>{t('nav.round')}</h1>
          </div>
        </header>
        <main className="content">
          <p className="hint">
            {meta.status === 'loading' ? t('app.loading') : t('common.dash')}
          </p>
        </main>
      </div>
    )
  }

  const teamPoints = roundTeamPoints(results)
  const skins =
    results.find((r) => r.game.kind === 'team-skins') ??
    results.find((r) => r.game.kind === 'individual-skins')
  const canEnter = round.status === 'live' || meta.role === 'admin'

  return (
    <div className="screen">
      <header className="app-header">
        <div className="screen-header-row">
          <button
            type="button"
            className="icon-button"
            onClick={goBack}
            aria-label={t('common.back')}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{roundTitle(round)}</h1>
            <p className="subtitle">
              {formatDate(round.date)} · {t(`status.${round.status}`)} ·{' '}
              {t('round.teamPoints')} {teamPoints.A} : {teamPoints.B}
            </p>
          </div>
        </div>
      </header>

      <main className="content">
        <div className="segmented">
          <button
            type="button"
            className={`segment${tab === 'results' ? ' selected' : ''}`}
            onClick={() => setTab('results')}
          >
            {t('round.results')}
          </button>
          <button
            type="button"
            className={`segment${tab === 'scorecard' ? ' selected' : ''}`}
            onClick={() => setTab('scorecard')}
          >
            {t('round.scorecard')}
          </button>
        </div>

        {tab === 'results' &&
          (results.length === 0 ? (
            <p className="hint">{t('round.noGames')}</p>
          ) : (
            results.map((result) => (
              <GameResults
                key={result.game.id}
                round={round}
                players={state.players}
                result={result}
                teams={state.tournament?.teams}
              />
            ))
          ))}

        {tab === 'scorecard' && (
          <>
            <Scorecard round={round} players={state.players} skins={skins} />
            <ul className="legend">
              {SCORE_CATEGORIES.map((category, index) => (
                <li key={category}>
                  <ScoreMark score={[2, 3, 4, 5, 6, 7][index]} par={4} />
                  {t(`score.${category}`)}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {canEnter && (
        <footer className="app-footer">
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate({ view: 'play', roundId: round.id, flight: null })}
          >
            {t('round.enterScores')}
          </button>
        </footer>
      )}
    </div>
  )
}
