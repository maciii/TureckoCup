import { useEffect, useState } from 'react'
import type { AwardResult, AwardsSummary } from '../evaluations/awards'
import { awardSignature, awardsOf } from '../evaluations/awards'
import { dynamicKey, t } from '../i18n'
import { shortName } from '../model/round'
import type { Player, PlayerId } from '../model/types'
import { STORAGE_PREFIX } from '../data/store'
import { TeamBadge } from './common'

/**
 * Odznaky zájezdu (vzor Apple awards): medaile s držitelem a hodnotou,
 * klepnutí otevře tabulku všech hráčů. Přihlášenému hráči se při otevření
 * aplikace jednou pogratuluje k novému odznaku (intro s animací); co už
 * viděl, si pamatuje prohlížeč podle otisku odznaku (hodnota + držitelé).
 */

const SEEN_KEY = `${STORAGE_PREFIX}awardsSeen.v1`

function readSeen(playerId: PlayerId): string[] {
  try {
    const raw = localStorage.getItem(`${SEEN_KEY}:${playerId}`)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function writeSeen(playerId: PlayerId, signatures: string[]): void {
  try {
    localStorage.setItem(`${SEEN_KEY}:${playerId}`, JSON.stringify(signatures))
  } catch {
    /* soukromé okno - gratulace se ukáže znovu, nic horšího */
  }
}

function countLabel(result: AwardResult, value: number): string {
  return t(dynamicKey('award', result.award.id, 'count'), { count: value })
}

function holdersLabel(result: AwardResult, players: Player[]): string {
  if (result.holders.length === 0) return t('awards.unclaimed')
  return result.holders.map((id) => shortName(players, id)).join(' + ')
}

/** Medaile - čistě CSS, znak je text. */
export function AwardMedal({
  result,
  size = 'md',
  mine = false,
}: {
  result: AwardResult
  size?: 'md' | 'lg'
  mine?: boolean
}) {
  const empty = result.holders.length === 0
  return (
    <span
      className={`award ${result.award.tone} ${size}${empty ? ' empty' : ''}${mine ? ' mine' : ''}`}
      aria-hidden="true"
    >
      <span className="award-mark">{result.award.mark}</span>
    </span>
  )
}

export function AwardsSection({
  summary,
  players,
  me,
}: {
  summary: AwardsSummary
  players: Player[]
  me: PlayerId | null
}) {
  const [open, setOpen] = useState<AwardResult | null>(null)
  if (summary.rounds === 0) return null
  return (
    <section className="awards" aria-label={t('awards.title')}>
      <div className="section-head gold">
        <span className="bar" />
        <div className="section-main">
          <div className="section-row">
            <h2>{t('awards.title')}</h2>
            <span className="section-right">
              {t('awards.after', { count: summary.rounds })}
            </span>
          </div>
          <p className="section-note">{t('awards.hint')}</p>
        </div>
      </div>
      <ul className="awards-row">
        {summary.results.map((result, index) => {
          const mine = me !== null && result.holders.includes(me)
          return (
            <li key={result.award.id} style={{ '--i': index } as React.CSSProperties}>
              <button
                type="button"
                className={`award-btn${mine ? ' mine' : ''}`}
                onClick={() => setOpen(result)}
                aria-label={`${t(dynamicKey('award', result.award.id, 'name'))}: ${holdersLabel(result, players)}`}
              >
                <AwardMedal result={result} mine={mine} />
                <span className="award-name">
                  {t(dynamicKey('award', result.award.id, 'name'))}
                </span>
                <span className="award-holder">{holdersLabel(result, players)}</span>
                {result.holders.length > 0 && (
                  <span className="award-value">{countLabel(result, result.value)}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <AwardSheet
          result={open}
          players={players}
          me={me}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/** Tabulka všech hráčů v jedné statistice. */
function AwardSheet({
  result,
  players,
  me,
  onClose,
}: {
  result: AwardResult
  players: Player[]
  me: PlayerId | null
  onClose: () => void
}) {
  const name = t(dynamicKey('award', result.award.id, 'name'))
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet award-sheet"
        role="dialog"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="award-sheet-head">
          <AwardMedal result={result} size="lg" />
          <h2>{name}</h2>
          <p className="hint">{t(dynamicKey('award', result.award.id, 'description'))}</p>
        </div>
        <ol className="list award-table">
          {result.rows.map((row) => {
            const player = players.find((p) => p.id === row.id)
            const holder = result.holders.includes(row.id)
            return (
              <li
                key={row.id}
                className={`row${holder ? ' leader' : ''}${row.id === me ? ' me' : ''}`}
              >
                <span className="position">{row.value > 0 ? row.position : '·'}</span>
                <span className="row-main">
                  <span className="row-title">
                    <TeamBadge teamId={player?.teamId} />
                    <span>{shortName(players, row.id)}</span>
                    {row.id === me && (
                      <span className="tag gold">{t('awards.yours')}</span>
                    )}
                  </span>
                </span>
                <span className="award-table-value">{countLabel(result, row.value)}</span>
              </li>
            )
          })}
        </ol>
        <div className="px" style={{ paddingTop: 14 }}>
          <button type="button" className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Gratulace k novým odznakům po otevření aplikace: jeden odznak za druhým,
 * konfety, medaile se roztočí. Zavřením se odznaky označí za viděné.
 */
export function AwardIntro({
  summary,
  players,
  me,
}: {
  summary: AwardsSummary
  players: Player[]
  me: PlayerId | null
}) {
  const [queue, setQueue] = useState<AwardResult[] | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!me || summary.rounds === 0) return
    const seen = new Set(readSeen(me))
    const fresh = awardsOf(summary, me).filter((r) => !seen.has(awardSignature(r)))
    // Fronta se nastaví jednou; další změny během prohlížení ji nepřeskládají.
    if (fresh.length > 0) {
      setQueue((current) => current ?? fresh)
      setIndex(0)
    }
  }, [summary, me])

  if (!queue || !me) return null
  const current = queue[index]
  if (!current) return null

  function close() {
    if (!me || !queue) return
    writeSeen(me, [...new Set([...readSeen(me), ...queue.map(awardSignature)])])
    setQueue(null)
  }

  const others = current.holders.filter((id) => id !== me)
  const last = index === queue.length - 1
  return (
    <div
      className="award-intro"
      role="dialog"
      aria-label={t('awards.intro.title', { name: shortName(players, me) })}
    >
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            style={
              {
                '--x': `${(i * 53) % 100}%`,
                '--d': `${(i % 6) * 0.35}s`,
                '--r': `${(i * 47) % 360}deg`,
                '--c': [
                  'var(--gold-bright)',
                  'var(--red)',
                  'var(--on-dark)',
                  'var(--team-a)',
                ][i % 4],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <p className="award-intro-eyebrow">{t('awards.intro.lead')}</p>
      <AwardMedal key={current.award.id} result={current} size="lg" />
      <h2 className="award-intro-title">
        {t('awards.intro.title', { name: shortName(players, me) })}
      </h2>
      <p className="award-intro-name">
        {t(dynamicKey('award', current.award.id, 'name'))}
      </p>
      <p className="award-intro-detail">
        {countLabel(current, current.value)} ·{' '}
        {t('awards.after', { count: summary.rounds })}
        {others.length > 0 &&
          ` · ${t('awards.intro.shared', { names: others.map((id) => shortName(players, id)).join(', ') })}`}
      </p>
      <p className="award-intro-desc">
        {t(dynamicKey('award', current.award.id, 'description'))}
      </p>
      <div className="award-intro-actions">
        {queue.length > 1 && (
          <span className="award-intro-count">
            {t('awards.intro.count', { index: index + 1, total: queue.length })}
          </span>
        )}
        <button
          type="button"
          className="btn primary award-intro-btn"
          onClick={() => (last ? close() : setIndex(index + 1))}
        >
          {last ? t('awards.intro.close') : t('awards.intro.next')}
        </button>
      </div>
    </div>
  )
}
