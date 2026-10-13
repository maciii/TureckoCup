import type { BonusConfig, Player, TeamId, TournamentRound } from '../model/types'
import type { BonusSummary } from '../evaluations/bonuses'
import { bonusBreakdown } from '../evaluations/bonuses'
import { dynamicKey, t } from '../i18n'
import { useState } from 'react'
import { Section, Standings } from './common'
import PlayerDetail from './PlayerDetail'

interface Props {
  round: TournamentRound
  players: Player[]
  config: BonusConfig
  summary: BonusSummary
  teams?: Record<TeamId, { name: string }>
}

/**
 * Tabulka extra bodů kola - vedlejší sázka pod výsledky her (vzor Golfgames
 * `sideBetSection`): kdo kolik bodů uhrál a za co.
 */
export default function BonusResults({ round, players, config, summary }: Props) {
  const [detail, setDetail] = useState<string | null>(null)
  const pendingNote =
    summary.pending > 0 ? t('round.pendingHoles', { count: summary.pending }) : undefined
  return (
    <Section
      title={t('bonus.title')}
      note={
        pendingNote
          ? `${t('bonus.description')} · ${pendingNote}`
          : t('bonus.description')
      }
      accent="gold"
      right={undefined}
    >
      <Standings
        rows={summary.rows}
        players={players}
        value={(row) => String(row.value)}
        onSelect={(row) => setDetail(row.id)}
        meta={(row) => {
          const parts = bonusBreakdown(round, config, row.id).map(
            ({ bonus, count }) =>
              `${t(dynamicKey('bonus', bonus.id, 'name'))}${count > 1 ? ` ×${count}` : ''}`,
          )
          return parts.length > 0 ? parts.join(' · ') : undefined
        }}
      />
      {detail && (
        <PlayerDetail
          kind="bonus"
          round={round}
          playerId={detail}
          players={players}
          bonusConfig={config}
          onClose={() => setDetail(null)}
        />
      )}
    </Section>
  )
}
