import { useEffect, useState } from 'react'
import { useData } from '../data'
import type { EditRecord } from '../model/types'
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
import {
  assignPosition,
  courseHandicapOf,
  normalizePositions,
  hasHandicap,
  playerName,
  shortName,
  teamOf,
} from '../model/round'
import { GAME_KINDS } from '../evaluations'
import { playerIdByEmail } from '../model/access'
import { navigate } from '../nav'
import {
  Header,
  Section,
  Switch,
  TeamBadge,
  formatDate,
  formatDateTime,
  gameTitle,
  teamName,
} from './common'

const STATUSES: RoundStatus[] = ['planned', 'live', 'finished']
const FORMATS: DuelFormat[] = ['strokes-gross', 'strokes-net', 'stableford', 'match-play']

/** Nastavení jednoho kola: stav, odpaliště, hrací HCP, flighty, pozice, hry, opravy. */
export default function AdminRoundScreen({ roundId }: { roundId: string }) {
  const { state, meta, store } = useData()
  const round = state.rounds.find((r) => r.id === roundId)

  if (!round || meta.role !== 'admin') {
    return (
      <div className="screen">
        <Header title={t('admin.title')} />
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

  const noWriters = Object.keys(state.access?.playerEmails ?? {}).length === 0

  const tabs = (
    options: { id: string; label: string }[],
    selected: string,
    onSelect: (id: string) => void,
  ) => (
    <div className="tabs compact">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`tab${selected === option.id ? ' selected' : ''}`}
          aria-pressed={selected === option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="screen">
      <Header
        title={t('round.title', { number: round.number })}
        subtitle={`${round.course.name} · ${formatDate(round.date)}`}
      />

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

        <Section title={t('admin.roundStatus')} accent="fairway">
          <div className="px">
            {tabs(
              STATUSES.map((status) => ({ id: status, label: t(`status.${status}`) })),
              round.status,
              (status) => patch({ status: status as RoundStatus }),
            )}
          </div>
        </Section>

        <Section
          title={t('admin.defaultTee')}
          accent="fairway"
          note={round.course.tees
            .map(
              (tee) =>
                `${localizedTeeName(tee.id, tee.name)} ${tee.courseRating ?? '?'}/${tee.slopeRating ?? '?'}`,
            )
            .join(' · ')}
        >
          <div className="px">
            {tabs(
              round.course.tees.map((tee) => ({
                id: tee.id,
                label: localizedTeeName(tee.id, tee.name),
              })),
              round.defaultTeeId,
              (teeId) => patch({ defaultTeeId: teeId }),
            )}
          </div>
        </Section>

        <Section
          title={t('admin.courseHandicap')}
          note={t('admin.courseHandicapHint')}
          accent="gold"
        >
          <div className="px">
            <table className="table-plain">
              <thead>
                <tr>
                  <th>{t('common.player')}</th>
                  <th className="num">{t('admin.handicapIndexShort')}</th>
                  <th>{t('admin.playerTee')}</th>
                  <th className="num">{t('admin.courseHandicapShort')}</th>
                  <th className="num">{t('admin.override')}</th>
                </tr>
              </thead>
              <tbody>
                {round.playerIds.map((id) => (
                  <HandicapRow key={id} round={round} playerId={id} onPatch={patch} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={t('admin.flights')} accent="navy">
          {noWriters && <p className="notice error">{t('admin.noWriters')}</p>}
          <div className="px">
            {round.flights.map((flight, index) => (
              <div
                key={index}
                className="field"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
              >
                <div
                  className="section-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span className="field-label">
                    {t('round.flight', { number: index + 1 })}
                  </span>
                  <span className="field-input">
                    <span className="hint">{t('admin.startHole')}</span>
                    <select
                      className="input sm"
                      value={flight.startHole}
                      style={{ width: 64 }}
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
          </div>
        </Section>

        <Section
          title={t('admin.positions')}
          note={t('admin.positionsHint')}
          accent="navy"
        >
          <div className="px">
            {TEAM_IDS.map((teamId) =>
              [0, 1, 2, 3].map((slot) => (
                <div key={`${teamId}${slot}`} className="field">
                  <span className="field-label">
                    <TeamBadge teamId={teamId} /> {t('overview.positionShort')} {slot + 1}
                  </span>
                  <select
                    className="input sm"
                    style={{ width: 160 }}
                    value={round.positions[teamId]?.[slot] ?? ''}
                    aria-label={`${teamName(teamId, state.tournament?.teams)} ${t('overview.positionShort')} ${slot + 1}`}
                    onChange={(e) => {
                      // Vždy celé čtyři pozice obou týmů: díra v poli by
                      // Firestore zápis odmítl.
                      patch({
                        positions: {
                          A: normalizePositions(round.positions.A),
                          B: normalizePositions(round.positions.B),
                          [teamId]: assignPosition(
                            round.positions[teamId],
                            slot,
                            e.target.value,
                          ),
                        },
                      })
                    }}
                  >
                    <option value="">{t('common.dash')}</option>
                    {round.playerIds
                      .filter(
                        (id) =>
                          teamOf(state.players, id) === teamId ||
                          round.positions[teamId]?.[slot] === id,
                      )
                      .map((id) => (
                        <option key={id} value={id}>
                          {playerName(state.players, id)}
                        </option>
                      ))}
                  </select>
                </div>
              )),
            )}
          </div>
        </Section>

        <Section
          title={t('admin.games')}
          accent="gold"
          right={
            <button
              type="button"
              className="link-button"
              onClick={() => patch({ games: [...round.games, newGame(round)] })}
            >
              + {t('admin.addGame')}
            </button>
          }
        >
          <div className="px stack">
            {round.games.map((game, index) => (
              <GameEditor
                key={game.id}
                game={game}
                round={round}
                onChange={(next) =>
                  patch({ games: round.games.map((g, i) => (i === index ? next : g)) })
                }
                onRemove={() =>
                  confirm(t('admin.removeGameConfirm', { name: gameTitle(game) })) &&
                  patch({ games: round.games.filter((_, i) => i !== index) })
                }
              />
            ))}
          </div>
        </Section>

        <Section
          title={t('admin.corrections')}
          note={t('admin.correctionsHint')}
          accent="red"
        >
          <div className="px stack">
            <button
              type="button"
              className="btn green-soft"
              onClick={() => navigate({ view: 'play', roundId, flight: null })}
            >
              {t('round.enterScores')}
            </button>
            <button type="button" className="btn ghost sm" onClick={reseed}>
              {t('admin.reseedRound')}
            </button>
            <button type="button" className="btn red-soft sm" onClick={clearScores}>
              {t('admin.clearScores')}
            </button>
          </div>
        </Section>

        <EditsLog roundId={roundId} />
      </main>
    </div>
  )
}

function EditsLog({ roundId }: { roundId: string }) {
  const { state, store } = useData()
  const [edits, setEdits] = useState<EditRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setEdits(await store.loadEdits(roundId))
    } catch (err) {
      setError(
        t('admin.editsError', {
          reason: err instanceof Error ? err.message : String(err),
        }),
      )
    } finally {
      setLoading(false)
    }
  }

  // Kdo zápis udělal: jméno hráče podle e-mailu, jinak e-mail nebo uid.
  const editorName = (edit: EditRecord) => {
    const playerId = edit.byEmail ? playerIdByEmail(state.access, edit.byEmail) : null
    return playerId ? shortName(state.players, playerId) : (edit.byEmail ?? edit.by)
  }

  const value = (v: number | null) =>
    v === null ? t('common.dash') : v === 0 ? t('common.pickedUp') : String(v)

  return (
    <Section
      title={t('admin.edits')}
      accent="navy"
      right={
        <button
          type="button"
          className="link-button"
          disabled={loading}
          onClick={() => void load()}
        >
          {edits === null ? t('admin.editsLoad') : t('admin.editsReload')}
        </button>
      }
    >
      <div className="px">
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {edits !== null && edits.length === 0 && (
          <p className="hint">{t('admin.editsEmpty')}</p>
        )}
        {edits !== null && edits.length > 0 && (
          <table className="table-plain edits-log">
            <tbody>
              {edits.map((edit, index) => (
                <tr key={`${edit.at}-${index}`}>
                  <td className="hint">{formatDateTime(edit.at) ?? t('common.dash')}</td>
                  <td>
                    {shortName(state.players, edit.playerId)} ·{' '}
                    {t('common.hole', { number: Number(edit.hole) + 1 })}
                  </td>
                  <td className="num">
                    {value(edit.from)} → {value(edit.to)}
                  </td>
                  <td className="hint">{editorName(edit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
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
  const indexValue = round.playerIndex[playerId]
  const [index, setIndex] = useState(
    indexValue === null || indexValue === undefined ? '' : String(indexValue),
  )
  useEffect(() => setDraft(override === undefined ? '' : String(override)), [override])
  useEffect(() => {
    setIndex(indexValue === null || indexValue === undefined ? '' : String(indexValue))
  }, [indexValue])

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
        <span className="row-title" style={{ fontSize: 13 }}>
          <TeamBadge teamId={state.players.find((p) => p.id === playerId)?.teamId} />
          <span>{shortName(state.players, playerId)}</span>
        </span>
      </td>
      <td className="num">
        <input
          className="input sm num"
          style={{ width: 56 }}
          inputMode="decimal"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          onBlur={saveIndex}
          aria-label={t('admin.handicapIndex')}
        />
      </td>
      <td>
        <select
          className="input sm"
          style={{ padding: '0 4px', width: 72 }}
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
      <td className={`num${hasHandicap(round, playerId) ? '' : ' warn'}`}>
        {hasHandicap(round, playerId) ? courseHandicapOf(round, playerId) : '?'}
      </td>
      <td className="num">
        <input
          className="input sm num"
          style={{ width: 48 }}
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
    <div
      className="game-card"
      style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}
    >
      <div className="field" style={{ borderTop: 'none', paddingTop: 0 }}>
        <select
          className="input sm"
          aria-label={t('admin.games')}
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
        <button
          type="button"
          className="link-button"
          style={{ color: 'var(--red)' }}
          onClick={onRemove}
        >
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
          className="input sm num"
          inputMode="numeric"
          value={Math.round(options.allowance * 100)}
          onChange={(e) =>
            setOptions({ allowance: Math.max(0, Number(e.target.value) || 0) / 100 })
          }
        />
      </div>
      {game.kind === 'individual-skins' && (
        <div className="field">
          <div className="tabs compact" style={{ width: '100%' }}>
            {(['flight', 'all'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                className={`tab${(options.scope ?? 'flight') === scope ? ' selected' : ''}`}
                aria-pressed={(options.scope ?? 'flight') === scope}
                onClick={() => setOptions({ scope })}
              >
                {t(scope === 'flight' ? 'admin.gameScopeFlight' : 'admin.gameScopeAll')}
              </button>
            ))}
          </div>
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
                className="input sm num"
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
          <div className="field">
            <div className="tabs compact" style={{ width: '100%' }}>
              {FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  className={`tab${(options.format ?? 'strokes-net') === format ? ' selected' : ''}`}
                  aria-pressed={(options.format ?? 'strokes-net') === format}
                  onClick={() => setOptions({ format })}
                >
                  {t(`format.${format}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">{t('admin.gameWin')}</span>
            <input
              className="input sm num"
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
              className="input sm num"
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
            <p className="hint" style={{ paddingTop: 6 }}>
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
