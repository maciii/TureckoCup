import { useMemo, useState } from 'react'
import { useData } from '../data'
import { evaluateRound, roundTeamPoints } from '../evaluations'
import { t } from '../i18n'
import { navigate } from '../nav'
import { Header, Pill, SCORE_CATEGORIES, ScoreMark, Section, formatDate } from './common'
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
        <Header title={t('nav.round')} />
        <main className="content">
          <p className="hint center px" style={{ paddingTop: 24 }}>
            {meta.status === 'loading' ? t('app.loading') : t('common.dash')}
          </p>
        </main>
      </div>
    )
  }

  const teamPoints = roundTeamPoints(results)
  const teamSkins = results.find((r) => r.game.kind === 'team-skins')
  const skins = results.find((r) => r.game.kind === 'individual-skins')
  const canEnter = round.status === 'live' || meta.role === 'admin'

  return (
    <div className="screen">
      <Header
        title={t('round.title', { number: round.number })}
        subtitle={`${round.course.name} · ${formatDate(round.date)} · ${t(`status.${round.status}`)}`}
      />

      <main className="content">
        <div className="tabs">
          <button
            type="button"
            className={`tab${tab === 'results' ? ' selected' : ''}`}
            aria-pressed={tab === 'results'}
            onClick={() => setTab('results')}
          >
            {t('round.results')}
          </button>
          <button
            type="button"
            className={`tab${tab === 'scorecard' ? ' selected' : ''}`}
            aria-pressed={tab === 'scorecard'}
            onClick={() => setTab('scorecard')}
          >
            {t('round.scorecard')}
          </button>
        </div>

        <div className="score-hero" style={{ paddingTop: 16 }}>
          <span className="score-side">
            <Pill teamId="A" size="md">
              {teamPoints.A}
            </Pill>
            <span className="score-name">{state.tournament?.teams.A.name}</span>
          </span>
          <span className="score-side">
            <Pill teamId="B" size="md">
              {teamPoints.B}
            </Pill>
            <span className="score-name">{state.tournament?.teams.B.name}</span>
          </span>
        </div>
        <p className="hint center px">{t('round.teamPoints')}</p>

        {tab === 'results' &&
          (results.length === 0 ? (
            <p className="hint center px" style={{ paddingTop: 16 }}>
              {t('round.noGames')}
            </p>
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
          <Section
            title={t('round.scorecard')}
            accent="fairway"
            note={t('round.scorecardHint')}
          >
            <Scorecard
              round={round}
              players={state.players}
              teamSkins={teamSkins}
              skins={skins}
            />
            <ul className="legend">
              {SCORE_CATEGORIES.map((category, index) => (
                <li key={category}>
                  <ScoreMark score={[2, 3, 4, 5, 6, 7][index]} par={4} />
                  {t(`score.${category}`)}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </main>

      {canEnter && (
        <footer className="app-footer">
          <button
            type="button"
            className="btn primary"
            onClick={() => navigate({ view: 'play', roundId: round.id, flight: null })}
          >
            {t('round.enterScores')}
          </button>
        </footer>
      )}
    </div>
  )
}
