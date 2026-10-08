import { useState } from 'react'
import type { EvaluationResult } from '../evaluations'
import { bonusAwardsAt, bonusTotal } from '../evaluations/bonuses'
import { skinsAtStake } from '../evaluations/skins'
import { stablefordAt } from '../evaluations/stableford'
import { t } from '../i18n'
import type { BonusConfig } from '../model/types'
import { shortName, teamOf } from '../model/round'
import type { Flight, Player, PlayerId, TeamId, TournamentRound } from '../model/types'
import { sideLabel, teamName } from './common'

interface Props {
  round: TournamentRound
  results: EvaluationResult[]
  players: Player[]
  teams?: Record<TeamId, { name: string }>
  flight: Flight
  hole: number
  bonusConfig: BonusConfig
}

interface Line {
  key: string
  name: string
  /** Co hra rozhodla na téhle jamce. */
  onHole: string
  /** Průběžný stav hry. */
  total: string
}

/**
 * Záhlaví jamky v zápisu: u každé hry kola, co na téhle jamce spočítala
 * a jaký je průběžný stav. Jen text z evaluací - žádný vlastní výpočet,
 * aby zápis ukazoval totéž co výsledky kola.
 */
export default function HoleStatus({
  round,
  results,
  players,
  teams,
  flight,
  hole,
  bonusConfig,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const name = (id: PlayerId) => shortName(players, id)
  const inFlight = new Set(flight.players)
  const lines: Line[] = []

  for (const result of results) {
    const kind = result.game.kind
    if (kind === 'best-aggregate') continue
    const label = result.game.name ?? t(`games.${kind}.name`)
    const outcome = result.holes.find((h) => h.hole === hole)
    if (kind === 'individual-stableford') {
      lines.push({
        key: result.game.id,
        name: label,
        onHole: flight.players
          .map((id) => {
            const points = stablefordAt(round, id, hole, result.game.options)
            return `${name(id)} ${points === undefined ? t('common.dash') : points}`
          })
          .join(' · '),
        total: leaders(result, name),
      })
    } else if (kind === 'individual-skins') {
      const flightOutcome = result.holes.find(
        (h) => h.hole === hole && (h.winners.some((id) => inFlight.has(id)) || h.decided),
      )
      lines.push({
        key: result.game.id,
        name: label,
        onHole: skinOutcome(
          flightOutcome ?? outcome,
          (id) => name(id),
          skinsAtStake(result, hole),
        ),
        total:
          result.rows
            .filter((row) => inFlight.has(row.id) && row.value > 0)
            .map((row) => `${name(row.id)} ${row.value}`)
            .join(' · ') || t('play.status.noSkins'),
      })
    } else if (kind === 'team-skins') {
      lines.push({
        key: result.game.id,
        name: label,
        onHole: skinOutcome(
          outcome,
          (id) => {
            const team = teamOf(players, id)
            return team ? teamName(team, teams) : name(id)
          },
          skinsAtStake(result, hole),
        ),
        total: `${teamName('A', teams)} ${result.teamPoints.A} : ${result.teamPoints.B} ${teamName('B', teams)}`,
      })
    } else if (result.duels) {
      const duels = result.duels.filter((duel) =>
        duel.sides.some((side) => side.players.some((id) => inFlight.has(id))),
      )
      lines.push({
        key: result.game.id,
        name: label,
        onHole: (duels.length > 0 ? duels : result.duels)
          .map((duel) => {
            const winner = duel.holeWinners?.[String(hole)]
            if (winner === undefined)
              return duel.finished ? t('play.status.decided') : t('play.status.pending')
            if (winner === null) return t('play.status.halved')
            const side = duel.sides[winner]
            return t('play.status.holeTo', {
              name: side ? sideLabel(players, side.players) : t('common.dash'),
            })
          })
          .join(' · '),
        total: (duels.length > 0 ? duels : result.duels)
          .map((duel) => {
            const lead = duel.leader === null ? null : duel.sides[duel.leader]
            return `${lead ? sideLabel(players, lead.players) : t('play.status.allSquare')} ${duel.notation}`
          })
          .join(' · '),
      })
    }
  }

  const awards = flight.players.flatMap((id) =>
    bonusAwardsAt(round, bonusConfig, id, hole)
      .filter((award) => !award.void)
      .map(
        (award) =>
          `${name(id)} ${award.bonus.mark}${award.points > 0 ? `+${award.points}` : ''}`,
      ),
  )
  const bonusTotals = flight.players
    .map((id) => ({ id, total: bonusTotal(round, bonusConfig, id) }))
    .filter((entry) => entry.total > 0)
  if (awards.length > 0 || bonusTotals.length > 0) {
    lines.push({
      key: 'bonuses',
      name: t('bonus.title'),
      onHole: awards.join(' · ') || t('common.dash'),
      total: bonusTotals.map((entry) => `${name(entry.id)} ${entry.total}`).join(' · '),
    })
  }

  if (lines.length === 0) return null
  return (
    // Sbalený je to řádek na hru (ať se čtyři hráči vejdou na malý displej),
    // klepnutím se texty rozbalí celé.
    <dl
      className={`hole-status${expanded ? ' expanded' : ''}`}
      aria-label={t('play.status.title')}
      onClick={() => setExpanded((value) => !value)}
    >
      {lines.map((line) => (
        <div key={line.key} className="hole-status-row">
          <dt>{line.name}</dt>
          <dd>
            <span className="hole-status-hole">{line.onHole || t('common.dash')}</span>
            <span className="hole-status-sep" aria-hidden="true">
              ·
            </span>
            <span className="hole-status-total">{line.total || t('common.dash')}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function leaders(result: EvaluationResult, name: (id: PlayerId) => string): string {
  const top = result.rows.filter((row) => row.holes > 0).slice(0, 3)
  if (top.length === 0) return t('play.status.pending')
  return top.map((row) => `${row.position}. ${name(row.id)} ${row.value}`).join(' · ')
}

function skinOutcome(
  outcome:
    { decided: boolean; winners: PlayerId[]; value?: number; carry?: number } | undefined,
  name: (id: PlayerId) => string,
  atStake: number,
): string {
  if (!outcome || !outcome.decided) return t('play.status.atStake', { count: atStake })
  if (outcome.winners.length > 0)
    return t('play.status.skinTo', {
      name: outcome.winners.map(name).join(', '),
      count: outcome.value ?? 1,
    })
  return t('play.status.carry', { count: outcome.carry ?? 0 })
}
