import { useMemo, useState } from 'react'
import type { PlayerSkinsSummary, SkinsMode } from '../evaluations/teamSkinsTotal'
import { playerSkinsSummary } from '../evaluations/teamSkinsTotal'
import { t } from '../i18n'
import { shortName, teamOf } from '../model/round'
import type { Player, PlayerId, TournamentRound } from '../model/types'
import { TeamBadge } from './common'

const MODES: SkinsMode[] = ['net', 'gross']

/**
 * Rozpis odznaku Skinař: přepínač Netto / Brutto, součty hráčů a po kolech
 * a flightech jamky - kdo skin vzal (barva jeho týmu, jeho rána proti nejlepší
 * ráně ostatních, skiny i s bankem), dělené jamky tlumeně s bankem.
 */
export default function PlayerSkinsBreakdown({
  rounds,
  players,
  me,
}: {
  rounds: TournamentRound[]
  players: Player[]
  me: PlayerId | null
}) {
  const summaries = useMemo(
    () =>
      Object.fromEntries(
        MODES.map((mode) => [mode, playerSkinsSummary(rounds, players, mode)]),
      ) as Record<SkinsMode, PlayerSkinsSummary>,
    [rounds, players],
  )
  const [mode, setMode] = useState<SkinsMode>('net')
  const summary = summaries[mode]
  const ranking = [...summary.totals.entries()].sort((a, b) => b[1] - a[1])
  const score = (value: number | null) =>
    value === null ? t('teamSkins.pickedUp') : value

  return (
    <div className="skins-breakdown">
      <div className="px">
        <p className="eyebrow">{t('skinsBreakdown.title')}</p>
        <div className="tabs compact" role="group" aria-label={t('skinsBreakdown.title')}>
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
        <p className="skins-breakdown-totals" data-testid="skins-totals">
          {ranking.map(([id, value]) => `${shortName(players, id)} ${value}`).join(' · ')}
        </p>
      </div>
      <div className="ts-rounds">
        {summary.rounds.map((entry) => (
          <section key={entry.round.id} className="ts-round">
            {entry.flights.map((flight) => (
              <div key={flight.index} className="skins-flight">
                <p className="ts-round-head">
                  <span>
                    {t('round.title', { number: entry.round.number })} ·{' '}
                    {t('round.flight', { number: flight.index + 1 })}
                  </span>
                </p>
                {flight.holes.length === 0 ? (
                  <p className="hint">{t('teamSkins.noHoles')}</p>
                ) : (
                  <ol className="ts-holes">
                    {flight.holes.map((hole) => {
                      const team = hole.winner ? teamOf(players, hole.winner) : undefined
                      return (
                        <li
                          key={hole.hole}
                          className={`ts-hole${hole.winner ? ` win-${(team ?? 'a').toLowerCase()}` : ' halved'}${hole.winner && hole.winner === me ? ' mine' : ''}`}
                        >
                          <span className="ts-hole-no">{hole.hole + 1}</span>
                          <span className="ts-hole-main">
                            {hole.winner ? (
                              <>
                                <span className="ts-hole-who">
                                  <TeamBadge teamId={team} />
                                  {shortName(players, hole.winner)}
                                </span>
                                <span className="ts-hole-detail">
                                  {t('teamSkins.holeWon', {
                                    par: hole.par,
                                    own: score(hole.score),
                                    other: score(hole.others),
                                  })}
                                </span>
                              </>
                            ) : (
                              <span className="ts-hole-detail">
                                {t('skinsBreakdown.halved', {
                                  par: hole.par,
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
                      )
                    })}
                  </ol>
                )}
                {(flight.carry > 0 || flight.pending > 0) && (
                  <p className="hint ts-round-foot">
                    {[
                      flight.pending > 0
                        ? t('teamSkins.pending', { count: flight.pending })
                        : '',
                      flight.carry > 0
                        ? t('teamSkins.carryLeft', { count: flight.carry })
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
