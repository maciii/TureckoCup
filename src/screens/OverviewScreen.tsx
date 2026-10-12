import { useMemo, useState } from 'react'
import { useData, variantHref } from '../data'
import { summarizeTournament } from '../evaluations/tournament'
import { t } from '../i18n'
import { navigate } from '../nav'
import type { Route } from '../nav'
import { usePwaInstall } from '../pwa'
import {
  Crest,
  Header,
  MenuIcon,
  Pill,
  Section,
  StatusChip,
  TeamBadge,
  formatDate,
  formatDay,
  playerLabel,
  teamName,
} from './common'
import GameResults from './GameResults'
import type { TournamentRound } from '../model/types'
import { shortName } from '../model/round'
import { hasSchedule, isValidTime, localToday, upcomingRound } from '../model/schedule'
import { pickupRuleOf } from '../model/pickup'
import { bonusConfigOf } from '../model/bonuses'
import BonusResults from './BonusResults'
import MenuSheet from './MenuSheet'
import LiveNow from './LiveNow'
import { AwardIntro, AwardsSection } from './Awards'
import Welcome, { welcomeSeen, markWelcomeSeen } from './Welcome'
import TeamSkinsOverview from './TeamSkinsOverview'
import { computeAwards } from '../evaluations/awards'
import { flightHolesStarted } from '../model/round'

/**
 * Přehled - veřejná domovská obrazovka: týmové skóre, aktuální kolo s živými
 * tabulkami, seznam kol, jednotlivci a duely pozic přes celý turnaj.
 */
export default function OverviewScreen({ playRoute }: { playRoute: Route | null }) {
  const { state, meta } = useData()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isStandalone, isMobile } = usePwaInstall()
  const pickup = pickupRuleOf(state.tournament?.pickup)
  const bonusConfig = bonusConfigOf(state.tournament?.bonuses)
  const summary = useMemo(
    () => summarizeTournament(state.rounds, state.players, pickup, bonusConfig),
    [
      state.rounds,
      state.players,
      pickup.timesPar,
      pickup.plus,
      pickup.addStrokes,
      bonusConfig,
    ],
  )
  const awards = useMemo(
    () => computeAwards(state.rounds, state.players, bonusConfig),
    [state.rounds, state.players, bonusConfig],
  )
  const me = meta.account?.playerId ?? null
  const [welcomeClosed, setWelcomeClosed] = useState(false)
  const live = state.rounds.find((r) => r.status === 'live')
  const current =
    live ??
    [...state.rounds].reverse().find((r) => r.status === 'finished') ??
    state.rounds.find((r) => r.status === 'planned')
  const today = localToday()
  const upcoming = upcomingRound(state.rounds, today)
  // Uvítání hráče: kolo, které ho dnes čeká (rozehrané nebo nejbližší plánované).
  const welcomeRound = upcoming
  const welcomeIntro =
    me !== null &&
    welcomeRound !== undefined &&
    meta.status !== 'loading' &&
    !welcomeClosed &&
    !welcomeSeen(me, welcomeRound, today)
  const canWrite = meta.role === 'admin' || meta.role === 'writer'
  const currentEvaluation = summary.rounds.find((entry) => entry.round.id === current?.id)
  const teams = state.tournament?.teams
  const played = summary.rounds.filter((e) => e.round.status === 'finished').length
  const total = summary.teamPoints.A + summary.teamPoints.B
  const barA = total > 0 ? (summary.teamPoints.A / total) * 100 : 0
  const barB = total > 0 ? (summary.teamPoints.B / total) * 100 : 0
  const dates = state.rounds.length
    ? t('overview.dateRange', {
        from: formatDate(state.rounds[0]!.date),
        to: formatDate(state.rounds[state.rounds.length - 1]!.date),
      })
    : ''

  return (
    <div className="screen">
      <Header
        title={t('app.name')}
        left={
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.menu')}
          >
            <MenuIcon />
          </button>
        }
        right={
          playRoute ? (
            <button
              type="button"
              className="icon-button"
              onClick={() => navigate(playRoute)}
              aria-label={t('nav.play')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16z" />
                <path d="M12 8l4 4" />
              </svg>
            </button>
          ) : undefined
        }
      />

      <main className="content">
        {meta.demo === 'preview' ? (
          <p className="notice preview" data-testid="preview-notice">
            {t('app.previewMode')}
            <br />
            <a href={variantHref(null)}>{t('app.toLive')} ›</a>
          </p>
        ) : (
          meta.mode === 'local' && <p className="notice info">{t('app.demoMode')}</p>
        )}
        {meta.error && (
          <p className="notice error" role="alert">
            {meta.error}
          </p>
        )}

        <div className="hero">
          <Crest className="hero-crest" />
          <h1>{state.tournament?.name ?? t('app.name')}</h1>
          <p>
            {state.tournament
              ? t('overview.venue', { dates })
              : meta.status === 'loading'
                ? t('app.loading')
                : t('app.noTournament')}
          </p>
        </div>

        {!state.tournament && meta.status !== 'loading' && (
          <p className="hint center px">{t('app.noTournamentHint')}</p>
        )}

        {me && welcomeRound && (
          <Welcome
            round={welcomeRound}
            players={state.players}
            me={me}
            canWrite={canWrite}
            intro={welcomeIntro}
            onIntroClose={() => {
              markWelcomeSeen(me, welcomeRound, today)
              setWelcomeClosed(true)
            }}
          />
        )}
        {live && currentEvaluation && (
          <LiveNow round={live} results={currentEvaluation.results} />
        )}
        {/* Program (odjezd, tee time) má smysl před startem; jakmile se zapisuje,
            stačí karta živého kola. */}
        {upcoming &&
          (upcoming.status !== 'live' ||
            upcoming.flights.every((f) => flightHolesStarted(upcoming, f) === 0)) && (
            <RoundSchedule round={upcoming} today={today} />
          )}

        {state.tournament && (
          <>
            <div className="divider" />
            <p className="eyebrow">{t('overview.teamScore')}</p>
            <div className="score-hero">
              <span className="score-side">
                <Pill teamId="A" size="lg">
                  {summary.teamPoints.A}
                </Pill>
                <span className="score-name">{teamName('A', teams)}</span>
              </span>
              <span className="score-side">
                <Pill teamId="B" size="lg">
                  {summary.teamPoints.B}
                </Pill>
                <span className="score-name">{teamName('B', teams)}</span>
              </span>
            </div>
            <div className="score-bar">
              <span className="seg-a" style={{ width: `${barA}%` }} />
              <span className="seg-b" style={{ width: `${barB}%` }} />
            </div>
            <p className="hint center px" style={{ marginTop: 8 }}>
              {t('overview.played', { played, total: state.rounds.length })}
              {summary.provisional ? ` · ${t('overview.provisional')}` : ''}
            </p>
          </>
        )}

        {state.tournament && (
          <AwardsSection
            summary={awards}
            players={state.players}
            me={me}
            rounds={state.rounds}
          />
        )}

        <TeamSkinsOverview rounds={state.rounds} players={state.players} teams={teams} />

        {state.rounds.length > 0 && (
          <>
            <p className="eyebrow">{t('overview.rounds')}</p>
            <div className="list">
              {state.rounds.map((round) => {
                const points = summary.rounds.find(
                  (e) => e.round.id === round.id,
                )?.teamPoints
                const isLive = round.status === 'live'
                return (
                  <button
                    key={round.id}
                    type="button"
                    className={`row${isLive ? ' live' : ''}`}
                    onClick={() => navigate({ view: 'round', roundId: round.id })}
                  >
                    <span className="row-main">
                      <span className="row-title">
                        <span>
                          {t('round.title', { number: round.number })} ·{' '}
                          {round.course.name}
                        </span>
                      </span>
                      <span className="row-meta">
                        {formatDate(round.date)}
                        {round.status !== 'finished' &&
                          isValidTime(round.flights[0]?.teeTime) &&
                          ` · ${round.flights[0]!.teeTime}`}
                        {' · '}
                        <StatusChip status={round.status} />
                      </span>
                    </span>
                    {points && round.status !== 'planned' && (
                      <span
                        className="row-right"
                        style={{ flexDirection: 'row', gap: 4 }}
                      >
                        <Pill teamId="A">{points.A}</Pill>
                        <Pill teamId="B">{points.B}</Pill>
                      </span>
                    )}
                    <span className="chev">›</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {current && currentEvaluation && (
          <>
            <div className="divider" style={{ marginTop: 10 }} />
            <p className="eyebrow">
              {live
                ? t('overview.currentRound')
                : t('round.title', { number: current.number })}{' '}
              · {current.course.name}
            </p>
            {currentEvaluation.results.map((result) => (
              <GameResults
                key={result.game.id}
                round={current}
                players={state.players}
                result={result}
                teams={teams}
              />
            ))}
            {currentEvaluation.bonuses && (
              <BonusResults
                round={current}
                players={state.players}
                config={bonusConfig}
                summary={currentEvaluation.bonuses}
                teams={teams}
              />
            )}
          </>
        )}

        {summary.rounds.length > 0 && (
          <Section
            title={t('overview.individuals')}
            note={t('overview.individualsHint')}
            accent="gold"
          >
            <ol className="list" style={{ listStyle: 'none', margin: 0 }}>
              {summary.individuals.map((entry) => (
                <li
                  key={entry.id}
                  className={`row${entry.position === 1 && entry.rounds > 0 ? ' leader' : ''}`}
                >
                  <span className="position">
                    {entry.rounds > 0 ? entry.position : '·'}
                  </span>
                  <span className="row-main">
                    <span className="row-title">
                      <TeamBadge teamId={entry.teamId} />
                      <span>{playerLabel(state.players, entry.id)}</span>
                    </span>
                    <span className="row-meta">
                      {t('common.skins', { count: entry.skins })}
                      {entry.bonus > 0 && ` · ${t('bonus.short')} ${entry.bonus}`} ·{' '}
                      {t('common.rounds', { count: entry.rounds })}
                    </span>
                  </span>
                  <Pill teamId={entry.teamId}>{entry.stableford}</Pill>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {summary.positions.some((p) => p.rounds > 0) && (
          <Section
            title={t('overview.positions')}
            note={t('overview.positionsHint')}
            accent="navy"
          >
            <ul className="list" style={{ listStyle: 'none', margin: 0 }}>
              {summary.positions.map((balance) => (
                <li key={balance.position} className="duel">
                  <span className="duel-side">
                    <span className="nm">
                      <TeamBadge teamId="A" />
                      <span>
                        {balance.players.A.map((id) =>
                          playerLabel(state.players, id),
                        ).join(' / ') || t('common.dash')}
                      </span>
                    </span>
                  </span>
                  <span className="duel-center">
                    <span className="v">
                      {balance.halves > 0
                        ? t('overview.balanceHalves', {
                            a: balance.wins.A,
                            b: balance.wins.B,
                            halves: balance.halves,
                          })
                        : t('overview.balance', { a: balance.wins.A, b: balance.wins.B })}
                    </span>
                    <div className="m">
                      {t('overview.positionShort')} {balance.position}
                    </div>
                  </span>
                  <span className="duel-side right">
                    <span className="nm">
                      <span>
                        {balance.players.B.map((id) =>
                          playerLabel(state.players, id),
                        ).join(' / ') || t('common.dash')}
                      </span>
                      <TeamBadge teamId="B" />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {!isStandalone && isMobile && (
          <div className="soft-card" style={{ marginTop: 24 }}>
            <strong style={{ fontSize: 13, fontWeight: 800 }}>
              {t('overview.installApp')}
            </strong>
            <p className="hint" style={{ marginTop: 4 }}>
              {t('overview.installHint')}
            </p>
          </div>
        )}
      </main>

      {state.tournament && meta.status !== 'loading' && !welcomeIntro && (
        <AwardIntro summary={awards} players={state.players} me={me} />
      )}

      {menuOpen && (
        <MenuSheet
          onClose={() => setMenuOpen(false)}
          playRoute={playRoute}
          current="overview"
        />
      )}
    </div>
  )
}

/**
 * Program nejbližšího kola: hromadný odjezd a tee time obou flightů se
 * jmény. Hráči ho potřebují po ruce, proto je hned pod hlavičkou turnaje.
 */
function RoundSchedule({ round, today }: { round: TournamentRound; today: string }) {
  const { state } = useData()
  const label =
    round.status === 'live'
      ? t('schedule.program')
      : round.date === today
        ? t('schedule.today')
        : t('schedule.next')
  return (
    <section className="schedule" aria-label={t('schedule.teeTime')}>
      <p className="eyebrow">
        {label} · {formatDay(round.date)}
      </p>
      <button
        type="button"
        className="schedule-title"
        onClick={() => navigate({ view: 'round', roundId: round.id })}
      >
        {t('round.title', { number: round.number })} · {round.course.name}
        <span className="chev">›</span>
      </button>
      {/* Bez časů karta zůstává: hráči mají vidět, které kolo je další, a admin,
          že má program doplnit (u kola v administraci). */}
      {!hasSchedule(round) && <p className="hint center px">{t('schedule.missing')}</p>}
      <ul className="list schedule-list">
        {isValidTime(round.departure) && (
          <li className="row">
            <span className="schedule-time">{round.departure}</span>
            <span className="row-main">
              <span className="row-title">{t('schedule.departure')}</span>
            </span>
          </li>
        )}
        {round.flights.map((flight, index) => (
          <li key={index} className="row">
            <span className="schedule-time">
              {isValidTime(flight.teeTime) ? flight.teeTime : t('common.dash')}
            </span>
            <span className="row-main">
              <span className="row-title">
                {t('round.flight', { number: index + 1 })}
                {flight.startHole > 0 &&
                  ` · ${t('schedule.startHole', { number: flight.startHole + 1 })}`}
              </span>
              <span className="row-meta">
                {flight.players.map((id) => shortName(state.players, id)).join(', ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
