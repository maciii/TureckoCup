import { useEffect, useMemo, useRef, useState } from 'react'
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
  parAt,
  parForPlayedHoles,
  scoreAt,
  shortName,
  strokeIndexRanked,
  strokesReceived,
} from '../model/round'
import { goBack, navigate } from '../nav'
import { ScoreMark, TeamBadge, formatToPar, sideLabel } from './common'
import Scorecard from './Scorecard'

const LONG_PRESS_MS = 500
const HOLE_KEY = 'tc26.playHole.v1'

interface Props {
  roundId: string
  flight: number | null
}

/**
 * Zápis skóre po jamkách - stavěno na hraní jednou rukou (vzor Golfgames):
 * velká tlačítka −/+, klepnutí na číslo vloží par, přidržení zápis smaže,
 * vlastní tlačítko „Zvedl". Čtyři hráči se musí vejít na displej bez
 * rolování.
 */
export default function PlayScreen({ roundId, flight }: Props) {
  const { state, meta, store } = useData()
  const round = state.rounds.find((r) => r.id === roundId)
  const flightEntry = flight !== null ? round?.flights[flight] : undefined
  const [hole, setHole] = useState<number>(() => readHole(roundId, flight))
  const [showCard, setShowCard] = useState(false)
  const longPress = useRef<{ timer: number | null; fired: boolean }>({
    timer: null,
    fired: false,
  })

  // Při prvním otevření flightu skočit na jamku, kde flight nejspíš je.
  useEffect(() => {
    if (!round || !flightEntry) return
    const stored = readHole(roundId, flight, true)
    setHole(stored ?? flightCurrentHole(round, flightEntry))
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
        {meta.status === 'loading' ? t('app.loading') : t('common.dash')}
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
        <h2 className="section-title">{t('play.chooseFlight')}</h2>
        <ul className="option-list">
          {round.flights.map((entry, index) => (
            <li key={index}>
              <button
                type="button"
                className="option-row"
                onClick={() => navigate({ view: 'play', roundId, flight: index }, true)}
              >
                <span className="option-main">
                  <span className="option-title">
                    {t('round.flight', { number: index + 1 })}
                  </span>
                  <span className="option-meta">
                    {sideLabel(state.players, entry.players)}
                  </span>
                </span>
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
      <header className="app-header">
        <div className="hole-nav">
          <button
            type="button"
            className="nav-arrow"
            onClick={() => (orderIndex <= 0 ? goBack() : goTo(-1))}
            aria-label={orderIndex <= 0 ? t('common.back') : t('play.previousHole')}
          >
            ‹
          </button>
          <div className="hole-center">
            <span
              className={`hole-number par-${par}`}
              aria-label={t('common.hole', { number: hole + 1 })}
            >
              {hole + 1}
            </span>
            <div className="hole-meta">
              <strong>
                {t('common.par')} {par} · SI {si}
              </strong>
              <span className="game-header-summary">
                {skinsResult && (
                  <span
                    className={`game-header-entry${flightSkins > 1 ? ' highlight' : ''}`}
                  >
                    <span>{t('games.individual-skins.name')}</span>
                    <strong>{flightSkins}</strong>
                  </span>
                )}
                {teamSkinsResult && (
                  <span
                    className={`game-header-entry${teamSkins > 1 ? ' highlight' : ''}`}
                  >
                    <span>{t('games.team-skins.name')}</span>
                    <strong>{teamSkins}</strong>
                  </span>
                )}
                <span className="game-header-entry">
                  <span>{t('round.flight', { number: (flight ?? 0) + 1 })}</span>
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="nav-arrow"
            onClick={() => goTo(1)}
            disabled={orderIndex >= count - 1}
            aria-label={t('play.nextHole')}
          >
            ›
          </button>
        </div>
      </header>

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
        {meta.pending > 0 && (
          <p className="hint pending-badge">
            {t('play.pendingWrites', { count: meta.pending })}
          </p>
        )}

        <ul className="player-list">
          {flightEntry.players.map((playerId) => {
            const score = scoreAt(round, playerId, hole)
            const strokes = strokesReceived(round, playerId, hole)
            const played = holesCompleted(round, playerId)
            const toPar = grossTotal(round, playerId) - parForPlayedHoles(round, playerId)
            const points =
              stablefordGame && score !== undefined
                ? stablefordAt(round, playerId, hole, stablefordGame.options)
                : undefined
            const player = state.players.find((p) => p.id === playerId)
            return (
              <li key={playerId} className="player-row">
                <div className="player-info">
                  <span className="player-name">
                    <TeamBadge teamId={player?.teamId} />
                    <span className="player-name-text">
                      {shortName(state.players, playerId)}
                    </span>
                    {strokes > 0 && (
                      <span
                        className="player-mark strokes"
                        title={t('play.strokesReceived', { count: strokes })}
                      >
                        {'•'.repeat(strokes)}
                      </span>
                    )}
                    {!hasHandicap(round, playerId) && (
                      <span className="player-mark">?</span>
                    )}
                    {points !== undefined && (
                      <span className="player-mark gain">{points}</span>
                    )}
                  </span>
                  <span className="player-total">
                    {played === 0
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
                  aria-label={`${t('play.pickedUp')}: ${shortName(state.players, playerId)}`}
                >
                  ×
                </button>
                <div className="stepper">
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => adjust(playerId, -1)}
                    disabled={!entryEnabled}
                    aria-label={t('play.minus', {
                      name: shortName(state.players, playerId),
                    })}
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
                    aria-label={t('play.score', {
                      name: shortName(state.players, playerId),
                    })}
                  >
                    <ScoreMark score={score} par={par} large />
                  </button>
                  <button
                    type="button"
                    className="step-button"
                    onClick={() => adjust(playerId, 1)}
                    disabled={!entryEnabled}
                    aria-label={t('play.plus', {
                      name: shortName(state.players, playerId),
                    })}
                  >
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="hint">{t('play.clearHint')}</p>
      </main>

      <footer className="app-footer">
        <div className="footer-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate({ view: 'play', roundId, flight: null }, true)}
          >
            {t('play.switchFlight')}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowCard(true)}
          >
            {t('play.showScorecard')}
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
            <div className="sheet-header">
              <h2>{t('round.scorecard')}</h2>
            </div>
            <Scorecard
              round={round}
              players={state.players}
              skins={skinsResult}
              currentHole={hole}
              flightIndex={flight ?? undefined}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowCard(false)}
            >
              {t('common.close')}
            </button>
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
  children: React.ReactNode
}) {
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
            <h1>{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}

function readHole(roundId: string, flight: number | null, strict = false): number {
  try {
    const raw = localStorage.getItem(`${HOLE_KEY}:${roundId}:${flight}`)
    const value = raw === null ? NaN : Number.parseInt(raw, 10)
    if (!Number.isNaN(value)) return value
  } catch {
    /* ignore */
  }
  return strict ? (undefined as unknown as number) : 0
}
