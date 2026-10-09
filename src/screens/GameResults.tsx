import type { Player, TeamId, TournamentRound } from '../model/types'
import type { DuelResult, EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import { hasSides } from '../evaluations'
import {
  Pill,
  Section,
  Standings,
  TeamBadge,
  gameDescription,
  gameTitle,
  sideLabel,
  teamName,
} from './common'

interface Props {
  round: TournamentRound
  players: Player[]
  result: EvaluationResult
  teams?: Record<TeamId, { name: string }>
}

/** Výsledky jedné hry kola - tabulka podle druhu hry, ve stylu seznamů s děliči. */
export default function GameResults({ round, players, result, teams }: Props) {
  const { game } = result
  const format = game.options.format ?? 'strokes-net'
  const isDuel = game.kind === 'position-duel' || hasSides(game.kind)
  const note =
    isDuel && game.kind !== 'best-aggregate' && game.kind !== 'four-ball-skins'
      ? t(`format.${format}`)
      : gameDescription(game)
  const pendingNote =
    result.pending > 0 ? t('round.pendingHoles', { count: result.pending }) : undefined

  return (
    <Section
      title={gameTitle(game)}
      note={pendingNote ? `${note} · ${pendingNote}` : note}
      accent={game.kind === 'team-skins' ? 'fairway' : isDuel ? 'navy' : 'gold'}
      right={game.countsForTeam ? t('common.team') : undefined}
    >
      {game.kind === 'individual-stableford' && (
        <Standings
          rows={result.rows}
          players={players}
          value={(row) => String(row.value)}
          meta={(row) =>
            row.holes > 0
              ? `${t('common.holes', { count: row.holes })} · ${t('common.strokes', { count: row.secondary ?? 0 })}`
              : undefined
          }
        />
      )}

      {game.kind === 'individual-skins' && (
        <Standings
          rows={result.rows}
          players={players}
          value={(row) => String(row.value)}
          meta={(row) => {
            const flight = round.flights.findIndex((f) => f.players.includes(row.id))
            return flight >= 0 ? t('round.flight', { number: flight + 1 }) : undefined
          }}
        />
      )}

      {game.kind === 'team-skins' && (
        <>
          <div className="score-hero" style={{ paddingTop: 4 }}>
            <span className="score-side">
              <Pill teamId="A" size="md">
                {result.rows.find((r) => r.id === 'A')?.value ?? 0}
              </Pill>
              <span className="score-name">{teamName('A', teams)}</span>
            </span>
            <span className="score-side">
              <Pill teamId="B" size="md">
                {result.rows.find((r) => r.id === 'B')?.value ?? 0}
              </Pill>
              <span className="score-name">{teamName('B', teams)}</span>
            </span>
          </div>
          <p className="hint center px">
            {t('round.carry', { count: result.carry ?? 0 })}
            {' · '}
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

      {isDuel && (
        <ul className="list" style={{ listStyle: 'none', margin: 0 }}>
          {(result.duels ?? []).map((duel) => (
            <DuelRow key={duel.id} duel={duel} players={players} format={format} />
          ))}
        </ul>
      )}
    </Section>
  )
}

/**
 * Řádek jednoho zápasu (duel pozic, Four-ball, Best + Součet): strany,
 * stav v notaci a kolik jamek je odehráno. Sdílí ho výsledky hry
 * a karta „Právě se hraje“ na přehledu.
 */
export function DuelRow({
  duel,
  players,
  format,
}: {
  duel: DuelResult
  players: Player[]
  format: string
}) {
  const [left, right] = duel.sides
  if (!left || !right) return null
  const started = duel.sides.some((s) => s.holes > 0)
  const leaderTeam =
    duel.leader === null ? null : (duel.sides[duel.leader]?.teamId ?? null)
  const valueOf = (value: number, holes: number) =>
    holes === 0 || format === 'match-play' ? '' : String(value)
  const meta = [
    duel.position !== undefined ? `${t('overview.positionShort')} ${duel.position}` : '',
    duel.finished
      ? t('status.finished')
      : started
        ? t('common.holes', { count: left.holes })
        : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="duel">
      <span className={`duel-side${duel.finished && duel.leader === 1 ? ' dim' : ''}`}>
        <span className="nm">
          <TeamBadge teamId={left.teamId} />
          <span>{sideLabel(players, left.players)}</span>
        </span>
        <span className="sub">{valueOf(left.value, left.holes)}</span>
      </span>
      <span className="duel-center">
        {started ? (
          leaderTeam ? (
            <Pill teamId={leaderTeam}>{duel.notation}</Pill>
          ) : (
            <span className="v">{duel.notation}</span>
          )
        ) : (
          <span className="v">–</span>
        )}
        <div className="m">{meta}</div>
      </span>
      <span
        className={`duel-side right${duel.finished && duel.leader === 0 ? ' dim' : ''}`}
      >
        <span className="nm">
          <span>{sideLabel(players, right.players)}</span>
          <TeamBadge teamId={right.teamId} />
        </span>
        <span className="sub">{valueOf(right.value, right.holes)}</span>
      </span>
    </li>
  )
}
