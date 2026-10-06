import { useMemo, useState } from 'react'
import { useData } from '../data'
import { summarizeTournament } from '../evaluations/tournament'
import { t } from '../i18n'
import { navigate } from '../nav'
import type { Route } from '../nav'
import { TEAM_IDS } from '../model/types'
import { usePwaInstall } from '../pwa'
import {
  BrandMark,
  Section,
  TeamBadge,
  formatDate,
  playerLabel,
  roundTitle,
} from './common'
import GameResults from './GameResults'
import MenuSheet from './MenuSheet'

/**
 * Přehled - veřejná domovská obrazovka: týmové skóre, aktuální kolo s živými
 * tabulkami, seznam kol, jednotlivci a duely pozic přes celý turnaj.
 */
export default function OverviewScreen({ playRoute }: { playRoute: Route | null }) {
  const { state, meta } = useData()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isStandalone, isMobile } = usePwaInstall()
  const summary = useMemo(
    () => summarizeTournament(state.rounds, state.players),
    [state.rounds, state.players],
  )
  const live = state.rounds.find((r) => r.status === 'live')
  const current =
    live ??
    [...state.rounds].reverse().find((r) => r.status === 'finished') ??
    state.rounds.find((r) => r.status === 'planned')
  const currentEvaluation = summary.rounds.find((entry) => entry.round.id === current?.id)
  const teams = state.tournament?.teams

  return (
    <div className="screen">
      <header className="app-header">
        <div className="screen-header-row">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.menu')}
          >
            ☰
          </button>
          <h1>
            <BrandMark />
          </h1>
          {playRoute && (
            <button
              type="button"
              className="icon-button"
              onClick={() => navigate(playRoute)}
              aria-label={t('nav.play')}
            >
              ✎
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {meta.mode === 'local' && <p className="notice info">{t('app.demoMode')}</p>}
        {meta.error && (
          <p className="notice error" role="alert">
            {meta.error}
          </p>
        )}
        {!state.tournament && meta.status !== 'loading' && (
          <div className="notice">
            <strong>{t('app.noTournament')}</strong>
            <p className="hint">{t('app.noTournamentHint')}</p>
          </div>
        )}

        {state.tournament && (
          <Section title={t('overview.teamScore')}>
            <div className="team-score">
              <span className="team-score-side team-a">
                <span className="team-score-name">{teams?.A.name}</span>
                <span className="team-score-value">{summary.teamPoints.A}</span>
              </span>
              <span className="team-score-vs">:</span>
              <span className="team-score-side team-b">
                <span className="team-score-name">{teams?.B.name}</span>
                <span className="team-score-value">{summary.teamPoints.B}</span>
              </span>
            </div>
            {summary.provisional && <p className="hint">{t('overview.provisional')}</p>}
          </Section>
        )}

        {current && (
          <Section
            title={
              live
                ? t('overview.currentRound')
                : t('round.title', { number: current.number })
            }
            action={
              <button
                type="button"
                className="link-button inline"
                onClick={() => navigate({ view: 'round', roundId: current.id })}
              >
                {t('overview.openRound')}
              </button>
            }
          >
            <button
              type="button"
              className={`round-card${current.status === 'live' ? ' live' : ''}`}
              onClick={() => navigate({ view: 'round', roundId: current.id })}
            >
              <span className="round-card-number">{current.number}</span>
              <span className="round-card-main">
                <span className="round-card-title">{current.course.name}</span>
                <span className="round-card-meta">{formatDate(current.date)}</span>
              </span>
              <span className="round-card-status">{t(`status.${current.status}`)}</span>
            </button>
            {currentEvaluation?.results.map((result) => (
              <GameResults
                key={result.game.id}
                round={current}
                players={state.players}
                result={result}
                teams={teams}
              />
            ))}
          </Section>
        )}

        {state.rounds.length > 0 && (
          <Section title={t('overview.rounds')}>
            <div className="round-list">
              {state.rounds.map((round) => {
                const points = summary.rounds.find(
                  (e) => e.round.id === round.id,
                )?.teamPoints
                return (
                  <button
                    key={round.id}
                    type="button"
                    className={`round-card${round.status === 'live' ? ' live' : ''}`}
                    onClick={() => navigate({ view: 'round', roundId: round.id })}
                  >
                    <span className="round-card-number">{round.number}</span>
                    <span className="round-card-main">
                      <span className="round-card-title">{roundTitle(round)}</span>
                      <span className="round-card-meta">
                        {formatDate(round.date)}
                        {points ? ` · ${points.A} : ${points.B}` : ''}
                      </span>
                    </span>
                    <span className="round-card-status">
                      {t(`status.${round.status}`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {summary.rounds.length > 0 && (
          <Section title={t('overview.individuals')}>
            <p className="hint">{t('overview.individualsHint')}</p>
            <ol className="standings">
              {summary.individuals.map((entry) => (
                <li
                  key={entry.id}
                  className={`standing${entry.position === 1 && entry.rounds > 0 ? ' leader' : ''}`}
                >
                  <span className="position">
                    {entry.rounds > 0 ? entry.position : '·'}
                  </span>
                  <span className="standing-name">
                    <span className="standing-name-row">
                      <TeamBadge teamId={entry.teamId} />
                      <span>{playerLabel(state.players, entry.id)}</span>
                    </span>
                    <span className="standing-detail">
                      {t('common.skins', { count: entry.skins })}
                    </span>
                  </span>
                  <span className="standing-score">
                    <strong>{entry.stableford}</strong>
                    <span className="standing-secondary">
                      {t('common.points', { count: entry.stableford })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {summary.rounds.length > 0 && summary.positions.some((p) => p.rounds > 0) && (
          <Section title={t('overview.positions')}>
            <p className="hint">{t('overview.positionsHint')}</p>
            <ul className="standings">
              {summary.positions.map((balance) => (
                <li key={balance.position} className="duel">
                  <span className="duel-side">
                    <span className="duel-name">
                      {TEAM_IDS[0]}
                      {balance.position}
                    </span>
                    <span className="duel-value">{balance.wins.A}</span>
                  </span>
                  <span className="duel-state">
                    {balance.wins.A} : {balance.wins.B}
                    {balance.halves > 0 ? ` (${balance.halves}×½)` : ''}
                  </span>
                  <span className="duel-side right">
                    <span className="duel-name">
                      {TEAM_IDS[1]}
                      {balance.position}
                    </span>
                    <span className="duel-value">{balance.wins.B}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {summary.rounds.length === 0 && state.tournament && (
          <p className="hint">{t('overview.noRounds')}</p>
        )}

        {!isStandalone && isMobile && (
          <section className="pwa-install">
            <strong>{t('overview.installApp')}</strong>
            <p className="hint">{t('overview.installHint')}</p>
          </section>
        )}
      </main>

      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} playRoute={playRoute} />}
    </div>
  )
}
