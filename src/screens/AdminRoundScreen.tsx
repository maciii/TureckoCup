import { useEffect, useState } from 'react'
import { useData } from '../data'
import { SEED_SCHEDULE, defaultGames, seedRoundConfig } from '../data/seed'
import { localizedTeeName, t } from '../i18n'
import type {
  DuelFormat,
  GameConfig,
  GameKind,
  PlayerId,
  RoundStatus,
  TournamentRound,
} from '../model/types'
import { TEAM_IDS } from '../model/types'
import { courseHandicapOf, hasHandicap, playerName, shortName } from '../model/round'
import { GAME_KINDS } from '../evaluations'
import { goBack, navigate } from '../nav'
import { Section, Switch, TeamBadge, formatDate, gameTitle, roundTitle } from './common'

const STATUSES: RoundStatus[] = ['planned', 'live', 'finished']
const FORMATS: DuelFormat[] = ['strokes-gross', 'strokes-net', 'stableford', 'match-play']

/** Nastavení jednoho kola: stav, odpaliště, hrací HCP, flighty, hry, mazání. */
export default function AdminRoundScreen({ roundId }: { roundId: string }) {
  const { state, meta, store } = useData()
  const round = state.rounds.find((r) => r.id === roundId)

  if (!round || meta.role !== 'admin') {
    return (
      <div className="screen">
        <header className="app-header">
          <div className="screen-header-row">
            <button
              type="button"
              className="icon-button"
              onClick={goBack}
              aria-label={t('common.back')}
            >
              ‹
            </button>
            <h1>{t('admin.title')}</h1>
          </div>
        </header>
        <main className="content">
          <p className="notice">{t('admin.notAdmin')}</p>
        </main>
      </div>
    )
  }

  function patch(update: Partial<TournamentRound>) {
    store.dispatch({ kind: 'updateRound', roundId, patch: update })
  }

  function reseed() {
    const entry = SEED_SCHEDULE.find((s) => s.number === round!.number)
    if (!entry) return
    const config = seedRoundConfig(entry, state.players)
    patch({ ...config, status: round!.status })
  }

  function clearScores() {
    if (confirm(t('admin.clearScoresConfirm', { number: round!.number }))) {
      store.dispatch({ kind: 'clearScores', roundId })
    }
  }

  const writersMissing = round.flights
    .map((flight, index) => ({ index, flight }))
    .filter(({ flight }) => {
      const emails = state.access?.writerEmails ?? []
      const admins = state.access?.adminEmails ?? []
      // Nevíme, který e-mail patří kterému hráči; varujeme jen při prázdném whitelistu.
      return emails.length + admins.length === 0 && flight.players.length > 0
    })

  return (
    <div className="screen">
      <header className="app-header">
        <div className="screen-header-row">
          <button
            type="button"
            className="icon-button"
            onClick={goBack}
            aria-label={t('common.back')}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{roundTitle(round)}</h1>
            <p className="subtitle">{formatDate(round.date)}</p>
          </div>
        </div>
      </header>

      <main className="content">
        {meta.error && (
          <button
            type="button"
            className="notice error"
            onClick={store.dismissError}
            role="alert"
          >
            {meta.error}
          </button>
        )}

        <Section title={t('admin.roundStatus')}>
          <div className="segmented">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`segment${round.status === status ? ' selected' : ''}`}
                onClick={() => patch({ status })}
              >
                {t(`status.${status}`)}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('admin.defaultTee')}>
          <div className="segmented">
            {round.course.tees.map((tee) => (
              <button
                key={tee.id}
                type="button"
                className={`segment${round.defaultTeeId === tee.id ? ' selected' : ''}`}
                onClick={() => patch({ defaultTeeId: tee.id })}
                title={`${tee.courseRating ?? '?'} / ${tee.slopeRating ?? '?'}`}
              >
                {localizedTeeName(tee.id, tee.name)}
              </button>
            ))}
          </div>
          <p className="hint">
            {round.course.tees
              .map(
                (tee) =>
                  `${localizedTeeName(tee.id, tee.name)} ${tee.courseRating ?? '?'}/${tee.slopeRating ?? '?'}`,
              )
              .join(' · ')}
          </p>
        </Section>

        <Section title={t('admin.courseHandicap')}>
          <p className="hint">{t('admin.courseHandicapHint')}</p>
          <table className="table-plain">
            <thead>
              <tr>
                <th>{t('common.player')}</th>
                <th className="num">{t('admin.handicapIndex')}</th>
                <th>{t('admin.playerTee')}</th>
                <th className="num">{t('admin.courseHandicap')}</th>
                <th className="num">{t('admin.override')}</th>
              </tr>
            </thead>
            <tbody>
              {round.playerIds.map((id) => (
                <HandicapRow key={id} round={round} playerId={id} onPatch={patch} />
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={t('admin.flights')}>
          {writersMissing.map(({ index }) => (
            <p key={index} className="notice error">
              {t('admin.flightNoWriter', { number: index + 1 })}
            </p>
          ))}
          {round.flights.map((flight, index) => (
            <div key={index} className="card section">
              <div className="section-title-row">
                <span className="section-title">
                  {t('round.flight', { number: index + 1 })}
                </span>
                <span className="field-input">
                  <span className="hint">{t('admin.startHole')}</span>
                  <select
                    className="select-input"
                    value={flight.startHole}
                    style={{ width: 80 }}
                    onChange={(e) =>
                      patch({
                        flights: round.flights.map((f, i) =>
                          i === index ? { ...f, startHole: Number(e.target.value) } : f,
                        ),
                      })
                    }
                  >
                    {[0, 9].map((start) => (
                      <option key={start} value={start}>
                        {start + 1}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="chip-row">
                {round.playerIds.map((id) => {
                  const inFlight = flight.players.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip${inFlight ? ' selected' : ''}`}
                      onClick={() => {
                        const flights = round.flights.map((f, i) => {
                          const without = f.players.filter((p) => p !== id)
                          if (i === index)
                            return {
                              ...f,
                              players: inFlight ? without : [...without, id],
                            }
                          return { ...f, players: inFlight ? f.players : without }
                        })
                        patch({ flights })
                      }}
                    >
                      <TeamBadge
                        teamId={state.players.find((p) => p.id === id)?.teamId}
                      />
                      {shortName(state.players, id)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Section>

        <Section title={t('admin.position')}>
          {TEAM_IDS.map((teamId) => (
            <div key={teamId} className="card">
              <div className="field-stack">
                {[0, 1, 2, 3].map((slot) => (
                  <div key={slot} className="field">
                    <span className="field-label">
                      <TeamBadge teamId={teamId} /> {slot + 1}
                    </span>
                    <select
                      className="select-input"
                      style={{ width: 160 }}
                      value={round.positions[teamId]?.[slot] ?? ''}
                      onChange={(e) => {
                        const list = [...(round.positions[teamId] ?? [])]
                        list[slot] = e.target.value
                        patch({ positions: { ...round.positions, [teamId]: list } })
                      }}
                    >
                      <option value="">{t('common.dash')}</option>
                      {round.playerIds.map((id) => (
                        <option key={id} value={id}>
                          {playerName(state.players, id)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section
          title={t('admin.games')}
          action={
            <button
              type="button"
              className="link-button inline"
              onClick={() => patch({ games: [...round.games, newGame(round)] })}
            >
              + {t('admin.addGame')}
            </button>
          }
        >
          {round.games.map((game, index) => (
            <GameEditor
              key={game.id}
              game={game}
              round={round}
              onChange={(next) =>
                patch({ games: round.games.map((g, i) => (i === index ? next : g)) })
              }
              onRemove={() => patch({ games: round.games.filter((_, i) => i !== index) })}
            />
          ))}
        </Section>

        <Section title={t('admin.corrections')}>
          <p className="hint">{t('admin.correctionsHint')}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate({ view: 'play', roundId, flight: null })}
          >
            {t('round.enterScores')}
          </button>
          <button type="button" className="secondary-button" onClick={reseed}>
            {t('admin.reseedRound')}
          </button>
          <button type="button" className="danger-button" onClick={clearScores}>
            {t('admin.clearScores')}
          </button>
        </Section>
      </main>
    </div>
  )
}

function newGame(round: TournamentRound): GameConfig {
  const used = new Set(round.games.map((g) => g.kind))
  const kind = GAME_KINDS.find((k) => !used.has(k)) ?? 'position-duel'
  const template = defaultGames().find((g) => g.kind === kind)
  const id = `${kind}-${Date.now().toString(36)}`
  if (template) return { ...template, id }
  return {
    id,
    kind,
    options: { allowance: 1, net: true, format: 'match-play' },
    countsForTeam: kind === 'team-match',
    teamPoints: { win: 1, halve: 0.5 },
    ...(kind === 'team-match'
      ? {
          sides: round.flights.flatMap((flight, index) => [
            { id: `f${index}a`, players: flight.players.slice(0, 2) },
            { id: `f${index}b`, players: flight.players.slice(2, 4) },
          ]),
        }
      : {}),
  }
}

function HandicapRow({
  round,
  playerId,
  onPatch,
}: {
  round: TournamentRound
  playerId: PlayerId
  onPatch: (patch: Partial<TournamentRound>) => void
}) {
  const { state } = useData()
  const override = round.courseHandicapOverride[playerId]
  const [draft, setDraft] = useState(override === undefined ? '' : String(override))
  const [index, setIndex] = useState(
    round.playerIndex[playerId] === null || round.playerIndex[playerId] === undefined
      ? ''
      : String(round.playerIndex[playerId]),
  )
  useEffect(() => setDraft(override === undefined ? '' : String(override)), [override])
  useEffect(() => {
    const value = round.playerIndex[playerId]
    setIndex(value === null || value === undefined ? '' : String(value))
  }, [round.playerIndex, playerId])

  function saveOverride() {
    const value = draft.trim() === '' ? undefined : Number.parseInt(draft, 10)
    const next = { ...round.courseHandicapOverride }
    if (value === undefined || Number.isNaN(value)) delete next[playerId]
    else next[playerId] = value
    onPatch({ courseHandicapOverride: next })
  }

  function saveIndex() {
    const value = index.trim() === '' ? null : Number.parseFloat(index.replace(',', '.'))
    onPatch({
      playerIndex: {
        ...round.playerIndex,
        [playerId]: value === null || Number.isNaN(value) ? null : value,
      },
    })
  }

  return (
    <tr>
      <td>
        <TeamBadge teamId={state.players.find((p) => p.id === playerId)?.teamId} />{' '}
        {shortName(state.players, playerId)}
      </td>
      <td className="num">
        <input
          className="value-input"
          style={{ width: 64, minHeight: 36 }}
          inputMode="decimal"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          onBlur={saveIndex}
          aria-label={t('admin.handicapIndex')}
        />
      </td>
      <td>
        <select
          className="select-input"
          style={{ minHeight: 36, padding: '0 6px' }}
          value={round.playerTees[playerId] ?? ''}
          onChange={(e) => {
            const next = { ...round.playerTees }
            if (e.target.value === '') delete next[playerId]
            else next[playerId] = e.target.value
            onPatch({ playerTees: next })
          }}
        >
          <option value="">{t('common.dash')}</option>
          {round.course.tees.map((tee) => (
            <option key={tee.id} value={tee.id}>
              {localizedTeeName(tee.id, tee.name)}
            </option>
          ))}
        </select>
      </td>
      <td
        className="num"
        style={{ color: hasHandicap(round, playerId) ? undefined : 'var(--danger)' }}
      >
        {hasHandicap(round, playerId)
          ? courseHandicapOf(round, playerId)
          : t('admin.missingHandicap')}
      </td>
      <td className="num">
        <input
          className="value-input"
          style={{ width: 56, minHeight: 36 }}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveOverride}
          aria-label={t('admin.override')}
        />
      </td>
    </tr>
  )
}

function GameEditor({
  game,
  round,
  onChange,
  onRemove,
}: {
  game: GameConfig
  round: TournamentRound
  onChange: (game: GameConfig) => void
  onRemove: () => void
}) {
  const { state } = useData()
  const options = game.options
  const setOptions = (next: Partial<GameConfig['options']>) =>
    onChange({ ...game, options: { ...options, ...next } })
  const isDuel = game.kind === 'position-duel' || game.kind === 'team-match'
  const isSkins = game.kind === 'individual-skins' || game.kind === 'team-skins'

  return (
    <div className="card section">
      <div className="section-title-row">
        <select
          className="select-input"
          value={game.kind}
          style={{ flex: 1 }}
          onChange={(e) => onChange({ ...game, kind: e.target.value as GameKind })}
        >
          {GAME_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {gameTitle({ ...game, kind, name: undefined })}
            </option>
          ))}
        </select>
        <button type="button" className="link-button inline" onClick={onRemove}>
          {t('admin.removeGame')}
        </button>
      </div>
      <Switch
        label={t('admin.gameCountsForTeam')}
        on={game.countsForTeam}
        onChange={(countsForTeam) => onChange({ ...game, countsForTeam })}
      />
      <Switch
        label={t('admin.gameNet')}
        on={options.net}
        onChange={(net) => setOptions({ net })}
      />
      <div className="field">
        <span className="field-label">{t('admin.gameAllowance')}</span>
        <input
          className="value-input"
          inputMode="numeric"
          value={Math.round(options.allowance * 100)}
          onChange={(e) =>
            setOptions({ allowance: Math.max(0, Number(e.target.value) || 0) / 100 })
          }
        />
      </div>
      {game.kind === 'individual-skins' && (
        <div className="segmented compact">
          {(['flight', 'all'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              className={`segment${(options.scope ?? 'flight') === scope ? ' selected' : ''}`}
              onClick={() => setOptions({ scope })}
            >
              {t(scope === 'flight' ? 'admin.gameScopeFlight' : 'admin.gameScopeAll')}
            </button>
          ))}
        </div>
      )}
      {isSkins && (
        <>
          <Switch
            label={t('admin.gameCarry')}
            on={options.carry ?? true}
            onChange={(carry) => setOptions({ carry })}
          />
          {game.kind === 'team-skins' && (
            <div className="field">
              <span className="field-label">{t('admin.gamePerSkin')}</span>
              <input
                className="value-input"
                inputMode="decimal"
                value={game.teamPoints.perSkin ?? 0}
                onChange={(e) =>
                  onChange({
                    ...game,
                    teamPoints: {
                      ...game.teamPoints,
                      perSkin: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          )}
        </>
      )}
      {isDuel && (
        <>
          <div className="segmented compact">
            {FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                className={`segment${(options.format ?? 'strokes-net') === format ? ' selected' : ''}`}
                onClick={() => setOptions({ format })}
              >
                {t(`format.${format}`)}
              </button>
            ))}
          </div>
          <div className="field">
            <span className="field-label">{t('admin.gameWin')}</span>
            <input
              className="value-input"
              inputMode="decimal"
              value={game.teamPoints.win ?? 0}
              onChange={(e) =>
                onChange({
                  ...game,
                  teamPoints: { ...game.teamPoints, win: Number(e.target.value) || 0 },
                })
              }
            />
          </div>
          <div className="field">
            <span className="field-label">{t('admin.gameHalve')}</span>
            <input
              className="value-input"
              inputMode="decimal"
              value={game.teamPoints.halve ?? 0}
              onChange={(e) =>
                onChange({
                  ...game,
                  teamPoints: { ...game.teamPoints, halve: Number(e.target.value) || 0 },
                })
              }
            />
          </div>
          {game.kind === 'team-match' && (
            <p className="hint">
              {(game.sides ?? [])
                .map((side) =>
                  side.players.map((id) => shortName(state.players, id)).join(' + '),
                )
                .join(' vs ') ||
                round.flights
                  .map((f) =>
                    f.players.map((id) => shortName(state.players, id)).join(', '),
                  )
                  .join(' | ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
