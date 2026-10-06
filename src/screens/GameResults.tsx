import type { Player, TournamentRound } from '../model/types'
import type { DuelResult, EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import { Standings, TeamBadge, gameDescription, gameTitle, sideLabel } from './common'

interface Props {
  round: TournamentRound
  players: Player[]
  result: EvaluationResult
  teams?: Record<'A' | 'B', { name: string }>
}

/** Výsledky jedné hry kola - tabulka podle druhu hry. */
export default function GameResults({ round, players, result, teams }: Props) {
  const { game } = result
  const format = game.options.format ?? 'strokes-net'

  function Duel({ duel }: { duel: DuelResult }) {
    const [left, right] = duel.sides
    if (!left || !right) return null
    const valueOf = (value: number, holes: number) =>
      holes === 0
        ? t('common.dash')
        : format === 'match-play'
          ? String(value)
          : String(value)
    return (
      <li className="duel">
        <span className={`duel-side${duel.leader === 0 ? ' winning' : ''}`}>
          <span className="duel-name">
            <TeamBadge teamId={left.teamId} /> {sideLabel(players, left.players)}
          </span>
          <span className="duel-value">{valueOf(left.value, left.holes)}</span>
        </span>
        <span className="duel-state">
          {duel.position !== undefined ? `${duel.position} · ` : ''}
          {duel.sides.every((s) => s.holes === 0) ? t('common.dash') : duel.notation}
          {duel.finished ? ' ✓' : ''}
        </span>
        <span className={`duel-side right${duel.leader === 1 ? ' winning' : ''}`}>
          <span className="duel-name">
            {sideLabel(players, right.players)} <TeamBadge teamId={right.teamId} />
          </span>
          <span className="duel-value">{valueOf(right.value, right.holes)}</span>
        </span>
      </li>
    )
  }

  return (
    <section className="card section">
      <div className="section-title-row">
        <h2 className="section-title">{gameTitle(game)}</h2>
        <span className="hint">
          {game.countsForTeam ? `${t('common.team')} · ` : ''}
          {game.kind === 'position-duel' || game.kind === 'team-match'
            ? t(`format.${format}` as 'format.strokes-net')
            : gameDescription(game)}
        </span>
      </div>

      {game.kind === 'individual-stableford' && (
        <Standings
          rows={result.rows}
          players={players}
          value={(row) => String(row.value)}
          secondary={(row) =>
            row.holes > 0 ? t('common.holes', { count: row.holes }) : undefined
          }
          detail={(row) =>
            row.secondary && row.secondary > 0
              ? t('common.strokes', { count: row.secondary })
              : undefined
          }
        />
      )}

      {game.kind === 'individual-skins' && (
        <Standings
          rows={result.rows}
          players={players}
          value={(row) => String(row.value)}
          detail={(row) => {
            const flight = round.flights.findIndex((f) => f.players.includes(row.id))
            return flight >= 0 ? t('round.flight', { number: flight + 1 }) : undefined
          }}
        />
      )}

      {game.kind === 'team-skins' && (
        <>
          <div className="team-score">
            <span className="team-score-side team-a">
              <span className="team-score-name">{teams?.A.name ?? 'A'}</span>
              <span className="team-score-value">
                {result.rows.find((r) => r.id === 'A')?.value ?? 0}
              </span>
            </span>
            <span className="team-score-vs">
              {t('round.carry', { count: result.carry ?? 0 })}
            </span>
            <span className="team-score-side team-b">
              <span className="team-score-name">{teams?.B.name ?? 'B'}</span>
              <span className="team-score-value">
                {result.rows.find((r) => r.id === 'B')?.value ?? 0}
              </span>
            </span>
          </div>
          <p className="hint">
            {result.holes
              .filter((h) => h.decided && h.winners.length > 0)
              .map((h) => {
                const team = players.find((p) => p.id === h.winners[0])?.teamId ?? '?'
                return `${h.hole + 1}: ${team}${(h.value ?? 1) > 1 ? ` ×${h.value}` : ''}`
              })
              .join(' · ') || t('common.dash')}
          </p>
        </>
      )}

      {(game.kind === 'position-duel' || game.kind === 'team-match') && (
        <ul className="standings">
          {(result.duels ?? []).map((duel) => (
            <Duel key={duel.id} duel={duel} />
          ))}
        </ul>
      )}

      {result.pending > 0 && (
        <p className="hint">{t('round.pendingHoles', { count: result.pending })}</p>
      )}
    </section>
  )
}
