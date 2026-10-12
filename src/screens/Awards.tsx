import { useEffect, useState } from 'react'
import type { AwardId, AwardResult, AwardsSummary } from '../evaluations/awards'
import { awardSignature, awardsOf } from '../evaluations/awards'
import { dynamicKey, t } from '../i18n'
import { shortName } from '../model/round'
import type { Player, PlayerId, TournamentRound } from '../model/types'
import { STORAGE_PREFIX } from '../data/store'
import { TeamBadge, formatDate } from './common'
import { bleat, sigh } from './bleat'
import PlayerSkinsBreakdown from './PlayerSkinsBreakdown'

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

/** Ražené znaky; co nemá vlastní kresbu, nese text z definice odznaku. */
const EMBLEMS: Partial<Record<AwardId, React.ReactNode>> = {
  birdie: (
    <svg viewBox="0 0 24 24">
      <path d="M21 5l-6 2-3-3c-2 0-4 2-4 5v2l-5 3 1 1 4-1v2c0 2 2 4 4 4h3l-1-2c2 0 4-2 4-5V8l3-2z" />
    </svg>
  ),
  eagle: (
    <svg viewBox="0 0 24 24">
      <path d="M12 4l2 3 8-1-6 4 2 2-4 1v6l-2-2-2 2v-6l-4-1 2-2-6-4 8 1z" />
    </svg>
  ),
  streak: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2c1 4 5 5 5 11a5 5 0 01-10 0c0-2 1-3 1-3s0 3 2 3c1 0 1-2 0-4 0-3 2-5 2-7z" />
    </svg>
  ),
  skins: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <g fill="rgba(0,0,0,0.35)">
        <circle cx="9" cy="9" r="1.3" />
        <circle cx="14" cy="8" r="1.3" />
        <circle cx="12" cy="13" r="1.3" />
        <circle cx="8" cy="14" r="1.3" />
        <circle cx="16" cy="13" r="1.3" />
      </g>
    </svg>
  ),
  collector: (
    // Tři medaile přes sebe - sbírka.
    <svg viewBox="0 0 24 24">
      <circle cx="8" cy="13" r="5" opacity="0.6" />
      <circle cx="16" cy="13" r="5" opacity="0.6" />
      <circle cx="12" cy="10" r="5.5" />
      <path d="M9 3h6l-1.5 3h-3z" />
    </svg>
  ),
  none: (
    // Klasický kosočtverec s čárkami, točí se (CSS).
    <span className="rhombus-spin">
      <svg viewBox="0 0 24 24" className="rhombus">
        <path d="M12 4 L17.5 12 L12 20 L6.5 12 Z" />
        <path d="M12 7.5 L12 16.5" />
        <path d="M12 2 L12 0.5 M15.5 3.5 L16.5 2.3 M8.5 3.5 L7.5 2.3 M19.5 8 L21 7.2 M4.5 8 L3 7.2 M19.5 16 L21 16.8 M4.5 16 L3 16.8 M15.5 20.5 L16.5 21.7 M8.5 20.5 L7.5 21.7 M12 22 L12 23.5" />
      </svg>
    </span>
  ),
  glutton: (
    // Jehně na rožni: točí se nad ohněm (CSS), rožeň stojí.
    <span className="lamb-scene">
      <svg className="lamb-fire" viewBox="0 0 40 20">
        <path
          className="f1"
          d="M8 20c-4-4-2-9 2-12-1 4 2 5 3 8 1-3 3-4 2-8 5 3 5 9 1 12z"
        />
        <path
          className="f2"
          d="M20 20c-5-5-3-11 2-15-1 5 3 6 4 10 1-4 4-5 2-10 6 4 6 11 0 15z"
        />
        <path
          className="f3"
          d="M32 20c-4-4-2-8 1-11 0 3 2 4 3 7 1-2 2-3 2-7 4 3 4 8 0 11z"
        />
      </svg>
      <span className="lamb-spin">
        <svg viewBox="0 0 48 28">
          <ellipse cx="24" cy="14" rx="15" ry="8" />
          <circle cx="42" cy="11" r="4.5" />
          <path d="M44 7l2-3 1 4z" />
          <path
            d="M14 20l-3 6M20 21l-2 6M28 21l2 6M34 20l3 6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M9 12c-3-1-5 1-5 3 2 0 4 0 5-1z" />
        </svg>
      </span>
      <svg className="lamb-spit" viewBox="0 0 56 6">
        <rect x="0" y="2" width="56" height="2" rx="1" />
        <rect x="0" y="0" width="3" height="6" rx="1" />
        <rect x="53" y="0" width="3" height="6" rx="1" />
      </svg>
    </span>
  ),
}

/**
 * Medaile (vzor Apple Fitness): broušený zlatý okraj, tloušťka hrany
 * z několika vrstev, smaltovaný střed s raženým znakem a rub se jménem,
 * počtem a datem. Točí se kolem svislé osy; prázdná medaile stojí a je šedá.
 */
export function AwardMedal({
  result,
  players,
  date,
  size = 'md',
  mine = false,
}: {
  result: AwardResult
  players: Player[]
  date: string | null
  size?: 'sm' | 'md' | 'lg'
  mine?: boolean
}) {
  const empty = result.holders.length === 0
  const emblem = EMBLEMS[result.award.id]
  return (
    <span
      className={`medal ${size}${empty ? ' empty' : ''}${mine ? ' mine' : ''}`}
      aria-hidden="true"
    >
      <span className="medal-spin">
        <span className={`medal-face front ${result.award.tone}`}>
          <span className="medal-enamel">
            {emblem ?? <span className="medal-mark">{result.award.mark}</span>}
          </span>
          <span className="medal-shine" />
        </span>
        <span className="medal-edge e1" />
        <span className="medal-edge e2" />
        <span className="medal-edge e3" />
        <span className="medal-edge e4" />
        <span className="medal-edge e5" />
        <span className="medal-face rear">
          <span className="medal-engraved">
            {empty ? (
              <span>{t('awards.unclaimed')}</span>
            ) : (
              <>
                <b>{result.value}</b>
                <span>{holdersLabel(result, players)}</span>
                {date && <span>{formatDate(date)}</span>}
              </>
            )}
          </span>
        </span>
      </span>
    </span>
  )
}

export function AwardsSection({
  summary,
  players,
  me,
  rounds = [],
}: {
  summary: AwardsSummary
  players: Player[]
  me: PlayerId | null
  /** Kola turnaje - pro rozpis odznaků, které ho mají (Skinař). */
  rounds?: TournamentRound[]
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
                onClick={() => {
                  // Nenažranec: žalostné bečení jehněte na rožni.
                  if (result.award.id === 'glutton') bleat()
                  // Ani piču: vzdech.
                  if (result.award.id === 'none') sigh()
                  setOpen(result)
                }}
                aria-label={`${t(dynamicKey('award', result.award.id, 'name'))}: ${holdersLabel(result, players)}`}
              >
                <AwardMedal
                  result={result}
                  players={players}
                  date={summary.date}
                  mine={mine}
                />
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
          date={summary.date}
          me={me}
          rounds={rounds}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/** Tabulka všech hráčů v jedné statistice. */
export function AwardSheet({
  result,
  players,
  date,
  me,
  rounds,
  onClose,
}: {
  result: AwardResult
  players: Player[]
  date: string | null
  me: PlayerId | null
  rounds: TournamentRound[]
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
          <AwardMedal result={result} players={players} date={date} size="lg" />
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
        {result.award.id === 'skins' && rounds.length > 0 && (
          <PlayerSkinsBreakdown rounds={rounds} players={players} me={me} />
        )}
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
      <div className="award-intro-hero" key={current.award.id}>
        <AwardMedal result={current} players={players} date={summary.date} size="lg" />
        {Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2
          const radius = 84 + (i % 3) * 16
          return (
            <span
              key={i}
              className="spark"
              style={
                {
                  '--x': `${Math.cos(angle) * radius}px`,
                  '--y': `${Math.sin(angle) * radius}px`,
                  '--d': `${(i % 4) * 0.08}s`,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
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
