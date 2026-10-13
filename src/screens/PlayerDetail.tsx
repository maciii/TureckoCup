import type { EvaluationResult } from '../evaluations'
import { bonusAwardsAt } from '../evaluations/bonuses'
import { stablefordAt } from '../evaluations/stableford'
import { dynamicKey, t } from '../i18n'
import {
  CONCEDED,
  flightOf,
  gameHoles,
  holeOrder,
  netScoreAt,
  parAt,
  playingHandicap,
  scoreAt,
  shortName,
  strokeIndexRanked,
  strokesReceived,
} from '../model/round'
import type { BonusConfig, Player, PlayerId, TournamentRound } from '../model/types'
import DetailSheet from './DetailSheet'
import { ScoreMark, TeamBadge, gameTitle, playerLabel } from './common'

export type PlayerDetailKind = 'stableford' | 'skins' | 'bonus'

/**
 * Rozpis hráče v jedné hře kola po jamkách: rány (s ranami z HCP), co z nich
 * hra udělala (Stablefordovy body, skin s bankem, extra body) a součet.
 * Pořadí jamek je pořadí hraní flightu hráče.
 */
export default function PlayerDetail({
  kind,
  round,
  playerId,
  players,
  result,
  bonusConfig,
  onClose,
}: {
  kind: PlayerDetailKind
  round: TournamentRound
  playerId: PlayerId
  players: Player[]
  /** Výsledek hry (Stableford, Skins); u extra bodů chybí. */
  result?: EvaluationResult
  bonusConfig?: BonusConfig
  onClose: () => void
}) {
  const game = result?.game
  const options = {
    net: game?.options.net ?? false,
    allowance: game?.options.allowance ?? 1,
    doubleHoles: game?.options.doubleHoles,
  }
  const allowed = new Set(game ? gameHoles(round, game) : [])
  const order = holeOrder(round, flightOf(round, playerId)).filter(
    (hole) => !game || allowed.has(hole),
  )
  const si = strokeIndexRanked(round)
  const strokesAt = (hole: number) =>
    options.net ? strokesReceived(round, playerId, hole, options.allowance) : 0
  const player = players.find((p) => p.id === playerId)
  const title =
    kind === 'bonus' ? t('bonus.title') : game ? gameTitle(game) : t('common.dash')

  const subtitle = (
    <p className="detail-player">
      <TeamBadge teamId={player?.teamId} />
      <span>{playerLabel(players, playerId)}</span>
      {options.net && kind !== 'bonus' && (
        <span className="md-side-hcp">
          {t('detail.hcp', {
            value: playingHandicap(round, playerId, options.allowance),
          })}
        </span>
      )}
    </p>
  )

  if (kind === 'bonus') {
    const config = bonusConfig
    const rows = config
      ? order.flatMap((hole) =>
          bonusAwardsAt(round, config, playerId, hole).map((award) => ({ hole, award })),
        )
      : []
    const total = rows.reduce(
      (sum, { award }) => sum + (award.void || award.pending ? 0 : award.points),
      0,
    )
    return (
      <DetailSheet title={title} subtitle={subtitle} onClose={onClose}>
        {rows.length === 0 ? (
          <p className="hint center px">{t('detail.noBonus')}</p>
        ) : (
          <ul className="list px pd-bonus">
            {rows.map(({ hole, award }) => (
              <li
                key={`${hole}-${award.bonus.id}`}
                className={`row${award.void ? ' void' : ''}`}
              >
                <span className="pd-hole">{hole + 1}</span>
                <span className="row-main">
                  <span className="row-title">
                    <span className="pd-mark">{award.bonus.mark}</span>
                    {t(dynamicKey('bonus', award.bonus.id, 'name'))}
                  </span>
                  <span className="row-meta">
                    {t('detail.parScore', {
                      par: parAt(round, hole),
                      score: scoreLabel(scoreAt(round, playerId, hole)),
                    })}
                    {award.pending
                      ? ` · ${t('detail.bonusPending')}`
                      : award.void
                        ? ` · ${award.forfeit ? t('detail.bonusForfeit') : t('detail.bonusVoid')}`
                        : ''}
                  </span>
                </span>
                <span className="pd-points">
                  {award.void || award.pending ? '–' : `+${award.points}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="pd-total px">{t('detail.total', { value: total })}</p>
      </DetailSheet>
    )
  }

  // Skins: výsledek jamky ve skupině hráče (flight, nebo celé kolo).
  const outcomeAt = (hole: number) =>
    result?.holes.find(
      (h) => h.hole === hole && (h.group ? h.group.includes(playerId) : true),
    )
  let totalPoints = 0
  let totalGross = 0
  const rows = order.map((hole) => {
    const score = scoreAt(round, playerId, hole)
    const net = netScoreAt(round, playerId, hole, options)
    if (score !== undefined && score > 0) totalGross += score
    if (kind === 'stableford') {
      const points = stablefordAt(round, playerId, hole, options)
      if (points !== undefined) totalPoints += points
      return {
        hole,
        score,
        net,
        cell: points === undefined ? '' : String(points),
        win: false,
      }
    }
    const outcome = outcomeAt(hole)
    let cell = ''
    let win = false
    if (outcome?.decided) {
      if (outcome.winners.includes(playerId)) {
        cell = `+${outcome.value ?? 1}`
        win = true
        totalPoints += outcome.value ?? 1
      } else if (outcome.winners.length > 0) {
        cell = shortName(players, outcome.winners[0]!)
      } else {
        cell = t('detail.carried', { count: outcome.carry ?? 0 })
      }
    }
    return { hole, score, net, cell, win }
  })

  return (
    <DetailSheet title={title} subtitle={subtitle} onClose={onClose}>
      <div className="md-scroll">
        <table className="md-table pd-table">
          <thead>
            <tr>
              <th className="num">{t('strokes.hole')}</th>
              <th className="num">{t('strokes.par')}</th>
              <th className="num">{t('strokes.si')}</th>
              <th>{t('detail.strokes')}</th>
              {options.net && <th>{t('detail.net')}</th>}
              <th>{kind === 'stableford' ? t('detail.points') : t('detail.skin')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const strokes = strokesAt(row.hole)
              return (
                <tr key={row.hole}>
                  <td className="num hole">{row.hole + 1}</td>
                  <td className="num par">{parAt(round, row.hole)}</td>
                  <td className="num">{si[row.hole] ?? row.hole + 1}</td>
                  <td className="mark-cell">
                    <ScoreMark score={row.score} par={parAt(round, row.hole)} />
                    {strokes > 0 && (
                      <span className="md-dots">{'•'.repeat(strokes)}</span>
                    )}
                  </td>
                  {options.net && (
                    <td className="val">
                      {row.net === undefined ? '' : row.net === CONCEDED ? '×' : row.net}
                    </td>
                  )}
                  <td className="val">
                    <span
                      className={`md-val${row.win ? ` win team-${(player?.teamId ?? 'a').toLowerCase()}` : ''}${kind === 'skins' && !row.win ? ' muted' : ''}`}
                    >
                      {row.cell}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>{t('strokes.total')}</th>
              <td className="val">{totalGross > 0 ? totalGross : '–'}</td>
              {options.net && <td />}
              <td className="val">
                <b>{totalPoints}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint center px md-legend">
        {kind === 'stableford' ? t('detail.stablefordLegend') : t('detail.skinsLegend')}
      </p>
    </DetailSheet>
  )
}

function scoreLabel(score: number | undefined): string {
  return score === undefined ? '–' : score === 0 ? '×' : String(score)
}
