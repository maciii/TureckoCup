import { useState } from 'react'
import { demoVariant } from '../data'
import { STORAGE_PREFIX } from '../data/store'
import { t } from '../i18n'
import { flightIndexOf, shortName } from '../model/round'
import { isValidTime, localToday } from '../model/schedule'
import { flightCompany, flightHasHandicaps } from '../model/strokes'
import type { Player, PlayerId, TournamentRound } from '../model/types'
import { navigate } from '../nav'
import { Crest, formatDay, gameTitle, sideLabel } from './common'
import StrokesSheet from './StrokesSheet'

/**
 * Osobní uvítání přihlášeného hráče: co dnes hraje (kolo, flight, tee time,
 * spoluhráči, hry, jeho zápas), náhled ran na soupeře a cesta do zápisu.
 * Celoobrazovkové uvítání se ukáže jednou denně pro každé kolo; karta na
 * úvodní obrazovce zůstává, dokud kolo neskončí.
 */

const SEEN_KEY = `${STORAGE_PREFIX}welcomeSeen.v1`
// Testovací verze má volbu zvlášť, stejně jako jamku zápisu.
export const SCOPE_KEY =
  demoVariant() === 'preview'
    ? 'tc26.preview.playScope.v1'
    : `${STORAGE_PREFIX}playScope.v1`

export type PlayScope = 'match' | 'flight'

export function readScope(): PlayScope {
  try {
    return localStorage.getItem(SCOPE_KEY) === 'match' ? 'match' : 'flight'
  } catch {
    return 'flight'
  }
}

export function writeScope(scope: PlayScope): void {
  try {
    localStorage.setItem(SCOPE_KEY, scope)
  } catch {
    /* soukromé okno - volba platí jen do zavření */
  }
}

export function welcomeSeen(
  playerId: PlayerId,
  round: TournamentRound,
  today: string,
): boolean {
  try {
    return localStorage.getItem(`${SEEN_KEY}:${playerId}`) === `${round.id}:${today}`
  } catch {
    return false
  }
}

export function markWelcomeSeen(
  playerId: PlayerId,
  round: TournamentRound,
  today: string,
): void {
  try {
    localStorage.setItem(`${SEEN_KEY}:${playerId}`, `${round.id}:${today}`)
  } catch {
    /* bez úložiště se uvítání ukáže znovu, nic horšího */
  }
}

interface Props {
  round: TournamentRound
  players: Player[]
  me: PlayerId
  canWrite: boolean
  /** Ukázat celoobrazovkové uvítání (jednou denně). */
  intro: boolean
  onIntroClose: () => void
}

export default function Welcome({
  round,
  players,
  me,
  canWrite,
  intro,
  onIntroClose,
}: Props) {
  const [strokesOpen, setStrokesOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const flightIndex = flightIndexOf(round, me)
  const flight = round.flights[flightIndex]
  const company = flightCompany(round, players, me)
  const today = localToday()
  const name = shortName(players, me)
  const roundLabel = `${t('round.title', { number: round.number })} · ${round.course.name}`
  const dayLine =
    round.date === today
      ? t('welcome.today', { round: roundLabel })
      : t('welcome.onDay', { day: formatDay(round.date), round: roundLabel })
  const mates = flight ? flight.players.filter((id) => id !== me) : []
  const flightLine = flight
    ? t('welcome.flightLine', {
        number: flightIndex + 1,
        time: isValidTime(flight.teeTime) ? ` · ${flight.teeTime}` : '',
        names: mates.map((id) => shortName(players, id)).join(', '),
      })
    : t('welcome.noFlight')
  const games = round.games.map(gameTitle).join(' · ')
  const matchLine = company.pairs
    ? company.opponents.length > 0
      ? t('welcome.pairMatch', {
          pair: sideLabel(players, [me, ...company.partners]),
          opponents: sideLabel(players, company.opponents),
        })
      : null
    : company.opponents[0]
      ? t('welcome.duel', { name: shortName(players, company.opponents[0]) })
      : null
  const strokesReady = Boolean(flight) && flightHasHandicaps(round, me)
  const canEnter = canWrite && Boolean(flight) && round.status !== 'finished'
  // Volba „jen můj zápas“ má smysl jen u singlů pozic uvnitř flightu.
  const scopeChoice = !company.pairs && company.opponents.length > 0 && mates.length > 1

  function enter(scope?: PlayScope) {
    if (scope) writeScope(scope)
    setScopeOpen(false)
    setStrokesOpen(false)
    if (intro) onIntroClose()
    navigate({
      view: 'play',
      roundId: round.id,
      flight: flightIndex >= 0 ? flightIndex : null,
    })
  }

  function startEnter() {
    if (scopeChoice) setScopeOpen(true)
    else enter()
  }

  const body = (
    <>
      <p className="welcome-day">{dayLine}</p>
      <p className="welcome-line">{flightLine}</p>
      {flight && <p className="welcome-line">{t('welcome.games', { games })}</p>}
      {matchLine && <p className="welcome-match">{matchLine}</p>}
    </>
  )

  const actions = (
    <div className="welcome-actions">
      {strokesReady && (
        <button
          type="button"
          className="btn ghost welcome-strokes-btn"
          onClick={() => setStrokesOpen(true)}
        >
          {t('welcome.strokes')}
        </button>
      )}
      {canEnter && (
        <button
          type="button"
          className="btn primary welcome-enter-btn"
          onClick={startEnter}
        >
          {t('live.enter')}
        </button>
      )}
    </div>
  )

  return (
    <>
      <section className="welcome-card" aria-label={t('welcome.hello', { name })}>
        <h2 className="welcome-hello">{t('welcome.hello', { name })}</h2>
        {body}
        {actions}
      </section>

      {/* Listy (rány, rozsah) jdou nad uvítání - to se na tu chvíli schová. */}
      {intro && !strokesOpen && !scopeOpen && (
        <div
          className="welcome-intro"
          role="dialog"
          aria-label={t('welcome.hello', { name })}
        >
          <Crest className="welcome-crest" />
          <p className="welcome-eyebrow">{t('welcome.eyebrow')}</p>
          <h2 className="welcome-intro-hello">{t('welcome.hello', { name })}</h2>
          <div className="welcome-intro-body">{body}</div>
          {strokesReady && <p className="welcome-intro-hint">{t('welcome.hint')}</p>}
          <div className="welcome-intro-actions">
            {actions}
            <button
              type="button"
              className="btn ghost welcome-intro-close"
              onClick={onIntroClose}
            >
              {t('welcome.close')}
            </button>
          </div>
        </div>
      )}

      {strokesOpen && (
        <StrokesSheet
          round={round}
          players={players}
          me={me}
          onClose={() => setStrokesOpen(false)}
          onEnter={canEnter ? startEnter : undefined}
        />
      )}

      {scopeOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => setScopeOpen(false)}
          role="presentation"
        >
          <div
            className="sheet scope-sheet"
            role="dialog"
            aria-label={t('play.scope.title')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head px">
              <h2>{t('play.scope.title')}</h2>
            </div>
            <ul className="option-list">
              <li>
                <button
                  type="button"
                  className="option-row"
                  onClick={() => enter('match')}
                >
                  <span className="row-main">
                    <span className="row-title">{t('play.scope.match')}</span>
                    <span className="row-meta">{t('play.scope.matchHint')}</span>
                  </span>
                  <span className="chev">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="option-row"
                  onClick={() => enter('flight')}
                >
                  <span className="row-main">
                    <span className="row-title">{t('play.scope.flight')}</span>
                    <span className="row-meta">{t('play.scope.flightHint')}</span>
                  </span>
                  <span className="chev">›</span>
                </button>
              </li>
            </ul>
            <div className="px sheet-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setScopeOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
