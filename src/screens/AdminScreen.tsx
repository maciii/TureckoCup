import { useEffect, useState } from 'react'
import { useData } from '../data'
import { SEED_ACCESS, SEED_PLAYERS, SEED_TOURNAMENT, seedRounds } from '../data/seed'
import { t } from '../i18n'
import { POSITIONS, TEAM_IDS } from '../model/types'
import type { Player, TeamId } from '../model/types'
import { formatHandicapIndex, parseHandicapIndex } from '../scoring/whs'
import { navigate } from '../nav'
import { APP_VERSION } from '../version'
import { Header, Section, StatusChip, TeamBadge, formatDate } from './common'

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

  const syncLabel =
    meta.mode === 'local'
      ? t('admin.sync.local')
      : meta.status === 'offline'
        ? t('admin.sync.offline')
        : meta.status === 'error'
          ? t('admin.sync.error')
          : t('admin.sync.synced')

  return (
    <div className="screen">
      <Header title={t('admin.title')} />

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

        <Section
          title={t('admin.account')}
          accent="navy"
          right={
            <span>
              <span className={`status-dot ${meta.status}`} />
              {syncLabel}
            </span>
          }
        >
          <div className="px stack">
            {meta.account ? (
              <>
                <p className="account-name">{meta.account.name}</p>
                <p className="hint">
                  {meta.account.anonymous ? (
                    <span className="uid">
                      {t('admin.yourUid', { uid: meta.account.uid })}
                    </span>
                  ) : (
                    meta.account.email
                  )}{' '}
                  · {t(`admin.role.${meta.role}`)}
                </p>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void store.signOut()}
                >
                  {t('admin.signOut')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!meta.authReady}
                  onClick={() => void store.signIn()}
                >
                  {meta.authReady ? t('admin.signIn') : t('admin.signingIn')}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void store.signInAnonymously()}
                >
                  {t('admin.signInAnonymous')}
                </button>
                <p className="hint">{t('admin.signInAnonymousHint')}</p>
              </>
            )}
            <p className="hint">{t('common.version', { version: APP_VERSION })}</p>
          </div>
        </Section>

        {isAdmin && !state.tournament && (
          <Section
            title={t('admin.initialize')}
            note={t('admin.initializeHint')}
            accent="fairway"
          >
            <div className="px">
              <button type="button" className="btn primary" onClick={initialize}>
                {t('admin.initialize')}
              </button>
            </div>
          </Section>
        )}

        {!isAdmin && meta.account && <p className="notice">{t('admin.notAdmin')}</p>}

        {isAdmin && state.tournament && (
          <>
            <Section title={t('admin.rounds')} accent="fairway">
              <div className="list">
                {state.rounds.map((round) => (
                  <button
                    key={round.id}
                    type="button"
                    className={`row${round.status === 'live' ? ' live' : ''}`}
                    onClick={() => navigate({ view: 'adminRound', roundId: round.id })}
                  >
                    <span className="row-main">
                      <span className="row-title">
                        <span>
                          {t('round.title', { number: round.number })} ·{' '}
                          {round.course.name}
                        </span>
                      </span>
                      <span className="row-meta">
                        {formatDate(round.date)} · <StatusChip status={round.status} />
                      </span>
                    </span>
                    <span className="chev">›</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title={t('admin.players')}
              note={t('admin.playersHint')}
              accent="gold"
            >
              <div className="px">
                {TEAM_IDS.map((teamId) => (
                  <TeamEditor key={teamId} teamId={teamId} />
                ))}
                {state.players.map((player) => (
                  <PlayerEditor key={player.id} player={player} />
                ))}
              </div>
            </Section>

            <AccessEditor />

            <Section title={t('admin.export')} accent="navy">
              <div className="px">
                <button type="button" className="btn ghost" onClick={exportJson}>
                  {t('admin.export')}
                </button>
              </div>
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
          className="input sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          style={{ width: 150 }}
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
    <div className="field" style={{ flexWrap: 'wrap', gap: 6 }}>
      <input
        className="input sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() =>
          name.trim() &&
          name.trim() !== player.name &&
          patch({ name: name.trim(), nick: name.trim().split(/\s+/)[0] })
        }
        style={{ flex: '1 1 110px' }}
        aria-label={t('common.player')}
      />
      <input
        className="input sm num"
        inputMode="decimal"
        placeholder={t('admin.handicapIndex')}
        value={hcp}
        onChange={(e) => setHcp(e.target.value)}
        onBlur={() => patch({ handicapIndex: parseHandicapIndex(hcp) })}
        aria-label={t('admin.handicapIndex')}
        style={{
          width: 64,
          borderColor: player.handicapIndex === null ? 'var(--red)' : undefined,
        }}
      />
      <select
        className="input sm"
        value={player.teamId}
        onChange={(e) => patch({ teamId: e.target.value as TeamId })}
        style={{ width: 58 }}
        aria-label={t('common.team')}
      >
        {TEAM_IDS.map((teamId) => (
          <option key={teamId} value={teamId}>
            {teamId}
          </option>
        ))}
      </select>
      <select
        className="input sm"
        value={player.position}
        onChange={(e) =>
          patch({ position: Number(e.target.value) as Player['position'] })
        }
        style={{ width: 58 }}
        aria-label={t('admin.position')}
      >
        {POSITIONS.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
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
      <div className="stack" style={{ paddingTop: 10 }}>
        <span className="menu-label" style={{ padding: 0 }}>
          {label}
        </span>
        <div className="chip-row">
          {values.length === 0 && <span className="hint">{t('common.dash')}</span>}
          {values.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              onClick={() =>
                confirm(`${t('admin.removeEmail')}: ${value}?`) &&
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
    // E-maily porovnávají rules malými písmeny, uid Firebase ale rozlišuje
    // velikost písmen - převod by anonymnímu zapisovateli oprávnění nikdy nedal.
    const trimmed = draft.trim()
    const value = key === 'writerUids' ? trimmed : trimmed.toLowerCase()
    if (!value || access![key].includes(value)) return
    update(key, [...access![key], value])
    setDraft('')
  }

  return (
    <Section title={t('admin.access')} note={t('admin.accessHint')} accent="red">
      <div className="px stack">
        {list('writerEmails', t('admin.writerEmails'))}
        {list('adminEmails', t('admin.adminEmails'))}
        {list('writerUids', t('admin.writerUids'))}
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('admin.addEmail')}
          aria-label={t('admin.addEmail')}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ marginTop: 8 }}
        />
        <div className="footer-row">
          <button
            type="button"
            className="btn green-soft sm"
            onClick={() => add('writerEmails')}
          >
            + {t('admin.writerEmails')}
          </button>
          <button type="button" className="btn sm" onClick={() => add('adminEmails')}>
            + {t('admin.adminEmails')}
          </button>
          <button type="button" className="btn sm" onClick={() => add('writerUids')}>
            {t('admin.addUid')}
          </button>
        </div>
      </div>
    </Section>
  )
}
