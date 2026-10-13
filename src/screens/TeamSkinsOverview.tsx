import { useMemo, useState } from 'react'
import type {
  SkinsMode,
  TeamSkinsHole,
  TeamSkinsRound,
  TeamSkinsSummary,
} from '../evaluations/teamSkinsTotal'
import { teamSkinsSummary } from '../evaluations/teamSkinsTotal'
import { t } from '../i18n'
import { shortName } from '../model/round'
import type { Player, TeamId, TournamentRound } from '../model/types'
import { TEAM_IDS } from '../model/types'
import { Pill, Section, TeamBadge, teamName } from './common'

const MODES: SkinsMode[] = ['net', 'gross']

/**
 * Team Skins přes všechna odehraná kola: netto i brutto vedle sebe, klepnutím
 * rozpis po kolech a jamkách - kdo skin vzal (zvýrazněno barvou týmu), kolik
 * skinů s bankem a jakou ránou; dělené jamky tlumeně s bankem. Klepnutí na
 * jamku ji rozbalí na rány všech osmi po týmech s nejlepší ránou týmu.
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
          <p className="hint center">{t('teamSkins.tapHint')}</p>
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
              <TeamSkinsRoundHoles
                entry={entry}
                net={mode === 'net'}
                players={players}
                teams={teams}
              />
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

/**
 * Jamky jednoho kola Team Skins: kdo skin vzal (barva týmu), dělené tlumeně
 * s bankem; klepnutí jamku rozbalí na rány všech osmi. Sdílí ho souhrn
 * zájezdu i Team Skins kola.
 */
export function TeamSkinsRoundHoles({
  entry,
  net,
  players,
  teams,
}: {
  entry: TeamSkinsRound
  net: boolean
  players: Player[]
  teams?: Record<TeamId, { name: string }>
}) {
  const [openHole, setOpenHole] = useState<string | null>(null)
  const score = (value: number | null) =>
    value === null ? t('teamSkins.pickedUp') : value
  return (
    <>
      {entry.holes.length === 0 ? (
        <p className="hint px">{t('teamSkins.noHoles')}</p>
      ) : (
        <ol className="ts-holes">
          {entry.holes.map((hole) => {
            const key = `${entry.round.id}:${hole.hole}`
            const expanded = openHole === key
            return (
              <li
                key={hole.hole}
                className={`ts-hole expandable${hole.winner ? ` win-${hole.winner.toLowerCase()}` : ' halved'}${expanded ? ' open' : ''}`}
              >
                <button
                  type="button"
                  className="ts-hole-row"
                  aria-expanded={expanded}
                  onClick={() => setOpenHole(expanded ? null : key)}
                >
                  <span className="ts-hole-no">{hole.hole + 1}</span>
                  <span className="ts-hole-main">
                    {hole.winner ? (
                      <>
                        <span className="ts-hole-who">
                          <TeamBadge teamId={hole.winner} />
                          {hole.players.map((id) => shortName(players, id)).join(', ')}
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
                        {hole.carry > 0
                          ? t('teamSkins.holeHalved', {
                              par: hole.par,
                              score: score(hole.best.A),
                              carry: hole.carry,
                            })
                          : t('teamSkins.holeHalvedNoCarry', {
                              par: hole.par,
                              score: score(hole.best.A),
                            })}
                      </span>
                    )}
                  </span>
                  {hole.winner && (
                    <span className="ts-hole-skins">
                      {t('common.skins', { count: hole.skins })}
                    </span>
                  )}
                  <span className="chev">›</span>
                </button>
                {expanded && (
                  <HoleScores hole={hole} net={net} players={players} teams={teams} />
                )}
              </li>
            )
          })}
        </ol>
      )}
      {(entry.carry > 0 || entry.pending > 0) && (
        <p className="hint px ts-round-foot">
          {[
            entry.pending > 0 ? t('teamSkins.pending', { count: entry.pending }) : '',
            entry.carry > 0 ? t('teamSkins.carryLeft', { count: entry.carry }) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </>
  )
}

/**
 * Rány všech osmi na jamce po týmech: kdo co zahrál, u netto i rány z HCP,
 * nejlepší rána týmu zvýrazněná (u vítěze barvou týmu) - z ní je skin.
 */
function HoleScores({
  hole,
  net,
  players,
  teams,
}: {
  hole: TeamSkinsHole
  net: boolean
  players: Player[]
  teams?: Record<TeamId, { name: string }>
}) {
  return (
    <div className="ts-hole-scores">
      {TEAM_IDS.map((team) => (
        <div
          key={team}
          className={`ts-team-scores${hole.winner === team ? ` won team-${team.toLowerCase()}` : ''}`}
        >
          <p className="ts-team-head">
            <TeamBadge teamId={team} />
            <span className="ts-team-name">{teamName(team, teams)}</span>
          </p>
          <ul>
            {hole.scores
              .filter((entry) => entry.team === team)
              .map((entry) => (
                <li key={entry.id} className={entry.best ? 'best' : undefined}>
                  <span className="ts-score-name">{shortName(players, entry.id)}</span>
                  {entry.gross === null ? (
                    <span className="ts-score-value">×</span>
                  ) : (
                    <>
                      {net && entry.strokes > 0 && (
                        <span className="ts-score-calc">
                          {t('teamSkins.netCalc', {
                            gross: entry.gross,
                            strokes: entry.strokes,
                          })}
                        </span>
                      )}
                      <span className="ts-score-value">{entry.value}</span>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
