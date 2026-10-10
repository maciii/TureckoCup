import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { demoVariant, useData } from '../data'
import { evaluateRound, hasSides } from '../evaluations'
import { matchOfFlight } from '../evaluations/fourBallSkins'
import { DuelRow } from './GameResults'
import type { EvaluationResult } from '../evaluations'
import { stablefordAt } from '../evaluations/stableford'
import { t } from '../i18n'
import { MAX_STROKES, PICKED_UP } from '../model/types'
import type { PlayerId, TournamentRound } from '../model/types'
import { isValidTime } from '../model/schedule'
import { pickupRuleOf } from '../model/pickup'
import HoleStatus from './HoleStatus'
import PairStatus from './PairStatus'
import SkinsMatchStatus from './SkinsMatchStatus'
import type { BonusDefinition } from '../model/bonuses'
import {
  availableBonuses,
  bonusConfigOf,
  bonusesAt,
  holdersOf,
  toggleBonus as toggleBonusList,
} from '../model/bonuses'
import { bonusAwardsAt } from '../evaluations/bonuses'
import BonusSheet from './BonusSheet'
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
  playOrder,
} from '../model/round'
import { goBack, navigate } from '../nav'
import {
  Header,
  Pill,
  ScoreMark,
  TeamBadge,
  flightProgressLabel,
  formatToPar,
  gameTitle,
  sideLabel,
} from './common'
import Scorecard from './Scorecard'

const LONG_PRESS_MS = 500
// Testovací verze si pamatuje jamky zvlášť, jinak by otevřela jamku z ostrého kola.
const HOLE_KEY =
  demoVariant() === 'preview' ? 'tc26.preview.playHole.v1' : 'tc26.playHole.v1'

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
  const [otherFlight, setOtherFlight] = useState<number | null>(null)
  const [bonusFor, setBonusFor] = useState<PlayerId | null>(null)
  const longPress = useRef<{ timer: number | null; fired: boolean }>({
    timer: null,
    fired: false,
  })

  // Při otevření flightu skočit na jamku, kde flight nejspíš je.
  // Při přímém otevření adresy data ještě nejsou načtená - skok proběhne, až dorazí.
  const loaded = Boolean(round && flightEntry)
  useEffect(() => {
    if (!round || !flightEntry) return
    setHole(readHole(roundId, flight) ?? flightCurrentHole(round, flightEntry))
    // Jen při změně flightu/kola (a načtení dat), ne při každém zápisu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, flight, loaded])

  const pickup = pickupRuleOf(state.tournament?.pickup)
  const bonusConfig = bonusConfigOf(state.tournament?.bonuses)
  const results = useMemo(
    () => (round ? evaluateRound(round, state.players, pickup, bonusConfig) : []),
    [round, state.players, pickup.timesPar, pickup.plus, pickup.addStrokes, bonusConfig],
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
        {!canWrite && <SignInNotice />}
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
                    {isValidTime(entry.teeTime) && ` · ${entry.teeTime}`}
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
  const bonusChoices = availableBonuses(bonusConfig, round, hole)
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

  /**
   * Přepnutí bonusu. Longest a Nearest drží jen jeden hráč: dřívějšímu
   * držiteli se bonus odebere vlastním zápisem (rules pustí jen jednu buňku).
   */
  function toggleBonus(playerId: PlayerId, bonus: BonusDefinition) {
    if (!entryEnabled || !round) return
    const current = bonusesAt(round, playerId, hole)
    const adding = !current.includes(bonus.id)
    if (adding && bonus.exclusive) {
      for (const holder of holdersOf(round, hole, bonus.id)) {
        if (holder === playerId) continue
        store.dispatch({
          kind: 'setBonuses',
          roundId,
          playerId: holder,
          hole,
          value: bonusesAt(round, holder, hole).filter((id) => id !== bonus.id),
        })
      }
    }
    store.dispatch({
      kind: 'setBonuses',
      roundId,
      playerId,
      hole,
      value: toggleBonusList(current, bonus.id),
    })
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
    if (next === undefined) return
    setHole(next)
    // Ukládá se jen jamka, na kterou zapisovatel sám přešel; automatický skok
    // na aktuální jamku by se jinak uložil dřív, než dorazí data.
    saveHole(roundId, flight, next)
  }

  // Ostatní flighty: jen náhled stavu, zápis zůstává u vlastního flightu.
  const others = round.flights
    .map((entry, index) => ({ entry, index }))
    .filter(({ index, entry }) => index !== flight && entry.players.length > 0)

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
        {!canWrite && <SignInNotice />}
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
        {/* Skiny ve hře říká panel stavu her; tady zbývají čekající zápisy. */}
        {meta.pending > 0 && (
          <div className="stakes">
            <span className="tag gold">
              {t('play.pendingWrites', { count: meta.pending })}
            </span>
          </div>
        )}
        {/* Druhý flight: kde je a jak stojí jeho zápasy (hry dvojic) - výrazně,
            ať hráči vidí stav druhého zápasu bez přepínání. */}
        {others.map(({ entry, index }) => {
          const matches = results
            .filter((r) => hasSides(r.game.kind))
            .map((r) => ({ result: r, duel: matchOfFlight(r, entry.players) }))
            .filter((m) => m.duel && m.duel.sides.length === 2)
          return (
            <section
              key={index}
              className="other-flight-card"
              aria-label={t('round.flight', { number: index + 1 })}
            >
              <button
                type="button"
                className="other-flight-head"
                onClick={() => setOtherFlight(index)}
              >
                {t('round.flight', { number: index + 1 })} ·{' '}
                {flightProgressLabel(round, entry)}
                <span className="chev">›</span>
              </button>
              {matches.map(({ result, duel }) => (
                <ul key={result.game.id} className="list other-flight-match">
                  {matches.length > 1 && (
                    <li className="other-flight-game">{gameTitle(result.game)}</li>
                  )}
                  <DuelRow
                    duel={duel!}
                    players={state.players}
                    format={result.game.options.format ?? 'strokes-net'}
                  />
                </ul>
              ))}
            </section>
          )
        })}

        <HoleStatus
          round={round}
          results={results}
          players={state.players}
          teams={state.tournament?.teams}
          flight={flightEntry}
          hole={hole}
          bonusConfig={bonusConfig}
        />

        {results
          .filter((r) => r.game.kind === 'best-aggregate')
          .map((r) => (
            <PairStatus
              key={r.game.id}
              result={r}
              players={state.players}
              flight={flightEntry}
              hole={hole}
            />
          ))}
        {results
          .filter((r) => r.game.kind === 'four-ball-skins')
          .map((r) => (
            <SkinsMatchStatus
              key={r.game.id}
              round={round}
              result={r}
              players={state.players}
              flight={flightEntry}
              hole={hole}
              canWrite={entryEnabled}
            />
          ))}

        <ul className="player-list">
          {playOrder(round, flightEntry, state.players).map((playerId) => {
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
            const awards = bonusAwardsAt(round, bonusConfig, playerId, hole)
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
                  </span>
                  {/* Druhý řádek je u zapisovatele tlačítko s hvězdičkou (extra body
                      jako v Golfgames); záporné okraje drží výšku řádku, aby se čtyři
                      hráči vešli na displej. */}
                  {(() => {
                    const totalLine = (
                      <>
                        {completed === 0 && holesPlayed(round, playerId) === 0
                          ? t('play.noScore')
                          : t('play.total', {
                              strokes: grossTotal(round, playerId),
                              toPar: formatToPar(toPar),
                            })}
                        {/* Body jamky pod jménem, ne vedle: na úzkém displeji by jméno ořízly. */}
                        {points !== undefined && (
                          <span className="player-mark gain">
                            {t('play.pointsShort', { count: points })}
                          </span>
                        )}
                        {awards.length > 0 && (
                          <span
                            className="bonus-marks"
                            aria-label={t('play.bonusesFor', { name })}
                          >
                            {awards.map((award) => (
                              <span
                                key={award.bonus.id}
                                className={
                                  award.void
                                    ? 'void'
                                    : award.pending
                                      ? 'pending'
                                      : undefined
                                }
                                title={award.void ? t('play.bonusesVoid') : undefined}
                              >
                                {award.bonus.mark}
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    )
                    return bonusChoices.length > 0 && entryEnabled ? (
                      <button
                        type="button"
                        className={`player-total bonus-row${awards.length > 0 ? ' active' : ''}`}
                        onClick={() => setBonusFor(playerId)}
                        aria-label={t('play.bonusesFor', { name })}
                      >
                        <span className="bonus-star" aria-hidden="true">
                          ★
                        </span>
                        {totalLine}
                      </button>
                    ) : (
                      <span className="player-total">{totalLine}</span>
                    )
                  })()}
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
        <p className="hint center px play-help" style={{ paddingTop: 10 }}>
          {t('play.clearHint', { par })}
        </p>
      </main>

      <footer className="app-footer">
        <div className="footer-row">
          <button type="button" className="btn sm" onClick={() => setShowCard(true)}>
            {t('play.showScorecard')}
          </button>
          {canGoNext ? (
            <button
              type="button"
              className={`btn sm${holeComplete ? ' primary' : ''}`}
              onClick={() => goTo(1)}
            >
              {t('play.nextHole')} ›
            </button>
          ) : (
            // Poslední jamka flightu: místo neaktivní šipky rovnou na vyhodnocení kola.
            <button
              type="button"
              className={`btn sm${holeComplete ? ' primary' : ''}`}
              onClick={() => navigate({ view: 'round', roundId })}
            >
              {t('play.finish')} ›
            </button>
          )}
        </div>
      </footer>

      {bonusFor !== null && (
        <BonusSheet
          round={round}
          config={bonusConfig}
          playerIds={playOrder(round, flightEntry, state.players)}
          playerId={bonusFor}
          onSelect={setBonusFor}
          hole={hole}
          onToggle={(bonus) => toggleBonus(bonusFor, bonus)}
          onClose={() => setBonusFor(null)}
        />
      )}

      {otherFlight !== null && round.flights[otherFlight] && (
        <OtherFlightSheet
          round={round}
          flightIndex={otherFlight}
          ownFlight={flight ?? 0}
          results={results}
          onClose={() => setOtherFlight(null)}
        />
      )}

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

/**
 * Náhled na jiný flight: kde je, jak si hráči vedou (rány proti paru,
 * Stableford) a stav Team Skins. Zavření vrací zpět na vlastní flight
 * i jamku - zápis se nepřepíná, aby nikdo omylem nepsal do cizího flightu.
 */
function OtherFlightSheet({
  round,
  flightIndex,
  ownFlight,
  results,
  onClose,
}: {
  round: TournamentRound
  flightIndex: number
  ownFlight: number
  results: EvaluationResult[]
  onClose: () => void
}) {
  const { state } = useData()
  const flight = round.flights[flightIndex]!
  const stableford = results.find((r) => r.game.kind === 'individual-stableford')
  const teamSkins = results.find((r) => r.game.kind === 'team-skins')
  const rows = [...flight.players].sort((a, b) => {
    const pa = stableford?.rows.find((r) => r.id === a)?.value ?? 0
    const pb = stableford?.rows.find((r) => r.id === b)?.value ?? 0
    return pb - pa
  })
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-label={t('round.flight', { number: flightIndex + 1 })}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow" style={{ marginTop: 4 }}>
          {t('round.flight', { number: flightIndex + 1 })} ·{' '}
          {flightProgressLabel(round, flight)}
          {isValidTime(flight.teeTime) && ` · ${flight.teeTime}`}
        </p>
        <ul className="list other-flight-list">
          {rows.map((id) => {
            const player = state.players.find((p) => p.id === id)
            const completed = holesCompleted(round, id)
            const toPar = grossTotal(round, id) - parForPlayedHoles(round, id)
            const points = stableford?.rows.find((r) => r.id === id)?.value
            return (
              <li key={id} className="row">
                <span className="row-main">
                  <span className="row-title">
                    <TeamBadge teamId={player?.teamId} />
                    <span>{shortName(state.players, id)}</span>
                  </span>
                  <span className="row-meta">
                    {holesPlayed(round, id) === 0
                      ? t('play.noScore')
                      : `${t('common.holes', { count: completed })} · ${formatToPar(toPar)}`}
                  </span>
                </span>
                {stableford && points !== undefined && (
                  <Pill teamId={player?.teamId}>
                    {t('play.pointsShort', { count: points })}
                  </Pill>
                )}
              </li>
            )
          })}
        </ul>
        {teamSkins && (
          <p className="hint center px" style={{ paddingTop: 8 }}>
            {t('games.team-skins.name')}: A{' '}
            {teamSkins.rows.find((r) => r.id === 'A')?.value ?? 0} : B{' '}
            {teamSkins.rows.find((r) => r.id === 'B')?.value ?? 0}
          </p>
        )}
        <div className="px" style={{ paddingTop: 14 }}>
          <button type="button" className="btn primary" onClick={onClose}>
            {t('play.backToFlight', { number: ownFlight + 1 })}
          </button>
        </div>
      </div>
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

function saveHole(roundId: string, flight: number | null, hole: number): void {
  try {
    localStorage.setItem(`${HOLE_KEY}:${roundId}:${flight}`, String(hole))
  } catch {
    /* ignore */
  }
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

/** Výzva k přihlášení přímo v zápisu - nepřihlášený nemusí hledat menu. */
function SignInNotice() {
  const { meta, store } = useData()
  // SDK přihlášení se načte dopředu, aby popup šel otevřít hned z klepnutí.
  useEffect(() => {
    if (!meta.account) store.prepareSignIn()
  }, [meta.account, store])
  return (
    <div className="notice signin">
      <span>{t('play.signInRequired')}</span>
      {!meta.account && (
        <button
          type="button"
          className="btn primary sm"
          disabled={!meta.authReady}
          onClick={() => void store.signIn()}
        >
          {meta.authReady ? t('admin.signIn') : t('admin.signingIn')}
        </button>
      )}
    </div>
  )
}
