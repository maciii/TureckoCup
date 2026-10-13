import { useState } from 'react'
import type { RoundEvaluation, TournamentSummary } from '../evaluations/tournament'
import type { EvaluationResult } from '../evaluations'
import { t } from '../i18n'
import type { BonusConfig, Player, PlayerId, TeamId } from '../model/types'
import { TEAM_IDS } from '../model/types'
import DetailSheet from './DetailSheet'
import { DuelRow } from './GameResults'
import PlayerDetail from './PlayerDetail'
import type { PlayerDetailKind } from './PlayerDetail'
import { Pill, TeamBadge, gameTitle, playerLabel, teamName } from './common'

/**
 * Detaily souhrnů zájezdu na přehledu: jednotlivec po kolech, bilance pozice
 * po kolech a týmové skóre po kolech a hrách. Čísla jsou ze stejných evaluací
 * jako souhrny - jen rozložená, odkud se vzala.
 */

function roundLabel(entry: RoundEvaluation): string {
  return `${t('round.title', { number: entry.round.number })} · ${entry.round.course.name}`
}

function sumRows(entry: RoundEvaluation, kind: string, id: PlayerId): number | null {
  const results = entry.results.filter((r) => r.game.kind === kind)
  if (results.length === 0) return null
  return results.reduce(
    (sum, result) => sum + (result.rows.find((r) => r.id === id)?.value ?? 0),
    0,
  )
}

/** Jednotlivec v turnaji: Stableford, skiny a extra body po kolech, klepnutím rozpis kola. */
export function IndividualDetail({
  summary,
  playerId,
  players,
  bonusConfig,
  onClose,
}: {
  summary: TournamentSummary
  playerId: PlayerId
  players: Player[]
  bonusConfig: BonusConfig
  onClose: () => void
}) {
  const [open, setOpen] = useState<{
    kind: PlayerDetailKind
    entry: RoundEvaluation
    result?: EvaluationResult
  } | null>(null)
  const player = players.find((p) => p.id === playerId)
  const total = summary.individuals.find((i) => i.id === playerId)
  const played = summary.rounds.filter(
    (entry) => Object.keys(entry.round.scores[playerId] ?? {}).length > 0,
  )
  return (
    <DetailSheet
      title={t('overview.individuals')}
      subtitle={
        <p className="detail-player">
          <TeamBadge teamId={player?.teamId} />
          <span>{playerLabel(players, playerId)}</span>
        </p>
      }
      onClose={onClose}
    >
      <ul className="list px td-list">
        {played.map((entry) => {
          const stableford = sumRows(entry, 'individual-stableford', playerId)
          const skins = sumRows(entry, 'individual-skins', playerId)
          const bonus = entry.bonuses?.rows.find((r) => r.id === playerId)?.value ?? null
          const stablefordResult = entry.results.find(
            (r) => r.game.kind === 'individual-stableford',
          )
          const skinsResult = entry.results.find(
            (r) => r.game.kind === 'individual-skins',
          )
          return (
            <li key={entry.round.id} className="td-round">
              <p className="td-round-title">{roundLabel(entry)}</p>
              <div className="td-chips">
                {stableford !== null && stablefordResult && (
                  <button
                    type="button"
                    className="td-chip"
                    onClick={() =>
                      setOpen({ kind: 'stableford', entry, result: stablefordResult })
                    }
                  >
                    <span className="td-chip-label">{t('detail.stableford')}</span>
                    <b>{stableford}</b> ›
                  </button>
                )}
                {skins !== null && skinsResult && (
                  <button
                    type="button"
                    className="td-chip"
                    onClick={() => setOpen({ kind: 'skins', entry, result: skinsResult })}
                  >
                    <span className="td-chip-label">{t('detail.skins')}</span>
                    <b>{skins}</b> ›
                  </button>
                )}
                {bonus !== null && (
                  <button
                    type="button"
                    className="td-chip"
                    onClick={() => setOpen({ kind: 'bonus', entry })}
                  >
                    <span className="td-chip-label">{t('bonus.short')}</span>
                    <b>{bonus}</b> ›
                  </button>
                )}
                {stableford === null && skins === null && bonus === null && (
                  <span className="hint">{t('detail.noIndividualGames')}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {total && (
        <p className="pd-total px">
          {t('detail.individualTotal', {
            stableford: total.stableford,
            skins: total.skins,
            bonus: total.bonus,
          })}
        </p>
      )}
      {open && (
        <PlayerDetail
          kind={open.kind}
          round={open.entry.round}
          playerId={playerId}
          players={players}
          result={open.result}
          bonusConfig={bonusConfig}
          onClose={() => setOpen(null)}
        />
      )}
    </DetailSheet>
  )
}

/** Bilance pozice: dohrané singly pozice po kolech, klepnutím rozpis zápasu. */
export function PositionDetail({
  summary,
  position,
  players,
  onClose,
}: {
  summary: TournamentSummary
  position: number
  players: Player[]
  onClose: () => void
}) {
  const matches = summary.rounds.flatMap((entry) =>
    entry.results
      .filter((result) => result.game.kind === 'position-duel')
      .flatMap((result) =>
        (result.duels ?? [])
          .filter((duel) => duel.position === position && duel.sides.length === 2)
          .map((duel) => ({ entry, result, duel })),
      ),
  )
  return (
    <DetailSheet
      title={`${t('overview.positions')} · ${t('overview.positionShort')} ${position}`}
      subtitle={<p className="hint">{t('detail.positionHint')}</p>}
      onClose={onClose}
    >
      {matches.length === 0 ? (
        <p className="hint center px">{t('common.dash')}</p>
      ) : (
        matches.map(({ entry, result, duel }) => (
          <div key={`${entry.round.id}-${result.game.id}`} className="px td-match">
            <p className="td-round-title">
              {roundLabel(entry)} · {gameTitle(result.game)}
            </p>
            <ul className="list">
              <DuelRow
                duel={duel}
                players={players}
                format={result.game.options.format ?? 'strokes-net'}
                round={entry.round}
                game={result.game}
              />
            </ul>
          </div>
        ))
      )}
    </DetailSheet>
  )
}

/** Týmové skóre: body po kolech a hrách (jen hry do týmového skóre) a extra body. */
export function TeamScoreDetail({
  summary,
  teams,
  onClose,
}: {
  summary: TournamentSummary
  teams?: Record<TeamId, { name: string }>
  onClose: () => void
}) {
  return (
    <DetailSheet
      title={t('overview.teamScore')}
      subtitle={
        <p className="ts-sheet-total">
          <TeamBadge teamId="A" /> {teamName('A', teams)} <b>{summary.teamPoints.A}</b>
          <span className="sep">:</span>
          <b>{summary.teamPoints.B}</b> {teamName('B', teams)} <TeamBadge teamId="B" />
        </p>
      }
      onClose={onClose}
    >
      <div className="px">
        {summary.rounds.map((entry) => {
          const games = entry.results.filter((r) => r.game.countsForTeam)
          const bonus = entry.bonuses?.teamPoints
          const withBonus = bonus && (bonus.A > 0 || bonus.B > 0)
          return (
            <section key={entry.round.id} className="td-team-round">
              <p className="ts-round-head">
                <span>{roundLabel(entry)}</span>
                <span className="ts-score">
                  <Pill teamId="A">{entry.teamPoints.A}</Pill>
                  <span className="sep">:</span>
                  <Pill teamId="B">{entry.teamPoints.B}</Pill>
                </span>
              </p>
              {games.length === 0 && !withBonus ? (
                <p className="hint">{t('detail.noTeamGames')}</p>
              ) : (
                <ul className="td-games">
                  {games.map((result) => (
                    <li key={result.game.id}>
                      <span>{gameTitle(result.game)}</span>
                      <span className="td-points">
                        {TEAM_IDS.map((team) => result.teamPoints[team]).join(' : ')}
                      </span>
                    </li>
                  ))}
                  {withBonus && (
                    <li>
                      <span>{t('bonus.title')}</span>
                      <span className="td-points">
                        {bonus.A} : {bonus.B}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <p className="hint center px">{t('detail.teamScoreHint')}</p>
    </DetailSheet>
  )
}
