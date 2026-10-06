import { useEffect, useState } from 'react'
import { useData } from '../data'
import { SEED_ACCESS, SEED_PLAYERS, SEED_TOURNAMENT, seedRounds } from '../data/seed'
import { t } from '../i18n'
import { POSITIONS, TEAM_IDS } from '../model/types'
import type { Player, TeamId } from '../model/types'
import { formatHandicapIndex, parseHandicapIndex } from '../scoring/whs'
import { goBack, navigate } from '../nav'
import { APP_VERSION } from '../version'
import { Section, TeamBadge, formatDate, roundTitle } from './common'

/** Admin a účet: přihlášení, inicializace, hráči, kola, oprávnění, záloha. */
export default function AdminScreen() {
  const { state, meta, store } = useData()
  const isAdmin = meta.role === 'admin'

  useEffect(() => {
    if (!meta.account) store.prepareSignIn()
  }, [meta.account, store])

  function initialize() {
    store.dispatch({
      kind: 'init',
      tournament: SEED_TOURNAMENT,
      players: SEED_PLAYERS,
      rounds: seedRounds(),
      access: SEED_ACCESS,
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `turecko-cup-26-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

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

        <Section title={t('admin.signedInAs')}>
          <div className="card section">
            <p className="hint">
              <span className={`status-dot ${meta.status}`} />
              {meta.mode === 'local'
                ? t('admin.sync.local')
                : meta.status === 'offline'
                  ? t('admin.sync.offline')
                  : meta.status === 'error'
                    ? t('admin.sync.error')
                    : t('admin.sync.synced')}
            </p>
            {meta.account ? (
              <>
                <p className="account-name">{meta.account.name}</p>
                <p className="hint">
                  {meta.account.anonymous
                    ? `uid: ${meta.account.uid}`
                    : meta.account.email}{' '}
                  · {t(`admin.role.${meta.role}`)}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void store.signOut()}
                >
                  {t('admin.signOut')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={!meta.authReady}
                onClick={() => void store.signIn()}
              >
                {meta.authReady ? t('admin.signIn') : t('admin.signingIn')}
              </button>
            )}
            <p className="hint">{t('common.version', { version: APP_VERSION })}</p>
          </div>
        </Section>

        {isAdmin && !state.tournament && (
          <Section title={t('admin.initialize')}>
            <p className="hint">{t('admin.initializeHint')}</p>
            <button type="button" className="primary-button" onClick={initialize}>
              {t('admin.initialize')}
            </button>
          </Section>
        )}

        {!isAdmin && meta.account && <p className="notice">{t('admin.notAdmin')}</p>}

        {isAdmin && state.tournament && (
          <>
            <Section title={t('admin.rounds')}>
              <div className="round-list">
                {state.rounds.map((round) => (
                  <button
                    key={round.id}
                    type="button"
                    className={`round-card${round.status === 'live' ? ' live' : ''}`}
                    onClick={() => navigate({ view: 'adminRound', roundId: round.id })}
                  >
                    <span className="round-card-number">{round.number}</span>
                    <span className="round-card-main">
                      <span className="round-card-title">{roundTitle(round)}</span>
                      <span className="round-card-meta">{formatDate(round.date)}</span>
                    </span>
                    <span className="round-card-status">
                      {t(`status.${round.status}`)}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('admin.players')}>
              <p className="hint">{t('admin.playersHint')}</p>
              {TEAM_IDS.map((teamId) => (
                <TeamEditor key={teamId} teamId={teamId} />
              ))}
              <div className="card section">
                {state.players.map((player) => (
                  <PlayerEditor key={player.id} player={player} />
                ))}
              </div>
            </Section>

            <AccessEditor />

            <Section title={t('admin.export')}>
              <button type="button" className="secondary-button" onClick={exportJson}>
                {t('admin.export')}
              </button>
            </Section>
          </>
        )}
      </main>
    </div>
  )
}

function TeamEditor({ teamId }: { teamId: TeamId }) {
  const { state, store } = useData()
  const [name, setName] = useState(state.tournament?.teams[teamId].name ?? '')
  useEffect(
    () => setName(state.tournament?.teams[teamId].name ?? ''),
    [state.tournament, teamId],
  )
  function save() {
    if (!state.tournament || name.trim() === state.tournament.teams[teamId].name) return
    store.dispatch({
      kind: 'updateTournament',
      patch: { teams: { ...state.tournament.teams, [teamId]: { name: name.trim() } } },
    })
  }
  return (
    <div className="field">
      <span className="field-label">
        <TeamBadge teamId={teamId} /> {t('admin.teamName')}
      </span>
      <span className="field-input">
        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          style={{ width: 160 }}
        />
      </span>
    </div>
  )
}

function PlayerEditor({ player }: { player: Player }) {
  const { store } = useData()
  const [name, setName] = useState(player.name)
  const [hcp, setHcp] = useState(formatHandicapIndex(player.handicapIndex))
  useEffect(() => {
    setName(player.name)
    setHcp(formatHandicapIndex(player.handicapIndex))
  }, [player])

  function patch(update: Partial<Player>) {
    store.dispatch({ kind: 'updatePlayer', playerId: player.id, patch: update })
  }

  return (
    <div className="players-row" style={{ flexWrap: 'wrap' }}>
      <input
        className="name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() =>
          name.trim() &&
          name.trim() !== player.name &&
          patch({ name: name.trim(), nick: name.trim().split(/\s+/)[0] })
        }
        style={{ flex: '1 1 120px' }}
        aria-label={t('common.player')}
      />
      <input
        className="value-input"
        inputMode="decimal"
        placeholder={t('admin.handicapIndex')}
        value={hcp}
        onChange={(e) => setHcp(e.target.value)}
        onBlur={() => patch({ handicapIndex: parseHandicapIndex(hcp) })}
        aria-label={t('admin.handicapIndex')}
        style={{
          borderColor: player.handicapIndex === null ? 'var(--danger)' : undefined,
        }}
      />
      <select
        className="select-input"
        value={player.teamId}
        onChange={(e) => patch({ teamId: e.target.value as TeamId })}
        style={{ width: 70 }}
        aria-label={t('common.team')}
      >
        {TEAM_IDS.map((teamId) => (
          <option key={teamId} value={teamId}>
            {teamId}
          </option>
        ))}
      </select>
      <select
        className="select-input"
        value={player.position}
        onChange={(e) =>
          patch({ position: Number(e.target.value) as Player['position'] })
        }
        style={{ width: 70 }}
        aria-label={t('admin.position')}
      >
        {POSITIONS.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      {player.handicapIndex === null && (
        <span className="hint" style={{ color: 'var(--danger)' }}>
          {t('admin.missingHandicap')}
        </span>
      )}
    </div>
  )
}

function AccessEditor() {
  const { state, store } = useData()
  const access = state.access
  const [draft, setDraft] = useState('')
  if (!access) return null

  type AccessKey = 'adminEmails' | 'writerEmails' | 'writerUids'
  function update(key: AccessKey, values: string[]) {
    store.dispatch({ kind: 'updateAccess', access: { ...access!, [key]: values } })
  }

  function list(key: AccessKey, label: string) {
    const values = access![key]
    return (
      <div className="field-stack">
        <span className="section-title">{label}</span>
        <div className="chip-row">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              onClick={() =>
                confirm(`${t('common.cancel')}: ${value}?`) &&
                update(
                  key,
                  values.filter((v) => v !== value),
                )
              }
            >
              {value} ×
            </button>
          ))}
        </div>
      </div>
    )
  }

  function add(key: AccessKey) {
    const value = draft.trim().toLowerCase()
    if (!value || access![key].includes(value)) return
    update(key, [...access![key], value])
    setDraft('')
  }

  return (
    <Section title={t('admin.access')}>
      <p className="hint">{t('admin.accessHint')}</p>
      <div className="card section">
        {list('adminEmails', t('admin.adminEmails'))}
        {list('writerEmails', t('admin.writerEmails'))}
        {list('writerUids', t('admin.writerUids'))}
        <input
          className="name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('admin.addEmail')}
          inputMode="email"
          autoCapitalize="none"
        />
        <div className="footer-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => add('writerEmails')}
          >
            + {t('admin.writerEmails')}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => add('adminEmails')}
          >
            + {t('admin.adminEmails')}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => add('writerUids')}
          >
            + uid
          </button>
        </div>
      </div>
    </Section>
  )
}
