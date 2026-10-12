import { useMemo, useState } from 'react'
import type { SkinsMode, TeamSkinsSummary } from '../evaluations/teamSkinsTotal'
import { teamSkinsSummary } from '../evaluations/teamSkinsTotal'
import { t } from '../i18n'
import { shortName } from '../model/round'
import type { Player, TeamId, TournamentRound } from '../model/types'
import { Pill, Section, TeamBadge, teamName } from './common'

const MODES: SkinsMode[] = ['net', 'gross']

/**
 * Team Skins přes všechna odehraná kola: netto i brutto vedle sebe, klepnutím
 * rozpis po kolech a jamkách - kdo skin vzal (zvýrazněno barvou týmu), kolik
 * skinů s bankem a jakou ránou; dělené jamky tlumeně s bankem.
 */
export default function TeamSkinsOverview({
  rounds,
  players,
  teams,
}: {
  rounds: TournamentRound[]
  players: Player[]
  teams?: Record<TeamId, { name: string }>
}) {
  const summaries = useMemo(
    () =>
      Object.fromEntries(
        MODES.map((mode) => [mode, teamSkinsSummary(rounds, players, mode)]),
      ) as Record<SkinsMode, TeamSkinsSummary>,
    [rounds, players],
  )
  const [open, setOpen] = useState<SkinsMode | null>(null)
  if (summaries.net.rounds.length === 0) return null

  return (
    <Section
      title={t('teamSkins.title')}
      note={t('teamSkins.hint', { count: summaries.net.rounds.length })}
      accent="gold"
    >
      <ul className="list ts-totals">
        {MODES.map((mode) => {
          const totals = summaries[mode].totals
          const leader = totals.A === totals.B ? null : totals.A > totals.B ? 'A' : 'B'
          return (
            <li key={mode}>
              <button
                type="button"
                className="row ts-total"
                onClick={() => setOpen(mode)}
                aria-label={`${t('teamSkins.title')} ${t(`teamSkins.mode.${mode}`)}`}
              >
                <span className="row-main">
                  <span className="row-title">{t(`teamSkins.mode.${mode}`)}</span>
                  <span className="row-meta">
                    {leader
                      ? t('teamSkins.leads', { team: teamName(leader, teams) })
                      : t('teamSkins.tied')}
                  </span>
                </span>
                <span className="ts-score">
                  <Pill teamId="A">{totals.A}</Pill>
                  <span className="sep">:</span>
                  <Pill teamId="B">{totals.B}</Pill>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <TeamSkinsSheet
          summaries={summaries}
          initial={open}
          players={players}
          teams={teams}
          onClose={() => setOpen(null)}
        />
      )}
    </Section>
  )
}

function TeamSkinsSheet({
  summaries,
  initial,
  players,
  teams,
  onClose,
}: {
  summaries: Record<SkinsMode, TeamSkinsSummary>
  initial: SkinsMode
  players: Player[]
  teams?: Record<TeamId, { name: string }>
  onClose: () => void
}) {
  const [mode, setMode] = useState<SkinsMode>(initial)
  const summary = summaries[mode]
  const score = (value: number | null) =>
    value === null ? t('teamSkins.pickedUp') : value
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet ts-sheet"
        role="dialog"
        aria-label={t('teamSkins.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head px">
          <h2>{t('teamSkins.title')}</h2>
          <div className="tabs compact" role="group" aria-label={t('teamSkins.title')}>
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={`tab${mode === m ? ' selected' : ''}`}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {t(`teamSkins.mode.${m}`)}
              </button>
            ))}
          </div>
          <p className="ts-sheet-total">
            <TeamBadge teamId="A" /> {teamName('A', teams)} <b>{summary.totals.A}</b>
            <span className="sep">:</span>
            <b>{summary.totals.B}</b> {teamName('B', teams)} <TeamBadge teamId="B" />
          </p>
        </div>
        <div className="ts-rounds">
          {summary.rounds.map((entry) => (
            <section key={entry.round.id} className="ts-round">
              <p className="ts-round-head">
                <span>
                  {t('round.title', { number: entry.round.number })} ·{' '}
                  {entry.round.course.name}
                </span>
                <span className="ts-score">
                  <Pill teamId="A">{entry.totals.A}</Pill>
                  <span className="sep">:</span>
                  <Pill teamId="B">{entry.totals.B}</Pill>
                </span>
              </p>
              {entry.holes.length === 0 ? (
                <p className="hint px">{t('teamSkins.noHoles')}</p>
              ) : (
                <ol className="ts-holes">
                  {entry.holes.map((hole) => (
                    <li
                      key={hole.hole}
                      className={`ts-hole${hole.winner ? ` win-${hole.winner.toLowerCase()}` : ' halved'}`}
                    >
                      <span className="ts-hole-no">{hole.hole + 1}</span>
                      <span className="ts-hole-main">
                        {hole.winner ? (
                          <>
                            <span className="ts-hole-who">
                              <TeamBadge teamId={hole.winner} />
                              {hole.players
                                .map((id) => shortName(players, id))
                                .join(', ')}
                            </span>
                            <span className="ts-hole-detail">
                              {t('teamSkins.holeWon', {
                                par: hole.par,
                                own: score(hole.best[hole.winner]),
                                other: score(hole.best[hole.winner === 'A' ? 'B' : 'A']),
                              })}
                            </span>
                          </>
                        ) : (
                          <span className="ts-hole-detail">
                            {t('teamSkins.holeHalved', {
                              par: hole.par,
                              score: score(hole.best.A),
                              carry: hole.carry,
                            })}
                          </span>
                        )}
                      </span>
                      {hole.winner && (
                        <span className="ts-hole-skins">
                          {t('common.skins', { count: hole.skins })}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {(entry.carry > 0 || entry.pending > 0) && (
                <p className="hint px ts-round-foot">
                  {[
                    entry.pending > 0
                      ? t('teamSkins.pending', { count: entry.pending })
                      : '',
                    entry.carry > 0
                      ? t('teamSkins.carryLeft', { count: entry.carry })
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </section>
          ))}
        </div>
        <div className="px sheet-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
