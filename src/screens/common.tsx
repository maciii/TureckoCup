import type { ReactNode } from 'react'
import type {
  GameConfig,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from '../model/types'
import { PICKED_UP } from '../model/types'
import { playerById, shortName } from '../model/round'
import type { StandingRow } from '../evaluations'
import { dynamicKey, t } from '../i18n'

/** Kategorie výsledku na jamce - barva i tvar značky, stejně jako v Golfgames. */
export type ScoreCategory = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'triple'

export function scoreCategory(score: number, par: number): ScoreCategory {
  const diff = score - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  if (diff === 2) return 'double'
  return 'triple'
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
  'eagle',
  'birdie',
  'par',
  'bogey',
  'double',
  'triple',
]

export function ScoreMark({
  score,
  par,
  large = false,
}: {
  score: number | undefined
  par: number
  large?: boolean
}) {
  const category =
    score === undefined
      ? 'empty'
      : score === PICKED_UP
        ? 'triple'
        : scoreCategory(score, par)
  const text =
    score === undefined ? t('common.dash') : score === PICKED_UP ? '×' : String(score)
  return <span className={`mark ${category}${large ? ' large' : ''}`}>{text}</span>
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E'
  return toPar > 0 ? `+${toPar}` : `${toPar}`
}

export function TeamBadge({ teamId }: { teamId: TeamId | undefined }) {
  if (!teamId) return null
  return <span className={`team-badge team-${teamId.toLowerCase()}`}>{teamId}</span>
}

export function gameTitle(game: GameConfig): string {
  return game.name ?? t(dynamicKey('games', game.kind, 'name'))
}

export function gameDescription(game: GameConfig): string {
  return t(dynamicKey('games', game.kind, 'description'))
}

export function teamName(
  teamId: TeamId,
  teams?: Record<TeamId, { name: string }>,
): string {
  return teams?.[teamId]?.name ?? t(dynamicKey('team', teamId))
}

export function sideLabel(players: Player[], ids: PlayerId[]): string {
  return ids.map((id) => shortName(players, id)).join(' + ')
}

export function playerLabel(players: Player[], id: PlayerId): string {
  return playerById(players, id)?.name ?? id
}

/** Výsledková tabulka s pozicemi, lídr má zelený rámeček. */
export function Standings({
  rows,
  players,
  value,
  secondary,
  detail,
}: {
  rows: StandingRow[]
  players: Player[]
  value: (row: StandingRow) => string
  secondary?: (row: StandingRow) => string | undefined
  detail?: (row: StandingRow) => string | undefined
}) {
  if (rows.length === 0) return null
  const showPositions = rows.length > 1
  return (
    <ol className="standings">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`standing${row.position === 1 && row.holes > 0 ? ' leader' : ''}`}
        >
          {showPositions && (
            <span className="position">{row.holes > 0 ? row.position : '·'}</span>
          )}
          <span className="standing-name">
            <span className="standing-name-row">
              <TeamBadge teamId={row.teamId} />
              <span>
                {row.players.length === 1
                  ? playerLabel(players, row.players[0]!)
                  : sideLabel(players, row.players)}
              </span>
            </span>
            {detail?.(row) && <span className="standing-detail">{detail(row)}</span>}
          </span>
          <span className="standing-score">
            <strong>{value(row)}</strong>
            {secondary?.(row) && (
              <span className="standing-secondary">{secondary(row)}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-title-row">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Switch({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span>{label}</span>
      <span className="switch-track" aria-hidden="true" />
    </button>
  )
}

export function roundTitle(round: TournamentRound): string {
  return `${t('round.title', { number: round.number })} · ${round.course.name}`
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

export function BrandMark() {
  return (
    <span className="brand-mark">
      <svg width="24" height="24" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <ellipse cx="32" cy="46" rx="18" ry="7" fill="currentColor" opacity="0.35" />
        <rect x="30" y="14" width="3" height="32" rx="1.5" fill="currentColor" />
        <path d="M33 14 L52 21 L33 28 Z" fill="#f2c14e" />
      </svg>
      <span>
        Turecko <em>Cup</em> 26
      </span>
    </span>
  )
}
