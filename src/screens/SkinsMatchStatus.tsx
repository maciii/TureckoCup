import { useData } from '../data'
import type { EvaluationResult } from '../evaluations'
import { matchOfFlight } from '../evaluations/fourBallSkins'
import { t } from '../i18n'
import { doublesAt, sideDoubled } from '../model/round'
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
  // Jen data tohoto zápasu (`result.holes` míchá oba zápasy kola).
  const inPlay = duel.stakes?.[key] !== undefined
  const waitingFor = duel.waitingHole
  // Jamka mimo rozsah hry: karta nemá co říct.
  if (!inPlay && waitingFor === undefined) return null
  const winner = duel.holeWinners?.[key]
  const stake = duel.stakes?.[key] ?? 0
  const allowed = inPlay ? (duel.mayDouble?.[key] ?? []) : []
  const counted = duel.doubles?.[key] ?? []
  const label = (index: number) => sideLabel(players, duel.sides[index]!.players)

  function toggle(index: 0 | 1) {
    const side = duel!.sides[index]!
    // Double může nést kterýkoli partner (dva telefony); vypnutí smaže všechny.
    const holders = side.players.filter((id) =>
      doublesAt(round, id, hole).includes(result.game.id),
    )
    const targets = holders.length > 0 ? holders : [side.players[0]!]
    for (const playerId of targets) {
      store.dispatch({
        kind: 'setDouble',
        roundId: round.id,
        playerId,
        hole,
        gameId: result.game.id,
        on: holders.length === 0,
      })
    }
  }

  let status: string
  if (!inPlay) status = t('skins.match.waiting', { number: (waitingFor ?? 0) + 1 })
  else if (winner === undefined) status = t('skins.match.atStake', { count: stake })
  else if (winner === null)
    status = t('skins.match.carried', { count: duel.holeCarry?.[key] ?? 0 })
  else
    status = t('skins.match.won', {
      name: label(winner),
      count: duel.holeSkins?.[key] ?? stake,
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
        {counted.map((index) => (
          <span key={index} className="chip win">
            {t('skins.match.doubled', { name: label(index) })}
          </span>
        ))}
      </p>
      {duel.sides.map((side, index) => {
        const doubled = sideDoubled(round, result.game.id, side.players, hole)
        const may = allowed.includes(index as 0 | 1)
        const ignored = doubled && inPlay && !may
        const birdie = duel.birdies?.[key]?.[index] ?? 0
        return (
          <div key={side.id} className={`pair-card${winner === index ? ' lead' : ''}`}>
            <span className="pair-name">
              <TeamBadge teamId={side.teamId} />
              <span>{sideLabel(players, side.players)}</span>
            </span>
            {birdie > 0 && (
              <span className="chip win">
                {t('skins.match.birdie', { count: birdie })}
              </span>
            )}
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
