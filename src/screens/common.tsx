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
import { goBack } from '../nav'

/** Kategorie výsledku na jamce - tvar i barva značky podle golfové konvence. */
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
        ? 'picked'
        : scoreCategory(score, par)
  const text =
    score === undefined ? t('common.dash') : score === PICKED_UP ? '×' : String(score)
  return <span className={`mark ${category}${large ? ' large' : ''}`}>{text}</span>
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E'
  return toPar > 0 ? `+${toPar}` : `${toPar}`
}

export function teamClass(teamId: TeamId | undefined | null): string {
  return teamId ? `team-${teamId.toLowerCase()}` : ''
}

export function TeamBadge({ teamId }: { teamId: TeamId | undefined }) {
  if (!teamId) return null
  return <span className={`team-badge ${teamClass(teamId)}`}>{teamId}</span>
}

/** Skóre v barevné pilulce týmu; bez týmu neutrální. */
export function Pill({
  teamId,
  size,
  tone,
  children,
}: {
  teamId?: TeamId | null
  size?: 'md' | 'lg'
  tone?: 'green'
  children: ReactNode
}) {
  return (
    <span
      className={`pill${size ? ` ${size}` : ''} ${teamClass(teamId)}${tone ? ` ${tone}` : ''}`}
    >
      {children}
    </span>
  )
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

export type SectionAccent = 'navy' | 'fairway' | 'gold' | 'red' | 'team-a' | 'team-b'

/** Nadpis sekce s barevným proužkem vlevo (vzor Zavařovák). */
export function Section({
  title,
  note,
  right,
  accent = 'navy',
  children,
}: {
  title: string
  note?: string
  right?: ReactNode
  accent?: SectionAccent
  children: ReactNode
}) {
  return (
    <section>
      <div className={`section-head ${accent}`}>
        <span className="bar" />
        <div className="section-main">
          <div className="section-row">
            <h2>{title}</h2>
            {right && <span className="section-right">{right}</span>}
          </div>
          {note && <p className="section-note">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/** Výsledková tabulka: řádky s děliči, hodnota v pilulce týmu, lídr zeleně. */
export function Standings({
  rows,
  players,
  value,
  meta,
}: {
  rows: StandingRow[]
  players: Player[]
  value: (row: StandingRow) => string
  meta?: (row: StandingRow) => string | undefined
}) {
  if (rows.length === 0) return null
  return (
    <ol className="list" style={{ listStyle: 'none', margin: 0 }}>
      {rows.map((row) => (
        <li
          key={row.id}
          className={`row${row.position === 1 && row.holes > 0 ? ' leader' : ''}`}
        >
          <span className="position">{row.holes > 0 ? row.position : '·'}</span>
          <span className="row-main">
            <span className="row-title">
              <TeamBadge teamId={row.teamId} />
              <span>
                {row.players.length === 1
                  ? playerLabel(players, row.players[0]!)
                  : sideLabel(players, row.players)}
              </span>
            </span>
            {meta?.(row) && <span className="row-meta">{meta(row)}</span>}
          </span>
          <Pill teamId={row.teamId}>{value(row)}</Pill>
        </li>
      ))}
    </ol>
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

/**
 * Datum a čas záznamu (log úprav): den, měsíc, hodiny a minuty. Opravy z rána
 * po kole se tak dají odlišit od zápisu během hry. Neplatná hodnota = `null`.
 */
export function formatDateTime(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FlagMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="flag-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <ellipse className="flag-green" cx="32" cy="46" rx="18" ry="7" />
      <rect className="flag-pole" x="30" y="14" width="3" height="32" rx="1.5" />
      <path className="flag-cloth" d="M33 14 L52 21 L33 28 Z" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

/** Horní lišta se zpět, titulkem a volitelným podtitulkem. */
export function Header({
  title,
  subtitle,
  onBack = goBack,
  left,
  right,
}: {
  title: ReactNode
  subtitle?: string
  onBack?: () => void
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="app-header">
      {left ?? (
        <button
          type="button"
          className="icon-button"
          onClick={onBack}
          aria-label={t('common.back')}
        >
          <BackIcon />
        </button>
      )}
      <div className="header-main">
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {right ?? <span className="header-spacer" />}
    </header>
  )
}

export function StatusChip({ status }: { status: TournamentRound['status'] }) {
  return <span className={`status-chip ${status}`}>{t(`status.${status}`)}</span>
}
