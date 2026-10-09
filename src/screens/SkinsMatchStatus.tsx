import { useData } from '../data'
import type { EvaluationResult } from '../evaluations'
import { matchOfFlight } from '../evaluations/fourBallSkins'
import { t } from '../i18n'
import { doubleHolder, sideDoubled } from '../model/round'
import type { Flight, Player, TournamentRound } from '../model/types'
import { TeamBadge, sideLabel } from './common'

interface Props {
  round: TournamentRound
  result: EvaluationResult
  players: Player[]
  flight: Flight
  hole: number
  canWrite: boolean
}

/**
 * Four-ball Skins při zápisu: stav zápasu dvojic flightu, o kolik skinů se
 * na jamce hraje, kdo ji vzal, a tlačítko Double u dvojice, která smí dublovat.
 * Double jde přepnout kdykoli (i zpětně), vyhodnocení se přepočítá.
 */
export default function SkinsMatchStatus({
  round,
  result,
  players,
  flight,
  hole,
  canWrite,
}: Props) {
  const { store } = useData()
  const duel = matchOfFlight(result, flight.players)
  if (!duel || duel.sides.length < 2) return null
  const key = String(hole)
  const outcome = result.holes.find(
    (h) =>
      h.hole === hole &&
      (h.winners.some((id) => flight.players.includes(id)) ||
        duel.sides.some((s) => s.players.some((id) => flight.players.includes(id)))),
  )
  // Výsledek téhle jamky patří zápasu flightu: hledá se podle hráčů stran.
  const inMatch = new Set(duel.sides.flatMap((s) => s.players))
  const holeOutcome =
    result.holes.find(
      (h) =>
        h.hole === hole &&
        (h.winners.length === 0 || h.winners.some((id) => inMatch.has(id))),
    ) ?? outcome
  const winner = duel.holeWinners?.[key]
  const stake = duel.stakes?.[key] ?? 1
  const allowed = duel.mayDouble?.[key] ?? []
  const counted = duel.doubles?.[key]
  const label = (index: number) => sideLabel(players, duel.sides[index]!.players)

  function toggle(index: 0 | 1) {
    const side = duel!.sides[index]!
    const holder = doubleHolder(round, result.game.id, side.players, hole)
    store.dispatch({
      kind: 'setDouble',
      roundId: round.id,
      playerId: holder ?? side.players[0]!,
      hole,
      gameId: result.game.id,
      on: holder === undefined,
    })
  }

  let status: string
  if (winner === undefined) status = t('skins.match.atStake', { count: stake })
  else if (winner === null)
    status = t('skins.match.carried', { count: holeOutcome?.carry ?? 0 })
  else
    status = t('skins.match.won', {
      name: label(winner),
      count: holeOutcome?.value ?? stake,
    })

  return (
    <section
      className="pair-status skins-match"
      aria-label={result.game.name ?? t('games.four-ball-skins.name')}
    >
      <div className="pair-status-head">
        <span className="pair-status-name">
          {result.game.name ?? t('games.four-ball-skins.name')}
        </span>
        <span className="pair-status-score">
          {label(0)} <b>{duel.sides[0]!.value}</b>
          <span className="sep">:</span>
          <b>{duel.sides[1]!.value}</b> {label(1)}
        </span>
      </div>
      <p className="skins-match-hole">
        <span className={`chip${winner !== undefined && winner !== null ? ' win' : ''}`}>
          {status}
        </span>
        {counted !== undefined && (
          <span className="chip win">
            {t('skins.match.doubled', { name: label(counted) })}
          </span>
        )}
      </p>
      {duel.sides.map((side, index) => {
        const doubled = sideDoubled(round, result.game.id, side.players, hole)
        const may = allowed.includes(index as 0 | 1)
        const ignored = doubled && counted !== index
        return (
          <div key={side.id} className={`pair-card${winner === index ? ' lead' : ''}`}>
            <span className="pair-name">
              <TeamBadge teamId={side.teamId} />
              <span>{sideLabel(players, side.players)}</span>
            </span>
            {(may || doubled) && (
              <span className="pair-chips">
                <button
                  type="button"
                  className={`btn sm${doubled ? ' red-soft' : ' ghost'}`}
                  disabled={!canWrite}
                  aria-pressed={doubled}
                  onClick={() => toggle(index as 0 | 1)}
                >
                  {t('skins.match.double')}
                  {doubled ? ' ✓' : ''}
                </button>
                {ignored && (
                  <span className="hint">
                    {t('skins.match.doubleIgnored', {
                      name: sideLabel(players, side.players),
                    })}
                  </span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
