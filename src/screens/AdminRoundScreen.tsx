import { useEffect, useState } from 'react'
import { useData } from '../data'
import type { EditRecord } from '../model/types'
import { SEED_SCHEDULE, defaultGames, seedRoundConfig } from '../data/seed'
import { dynamicKey, localizedTeeName, t } from '../i18n'
import { BONUSES, defaultBonusValues } from '../model/bonuses'
import type {
  DuelFormat,
  GameConfig,
  GameKind,
  GameSide,
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
import {
  TEE_INTERVAL_MINUTES,
  addMinutes,
  isValidTime,
  normalizeTime,
} from '../model/schedule'
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
    // Program kola (odjezd, tee time) není konfigurace her - zadané časy
    // zůstávají, seed je jen doplní, kde chybí.
    const departure = round!.departure ?? config.departure
    patch({
      ...config,
      status: round!.status,
      flights: config.flights.map((flight, index) => {
        const teeTime = round!.flights[index]?.teeTime ?? flight.teeTime
        const { teeTime: _seedTime, ...rest } = flight
        return teeTime ? { ...rest, teeTime } : rest
      }),
      ...(departure ? { departure } : {}),
    })
  }

  /**
   * Tee time flightu. Flighty jdou vždy za sebou, takže čas doplní
   * následujícím flightům, které ho ještě nemají (po 10 minutách).
   */
  function setTeeTime(index: number, value: string) {
    patch({
      flights: round!.flights.map((flight, i) => {
        if (i === index) return { ...flight, teeTime: value }
        if (i > index && isValidTime(value) && !isValidTime(flight.teeTime))
          return {
            ...flight,
            teeTime: addMinutes(value, (i - index) * TEE_INTERVAL_MINUTES),
          }
        return flight
      }),
    })
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
          note={
            round.handicapMode === 'fixed'
              ? t('admin.courseHandicapFixedHint')
              : t('admin.courseHandicapHint')
          }
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

        <Section title={t('admin.flights')} note={t('admin.scheduleHint')} accent="navy">
          {noWriters && <p className="notice error">{t('admin.noWriters')}</p>}
          <div className="px">
            <div className="field">
              <span className="field-label">{t('schedule.departure')}</span>
              <TimeInput
                label={t('schedule.departure')}
                value={round.departure ?? ''}
                onCommit={(departure) => patch({ departure })}
              />
            </div>
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
                <div className="field-row">
                  <span className="hint">{t('schedule.teeTime')}</span>
                  <TimeInput
                    label={t('admin.teeTimeOf', { number: index + 1 })}
                    value={flight.teeTime ?? ''}
                    onCommit={(time) => setTeeTime(index, time)}
                  />
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

/** Strany týmového zápasu z flightů: první dvojice flightu proti druhé. */
function flightSides(round: TournamentRound): GameSide[] {
  return round.flights.flatMap((flight, index) => [
    { id: `f${index}a`, players: flight.players.slice(0, 2) },
    { id: `f${index}b`, players: flight.players.slice(2, 4) },
  ])
}

/** Zápasy po dvou stranách, jak je páruje evaluace (1 vs 2, 3 vs 4 …). */
function matchPairs(sides: GameSide[]): GameSide[][] {
  const pairs: GameSide[][] = []
  for (let i = 0; i + 1 < sides.length; i += 2) pairs.push([sides[i]!, sides[i + 1]!])
  return pairs
}

/**
 * Změna druhu hry: vlastní název popisoval původní hru, proto se zahodí;
 * týmový zápas bez stran by nic nevyhodnotil, dostane dvojice z flightů.
 */
function withKind(game: GameConfig, round: TournamentRound, kind: GameKind): GameConfig {
  const { name: _name, ...rest } = game
  if (kind === 'team-match' && !game.sides?.length)
    return { ...rest, kind, sides: flightSides(round) }
  if (kind === 'bonuses' && !game.options.bonusValues)
    return {
      ...rest,
      kind,
      options: {
        ...rest.options,
        net: false,
        bonusValues: defaultBonusValues(),
        confirmByPar: true,
      },
    }
  return { ...rest, kind }
}

/** Prázdný název = název podle druhu hry; klíč se vynechá (Firestore neumí undefined). */
function withName(game: GameConfig, value: string): GameConfig {
  const { name: _name, ...rest } = game
  return value.trim() ? { ...rest, name: value } : rest
}

/** Rozsah jamek; celé kolo se neukládá, aby hra sledovala délku hřiště. */
function withHoles(
  game: GameConfig,
  round: TournamentRound,
  from: number,
  to: number,
): GameConfig {
  const { holes: _holes, ...rest } = game
  const last = round.course.holeCount - 1
  const range = { from: Math.min(from, to), to: Math.max(from, to) }
  return range.from === 0 && range.to === last ? rest : { ...rest, holes: range }
}

function newGame(round: TournamentRound): GameConfig {
  const used = new Set(round.games.map((g) => g.kind))
  const kind = GAME_KINDS.find((k) => !used.has(k)) ?? 'position-duel'
  const template = defaultGames().find((g) => g.kind === kind)
  const id = `${kind}-${Date.now().toString(36)}`
  if (template) return { ...template, id }
  if (kind === 'bonuses') {
    return {
      id,
      kind,
      options: {
        allowance: 1,
        net: false,
        bonusValues: defaultBonusValues(),
        confirmByPar: true,
      },
      countsForTeam: false,
      teamPoints: { perPoint: 1 },
    }
  }
  return {
    id,
    kind,
    options: { allowance: 1, net: true, format: 'match-play' },
    countsForTeam: kind === 'team-match',
    teamPoints: { win: 1, halve: 0.5 },
    ...(kind === 'team-match' ? { sides: flightSides(round) } : {}),
  }
}

/** Hráč na místě `slot` strany `sideIndex`; ostatní strany si ho nechají (admin rozhodne). */
function withSidePlayer(
  game: GameConfig,
  sideIndex: number,
  slot: number,
  playerId: PlayerId,
): GameConfig {
  const sides = (game.sides ?? []).map((side, index) => {
    if (index !== sideIndex) return side
    const players = [...side.players]
    while (players.length < 2) players.push('')
    players[slot] = playerId
    return { ...side, players: players.filter((id) => id !== '') }
  })
  return { ...game, sides }
}

/**
 * Pole pro čas programu. Systémové `type="time"` ukazuje podle jazyka
 * prohlížeče i 12hodinový formát a na úzkém displeji se nevejde; tady se
 * píše `1550` nebo `15:50`. Ukládá se až po dopsání (opuštění pole, Enter),
 * jinak by rozepsané `155` uložilo 01:55 a dopočítalo tee time dalšího flightu.
 */
function TimeInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  function commit() {
    setEditing(false)
    if (draft.trim() === '') {
      if (value !== '') onCommit('')
      return
    }
    const time = normalizeTime(draft)
    if (time === null) {
      setDraft(value)
      return
    }
    setDraft(time)
    if (time !== value) onCommit(time)
  }

  return (
    <input
      className="input sm num time-input"
      inputMode="numeric"
      autoComplete="off"
      placeholder={t('admin.timePlaceholder')}
      aria-label={label}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
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
  const holeNumbers = Array.from({ length: round.course.holeCount }, (_, i) => i)
  const holes = game.holes ?? { from: 0, to: round.course.holeCount - 1 }

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
          onChange={(e) => onChange(withKind(game, round, e.target.value as GameKind))}
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
      <div className="field">
        <span className="field-label fixed">{t('admin.gameName')}</span>
        <input
          className="input sm grow"
          aria-label={t('admin.gameName')}
          value={game.name ?? ''}
          placeholder={gameTitle({ ...game, name: undefined })}
          onChange={(e) => onChange(withName(game, e.target.value))}
        />
      </div>
      <div className="field">
        <span className="field-label">{t('admin.gameHoles')}</span>
        <span className="row-inline">
          <select
            className="input sm num"
            aria-label={t('admin.gameHolesFrom')}
            value={holes.from}
            onChange={(e) =>
              onChange(withHoles(game, round, Number(e.target.value), holes.to))
            }
          >
            {holeNumbers.map((hole) => (
              <option key={hole} value={hole}>
                {hole + 1}
              </option>
            ))}
          </select>
          <span>–</span>
          <select
            className="input sm num"
            aria-label={t('admin.gameHolesTo')}
            value={holes.to}
            onChange={(e) =>
              onChange(withHoles(game, round, holes.from, Number(e.target.value)))
            }
          >
            {holeNumbers.map((hole) => (
              <option key={hole} value={hole}>
                {hole + 1}
              </option>
            ))}
          </select>
        </span>
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
      {game.kind === 'bonuses' && (
        <>
          <div
            className="field"
            style={{ flexDirection: 'column', alignItems: 'stretch' }}
          >
            <span className="field-label">{t('admin.gameBonuses')}</span>
            <span className="hint">{t('admin.gameBonusesHint')}</span>
          </div>
          {BONUSES.map((bonus) => (
            <div key={bonus.id} className="field">
              <span className="field-label">
                <span className="bonus-mark">{bonus.mark}</span>
                {t(dynamicKey('bonus', bonus.id, 'name'))}
              </span>
              <input
                className="input sm num"
                inputMode="decimal"
                aria-label={t(dynamicKey('bonus', bonus.id, 'name'))}
                value={options.bonusValues?.[bonus.id] ?? 0}
                onChange={(e) =>
                  setOptions({
                    bonusValues: {
                      ...(options.bonusValues ?? {}),
                      [bonus.id]: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
            </div>
          ))}
          <Switch
            label={t('admin.gameConfirmByPar')}
            on={options.confirmByPar ?? false}
            onChange={(confirmByPar) => setOptions({ confirmByPar })}
          />
          {game.countsForTeam && (
            <div className="field">
              <span className="field-label">{t('admin.gamePerPoint')}</span>
              <input
                className="input sm num"
                inputMode="decimal"
                value={game.teamPoints.perPoint ?? 1}
                onChange={(e) =>
                  onChange({
                    ...game,
                    teamPoints: {
                      ...game.teamPoints,
                      perPoint: Number(e.target.value) || 0,
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
            <div
              className="field"
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <div className="field-row">
                <span className="field-label">{t('admin.gameSides')}</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => onChange({ ...game, sides: flightSides(round) })}
                >
                  {t('admin.pairsFromFlights')}
                </button>
              </div>
              {matchPairs(game.sides ?? []).map((pair, matchIndex) => (
                <div key={matchIndex} className="pair-row">
                  <span className="hint" style={{ width: '100%' }}>
                    {t('admin.gameSidesHint', { number: matchIndex + 1 })}
                  </span>
                  {pair.map((side, sideOffset) =>
                    [0, 1].map((slot) => {
                      const sideIndex = matchIndex * 2 + sideOffset
                      const value = side.players[slot] ?? ''
                      return (
                        <span key={`${side.id}-${slot}`} style={{ display: 'contents' }}>
                          {sideOffset === 1 && slot === 0 && (
                            <span className="vs">vs</span>
                          )}
                          <select
                            className="input sm"
                            aria-label={`${t('admin.gameSidesHint', { number: matchIndex + 1 })} ${
                              sideOffset === 0 ? 'A' : 'B'
                            } ${slot + 1}`}
                            value={value}
                            onChange={(e) =>
                              onChange(
                                withSidePlayer(game, sideIndex, slot, e.target.value),
                              )
                            }
                          >
                            <option value="">{t('common.dash')}</option>
                            {round.playerIds.map((id) => (
                              <option key={id} value={id}>
                                {shortName(state.players, id)}
                              </option>
                            ))}
                          </select>
                        </span>
                      )
                    }),
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
