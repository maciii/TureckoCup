import { useEffect, useState } from 'react'
import { useData } from '../data'
import {
  SEED_ACCESS,
  SEED_PLAYERS,
  SEED_TOURNAMENT,
  indexSyncOps,
  playerIndexOps,
  positionFixOps,
  rosterOutdated,
  rosterSnapshot,
  seedRounds,
} from '../data/seed'
import { t } from '../i18n'
import { POSITIONS, TEAM_IDS } from '../model/types'
import type { HandicapMode, PickupRule, Player, TeamId } from '../model/types'
import {
  PICKUP_PRESETS,
  pickupFormula,
  pickupPresetId,
  pickupRuleOf,
} from '../model/pickup'
import { formatHandicapIndex, parseHandicapIndex } from '../scoring/whs'
import { navigate } from '../nav'
import { APP_VERSION } from '../version'
import {
  Header,
  Section,
  StatusChip,
  Switch,
  TeamBadge,
  accountName,
  formatDate,
} from './common'
import { isValidEmail, normalizeEmail, setPlayerEmail } from '../model/access'
import { playerName } from '../model/round'

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
                <p className="account-name">{accountName(state.players, meta.account)}</p>
                <p className="hint">
                  {t('admin.signedInAs', {
                    email: meta.account.email,
                    role: t(`admin.role.${meta.role}`),
                  })}
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
                <p className="hint">{t('admin.signInHint')}</p>
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
              <RosterSync />
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

            <RulesEditor />

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

/**
 * Kola si nesou snímek soupisky (pravidlo 5). Když admin změní HCP, tým nebo
 * pozici hráče, plánovaná kola tu změnu nedostanou samy - tady je na jedno
 * klepnutí promítne do všech, která ještě nezačala.
 */
function RosterSync() {
  const { state, store, meta } = useData()
  const mode = state.tournament?.handicapMode ?? 'course'
  // HCP index patří hráči: nedohraná kola se srovnají samy, bez klepání.
  const indexOps = meta.role === 'admin' ? indexSyncOps(state) : []
  useEffect(() => {
    for (const op of indexOps) store.dispatch(op)
    // Zápisy se projeví hned ve stavu; další průchod už nic nenajde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexOps.length])
  const outdated = state.rounds.filter(
    (round) => round.status === 'planned' && rosterOutdated(round, state.players, mode),
  )
  if (outdated.length === 0) return null
  return (
    <div className="px stack" style={{ paddingBottom: 10 }}>
      <p className="notice info" style={{ margin: 0, width: '100%' }}>
        {t('admin.rosterOutdated', { count: outdated.length })}
      </p>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          // Nejdřív srovnat duplicitní pozice v soupisce, pak snímek z ní.
          const fixes = positionFixOps(state.players)
          for (const op of fixes) store.dispatch(op)
          const players = state.players.map((p) => {
            const fix = fixes.find(
              (op) => op.kind === 'updatePlayer' && op.playerId === p.id,
            )
            return fix && fix.kind === 'updatePlayer' ? { ...p, ...fix.patch } : p
          })
          for (const round of outdated) {
            store.dispatch({
              kind: 'updateRound',
              roundId: round.id,
              patch: rosterSnapshot(round, players, mode),
            })
          }
        }}
      >
        {t('admin.rosterSync')}
      </button>
      <p className="hint">{t('admin.rosterSyncHint')}</p>
    </div>
  )
}

/** Centrální pravidla turnaje: zatím jen zvednutá jamka ve hře na rány. */
function RulesEditor() {
  const { state, store } = useData()
  const rule = pickupRuleOf(state.tournament?.pickup)
  const preset = pickupPresetId(rule)
  function save(next: PickupRule) {
    store.dispatch({ kind: 'updateTournament', patch: { pickup: next } })
  }
  const number = (value: string) => Math.max(0, Number(value.replace(',', '.')) || 0)
  const mode = state.tournament?.handicapMode ?? 'course'
  /**
   * Režim je centrální, ale kolo si nese snímek: změna se hned promítne do
   * všech kol, která nejsou dohraná - dohraná si nechají, s čím se hrála.
   */
  function setMode(next: HandicapMode) {
    store.dispatch({ kind: 'updateTournament', patch: { handicapMode: next } })
    for (const round of state.rounds) {
      if (round.status === 'finished' || (round.handicapMode ?? 'course') === next)
        continue
      store.dispatch({
        kind: 'updateRound',
        roundId: round.id,
        patch: { handicapMode: next },
      })
    }
  }
  return (
    <Section title={t('admin.rules')} note={t('admin.rulesHint')} accent="gold">
      <div className="px">
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span className="field-label">{t('admin.handicapMode')}</span>
          <div className="tabs compact" style={{ width: '100%' }}>
            {(['course', 'fixed'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`tab${mode === id ? ' selected' : ''}`}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                {t(`handicapMode.${id}`)}
              </button>
            ))}
          </div>
          <span className="hint">{t(`handicapMode.${mode}.hint`)}</span>
        </div>
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span className="field-label">{t('admin.pickup')}</span>
          <span className="hint">{t('admin.pickupHint')}</span>
          <div className="tabs compact" style={{ width: '100%' }}>
            {[...PICKUP_PRESETS.map((p) => p.id), 'custom' as const].map((id) => (
              <button
                key={id}
                type="button"
                className={`tab${preset === id ? ' selected' : ''}`}
                aria-pressed={preset === id}
                onClick={() => {
                  const found = PICKUP_PRESETS.find((p) => p.id === id)
                  if (found) save(found.rule)
                  else save({ timesPar: 2, plus: 1, addStrokes: false })
                }}
              >
                {t(`pickup.${id}`)}
              </button>
            ))}
          </div>
          <span className="formula" data-testid="pickup-formula">
            {t('admin.pickupFormula', {
              formula: pickupFormula(rule, t('pickup.strokes'), t('pickup.par')),
            })}
          </span>
        </div>
        <div className="field">
          <span className="field-label">{t('admin.pickupTimesPar')}</span>
          <input
            className="input sm num"
            inputMode="decimal"
            aria-label={t('admin.pickupTimesPar')}
            value={String(rule.timesPar).replace('.', ',')}
            onChange={(e) => save({ ...rule, timesPar: number(e.target.value) })}
          />
        </div>
        <div className="field">
          <span className="field-label">{t('admin.pickupPlus')}</span>
          <input
            className="input sm num"
            inputMode="decimal"
            aria-label={t('admin.pickupPlus')}
            value={String(rule.plus).replace('.', ',')}
            onChange={(e) => save({ ...rule, plus: number(e.target.value) })}
          />
        </div>
        <Switch
          label={t('admin.pickupAddStrokes')}
          on={rule.addStrokes}
          onChange={(addStrokes) => save({ ...rule, addStrokes })}
        />
      </div>
    </Section>
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
  const { state, store } = useData()
  const [name, setName] = useState(player.name)
  const [hcp, setHcp] = useState(formatHandicapIndex(player.handicapIndex))
  const savedEmail = state.access?.playerEmails[player.id] ?? ''
  const [email, setEmail] = useState(savedEmail)
  const [emailError, setEmailError] = useState<string | null>(null)
  useEffect(() => {
    setName(player.name)
    setHcp(formatHandicapIndex(player.handicapIndex))
  }, [player])
  useEffect(() => setEmail(savedEmail), [savedEmail])

  function saveEmail() {
    if (!state.access || normalizeEmail(email) === savedEmail) {
      setEmailError(null)
      return
    }
    const result = setPlayerEmail(state.access, player.id, email)
    if (!result.ok) {
      setEmailError(
        result.reason === 'invalid'
          ? t('admin.playerEmailInvalid', { email: email.trim() })
          : t('admin.playerEmailTaken', {
              email: normalizeEmail(email),
              name: playerName(state.players, result.playerId),
            }),
      )
      return
    }
    setEmailError(null)
    store.dispatch({ kind: 'updateAccess', access: result.access })
  }

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
        onBlur={() => {
          const value = parseHandicapIndex(hcp)
          if (value === player.handicapIndex) return
          // Index patří hráči; kola, která nejsou dohraná, ho dostanou rovnou.
          for (const op of playerIndexOps(state, player.id, value)) store.dispatch(op)
        }}
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
      <input
        className="input sm"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={t('admin.playerEmail')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={saveEmail}
        aria-label={`${t('admin.playerEmail')}: ${player.name}`}
        style={{
          flex: '1 1 100%',
          borderColor: emailError || !savedEmail ? 'var(--red)' : undefined,
        }}
      />
      {emailError && (
        <p className="hint" role="alert" style={{ color: 'var(--red)', width: '100%' }}>
          {emailError}
        </p>
      )}
    </div>
  )
}

function AccessEditor() {
  const { state, store } = useData()
  const access = state.access
  const [draft, setDraft] = useState('')
  if (!access) return null

  function update(adminEmails: string[]) {
    store.dispatch({ kind: 'updateAccess', access: { ...access!, adminEmails } })
  }

  function add() {
    const value = normalizeEmail(draft)
    if (!isValidEmail(value) || access!.adminEmails.includes(value)) return
    update([...access!.adminEmails, value])
    setDraft('')
  }

  return (
    <Section title={t('admin.access')} note={t('admin.accessHint')} accent="red">
      <div className="px stack">
        <div className="stack" style={{ paddingTop: 10 }}>
          <span className="menu-label" style={{ padding: 0 }}>
            {t('admin.adminEmails')}
          </span>
          <div className="chip-row">
            {access.adminEmails.length === 0 && (
              <span className="hint">{t('common.dash')}</span>
            )}
            {access.adminEmails.map((value) => (
              <button
                key={value}
                type="button"
                className="chip"
                onClick={() =>
                  confirm(`${t('admin.removeEmail')}: ${value}?`) &&
                  update(access.adminEmails.filter((v) => v !== value))
                }
              >
                {value} ×
              </button>
            ))}
          </div>
        </div>
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
          <button type="button" className="btn sm" onClick={add}>
            {t('admin.addAdmin')}
          </button>
        </div>
      </div>
    </Section>
  )
}
