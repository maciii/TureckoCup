import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useData } from '../data'
import { evaluateRound } from '../evaluations'
import { skinsAtStake } from '../evaluations/skins'
import { stablefordAt } from '../evaluations/stableford'
import { t } from '../i18n'
import { MAX_STROKES, PICKED_UP } from '../model/types'
import type { PlayerId } from '../model/types'
import {
  flightCurrentHole,
  grossTotal,
  hasHandicap,
  holeCount,
  holeOrder,
  holesCompleted,
  holesPlayed,
  parAt,
  parForPlayedHoles,
  scoreAt,
  shortName,
  strokeIndexRanked,
  strokesReceived,
} from '../model/round'
import { goBack, navigate } from '../nav'
import { Header, ScoreMark, TeamBadge, formatToPar, sideLabel } from './common'
import Scorecard from './Scorecard'

const LONG_PRESS_MS = 500
const HOLE_KEY = 'tc26.playHole.v1'

interface Props {
  roundId: string
  flight: number | null
}

/**
 * Zápis skóre po jamkách - jedna obrazovka na jamku. Ovládání z Golfgames
 * (klepnutí vloží par, −/+ upraví rány, přidržení smaže), vzhled ze
 * Zavařováku (kolečko jamky, šipky po stranách, rány jako stepper v řádku
 * hráče). Čtyři hráči se musí vejít na displej bez rolování.
 */
export default function PlayScreen({ roundId, flight }: Props) {
  const { state, meta, store } = useData()
  const round = state.rounds.find((r) => r.id === roundId)
  const flightEntry = flight !== null ? round?.flights[flight] : undefined
  const [hole, setHole] = useState<number>(() => readHole(roundId, flight) ?? 0)
  const [showCard, setShowCard] = useState(false)
  const longPress = useRef<{ timer: number | null; fired: boolean }>({
    timer: null,
    fired: false,
  })

  // Při otevření flightu skočit na jamku, kde flight nejspíš je.
  useEffect(() => {
    if (!round || !flightEntry) return
    setHole(readHole(roundId, flight) ?? flightCurrentHole(round, flightEntry))
    // Jen při změně flightu/kola, ne při každém zápisu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, flight])

  useEffect(() => {
    try {
      localStorage.setItem(`${HOLE_KEY}:${roundId}:${flight}`, String(hole))
    } catch {
      /* ignore */
    }
  }, [hole, roundId, flight])

  const results = useMemo(
    () => (round ? evaluateRound(round, state.players) : []),
    [round, state.players],
  )

  if (!round) {
    return (
      <Shell title={t('play.title')}>
        <p className="hint center px" style={{ paddingTop: 24 }}>
          {meta.status === 'loading' ? t('app.loading') : t('common.dash')}
        </p>
      </Shell>
    )
  }

  const canWrite = meta.role === 'admin' || meta.role === 'writer'
  const locked = round.status === 'finished' && meta.role !== 'admin'
  const notLive = round.status === 'planned' && meta.role !== 'admin'

  if (!flightEntry) {
    return (
      <Shell title={t('play.title')} subtitle={round.course.name}>
        {!canWrite && <p className="notice">{t('play.signInRequired')}</p>}
        <p className="eyebrow">{t('play.chooseFlight')}</p>
        <ul className="option-list">
          {round.flights.map((entry, index) => (
            <li key={index}>
              <button
                type="button"
                className="option-row"
                onClick={() => navigate({ view: 'play', roundId, flight: index }, true)}
              >
                <span className="row-main">
                  <span className="option-title">
                    {t('round.flight', { number: index + 1 })}
                  </span>
                  <span className="option-meta">
                    {sideLabel(state.players, entry.players)}
                  </span>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
        </ul>
      </Shell>
    )
  }

  const count = holeCount(round)
  const order = holeOrder(round, flightEntry)
  const orderIndex = order.indexOf(hole)
  const par = parAt(round, hole)
  const si = strokeIndexRanked(round)[hole]
  const entryEnabled = canWrite && !locked && !notLive
  const stablefordGame = round.games.find((g) => g.kind === 'individual-stableford')
  const skinsResult = results.find((r) => r.game.kind === 'individual-skins')
  const teamSkinsResult = results.find((r) => r.game.kind === 'team-skins')
  const holeComplete = flightEntry.players.every(
    (id) => scoreAt(round, id, hole) !== undefined,
  )
  const canGoNext = orderIndex < count - 1

  function setScore(playerId: PlayerId, value: number | null) {
    if (!entryEnabled) return
    store.dispatch({ kind: 'setScore', roundId, playerId, hole, value })
  }

  function adjust(playerId: PlayerId, delta: number) {
    const current = scoreAt(round!, playerId, hole)
    const base = current === undefined || current === PICKED_UP ? par : current
    const next = current === undefined ? par + delta : base + delta
    setScore(playerId, Math.max(1, Math.min(MAX_STROKES, next)))
  }

  function startLongPress(playerId: PlayerId) {
    cancelLongPress()
    longPress.current.fired = false
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.fired = true
      setScore(playerId, null)
      navigator.vibrate?.(30)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    if (longPress.current.timer !== null) {
      clearTimeout(longPress.current.timer)
      longPress.current.timer = null
    }
  }

  function tapScore(playerId: PlayerId) {
    if (longPress.current.fired) {
      longPress.current.fired = false
      return
    }
    setScore(playerId, par)
  }

  function goTo(step: number) {
    const next = order[orderIndex + step]
    if (next !== undefined) setHole(next)
  }

  const flightSkins = skinsResult ? skinsAtStake(skinsResult, hole) : 0
  const teamSkins = teamSkinsResult ? skinsAtStake(teamSkinsResult, hole) : 0

  return (
    <div className="screen">
      <Header
        title={`${t('round.title', { number: round.number })} · ${t('round.flight', { number: (flight ?? 0) + 1 })}`}
        subtitle={round.course.name}
        right={
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate({ view: 'play', roundId, flight: null }, true)}
            aria-label={t('play.switchFlight')}
            title={t('play.switchFlight')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M3 20v-1a5 5 0 015-5h1a5 5 0 015 5v1" />
            </svg>
          </button>
        }
      />

      <main className="content">
        {meta.error && (
          <button
            type="button"
            className="notice error"
            onClick={store.dismissError}
            role="alert"
          >
            {meta.error}
          </button>
        )}
        {!canWrite && <p className="notice">{t('play.signInRequired')}</p>}
        {locked && <p className="notice">{t('play.roundFinished')}</p>}
        {notLive && <p className="notice">{t('play.roundNotLive')}</p>}

        <div className="hole-nav">
          <button
            type="button"
            className="hole-arrow"
            onClick={() => (orderIndex <= 0 ? goBack() : goTo(-1))}
            aria-label={orderIndex <= 0 ? t('common.back') : t('play.previousHole')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span
            className="hole-number"
            aria-label={t('common.hole', { number: hole + 1 })}
          >
            {hole + 1}
          </span>
          <button
            type="button"
            className={`hole-arrow${holeComplete && canGoNext ? ' go' : ''}`}
            onClick={() => goTo(1)}
            disabled={!canGoNext}
            aria-label={t('play.nextHole')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="hole-info">
          {t('common.par').toUpperCase()} {par}
          <span className="sep">·</span>
          {t('play.strokeIndex', { si: si ?? t('common.dash') })}
          <span className="sep">·</span>
          {t('play.holeOf', { index: orderIndex + 1, count })}
        </div>
        {(skinsResult || teamSkinsResult || meta.pending > 0) && (
          <div className="stakes">
            {skinsResult && (
              <span className={`tag${flightSkins > 1 ? ' hot' : ''}`}>
                {t('games.individual-skins.name')} · {flightSkins}
              </span>
            )}
            {teamSkinsResult && (
              <span className={`tag${teamSkins > 1 ? ' hot' : ' navy'}`}>
                {t('games.team-skins.name')} · {teamSkins}
              </span>
            )}
            {meta.pending > 0 && (
              <span className="tag gold">
                {t('play.pendingWrites', { count: meta.pending })}
              </span>
            )}
          </div>
        )}

        <ul className="player-list">
          {flightEntry.players.map((playerId) => {
            const score = scoreAt(round, playerId, hole)
            const strokes = strokesReceived(round, playerId, hole)
            const completed = holesCompleted(round, playerId)
            const toPar = grossTotal(round, playerId) - parForPlayedHoles(round, playerId)
            const points =
              stablefordGame && score !== undefined
                ? stablefordAt(round, playerId, hole, stablefordGame.options)
                : undefined
            const player = state.players.find((p) => p.id === playerId)
            const name = shortName(state.players, playerId)
            return (
              <li key={playerId} className="player-row">
                <div className="player-info">
                  <span className="player-name">
                    <TeamBadge teamId={player?.teamId} />
                    <span className="player-name-text">{name}</span>
                    {strokes > 0 && (
                      <span
                        className="player-mark strokes"
                        title={t('play.strokesReceived', { count: strokes })}
                      >
                        {'•'.repeat(strokes)}
                      </span>
                    )}
                    {!hasHandicap(round, playerId) && (
                      <span className="player-mark warn">?</span>
                    )}
                    {points !== undefined && (
                      <span className="player-mark gain">
                        {t('play.pointsShort', { count: points })}
                      </span>
                    )}
                  </span>
                  <span className="player-total">
                    {completed === 0 && holesPlayed(round, playerId) === 0
                      ? t('play.noScore')
                      : t('play.total', {
                          strokes: grossTotal(round, playerId),
                          toPar: formatToPar(toPar),
                        })}
                  </span>
                </div>
                <button
                  type="button"
                  className={`pickup-button${score === PICKED_UP ? ' active' : ''}`}
                  onClick={() =>
                    setScore(playerId, score === PICKED_UP ? null : PICKED_UP)
                  }
                  disabled={!entryEnabled}
                  aria-label={`${t('play.pickedUp')}: ${name}`}
                  title={t('play.pickedUp')}
                >
                  ×
                </button>
                <div className="stepper">
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => adjust(playerId, -1)}
                    disabled={!entryEnabled}
                    aria-label={t('play.minus', { name })}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="score-value"
                    onClick={() => tapScore(playerId)}
                    disabled={!entryEnabled}
                    onPointerDown={() => startLongPress(playerId)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={t('play.score', { name })}
                  >
                    <ScoreMark score={score} par={par} large />
                  </button>
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => adjust(playerId, 1)}
                    disabled={!entryEnabled}
                    aria-label={t('play.plus', { name })}
                  >
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="hint center px" style={{ paddingTop: 10 }}>
          {t('play.clearHint', { par })}
        </p>
      </main>

      <footer className="app-footer">
        <div className="footer-row">
          <button type="button" className="btn sm" onClick={() => setShowCard(true)}>
            {t('play.showScorecard')}
          </button>
          <button
            type="button"
            className={`btn sm${holeComplete && canGoNext ? ' primary' : ''}`}
            onClick={() => goTo(1)}
            disabled={!canGoNext}
          >
            {t('play.nextHole')} ›
          </button>
        </div>
      </footer>

      {showCard && (
        <div
          className="sheet-backdrop"
          onClick={() => setShowCard(false)}
          role="presentation"
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow" style={{ marginTop: 4 }}>
              {t('round.scorecard')} · {t('round.flight', { number: (flight ?? 0) + 1 })}
            </p>
            <Scorecard
              round={round}
              players={state.players}
              skins={skinsResult}
              teamSkins={teamSkinsResult}
              currentHole={hole}
              flightIndex={flight ?? undefined}
            />
            <div className="px" style={{ paddingTop: 14 }}>
              <button type="button" className="btn" onClick={() => setShowCard(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="screen">
      <Header title={title} subtitle={subtitle} />
      <main className="content">{children}</main>
    </div>
  )
}

function readHole(roundId: string, flight: number | null): number | undefined {
  try {
    const raw = localStorage.getItem(`${HOLE_KEY}:${roundId}:${flight}`)
    const value = raw === null ? NaN : Number.parseInt(raw, 10)
    if (!Number.isNaN(value)) return value
  } catch {
    /* ignore */
  }
  return undefined
}
