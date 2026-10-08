import type { BonusConfig, PlayerId, TournamentRound } from '../model/types'
import type { BonusDefinition } from '../model/bonuses'
import { availableBonuses, bonusValue, bonusesAt, holdersOf } from '../model/bonuses'
import { shortName } from '../model/round'
import { dynamicKey, t } from '../i18n'
import { useData } from '../data'

interface Props {
  round: TournamentRound
  config: BonusConfig
  /** Hráči flightu - přepínají se nahoře v panelu. */
  playerIds: PlayerId[]
  playerId: PlayerId
  onSelect: (playerId: PlayerId) => void
  hole: number
  onToggle: (bonus: BonusDefinition) => void
  onClose: () => void
}

/**
 * Výběr extra bodů na jedné jamce (vzor Golfgames `BonusSheet`), s přepínačem
 * hráče flightu nahoře. Nabízí jen bonusy zapnuté v turnaji a odpovídající
 * paru; birdie a eagle se nezaškrtávají, počítají se z ran.
 */
export default function BonusSheet({
  round,
  config,
  playerIds,
  playerId,
  onSelect,
  hole,
  onToggle,
  onClose,
}: Props) {
  const { state } = useData()
  const available = availableBonuses(config, round, hole)
  const selected = bonusesAt(round, playerId, hole)
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-label={t('bonus.sheetTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow" style={{ marginTop: 4 }}>
          {t('bonus.sheetSubtitle', {
            name: shortName(state.players, playerId),
            hole: hole + 1,
          })}
        </p>
        <div className="tabs compact px bonus-players">
          {playerIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`tab${id === playerId ? ' selected' : ''}`}
              aria-pressed={id === playerId}
              onClick={() => onSelect(id)}
            >
              {shortName(state.players, id)}
              {bonusesAt(round, id, hole).length > 0 && ' ·'}
            </button>
          ))}
        </div>
        <ul className="bonus-list px">
          {available.map((bonus) => {
            const active = selected.includes(bonus.id)
            const holder = bonus.exclusive
              ? holdersOf(round, hole, bonus.id).find((id) => id !== playerId)
              : undefined
            return (
              <li key={bonus.id}>
                <button
                  type="button"
                  className={`bonus-option${active ? ' selected' : ''}`}
                  aria-pressed={active}
                  onClick={() => onToggle(bonus)}
                >
                  <span className="bonus-check">{active ? '✓' : ''}</span>
                  <span className="bonus-text">
                    <span className="bonus-name">
                      <span className="bonus-mark">{bonus.mark}</span>
                      {t(dynamicKey('bonus', bonus.id, 'name'))}
                    </span>
                    <span className="bonus-desc">
                      {holder
                        ? t('bonus.heldBy', { name: shortName(state.players, holder) })
                        : t(dynamicKey('bonus', bonus.id, 'description'))}
                    </span>
                  </span>
                  <span className="bonus-value">+{bonusValue(config, bonus.id)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="hint px" style={{ paddingTop: 10 }}>
          {available.some((b) => b.exclusive) && t('bonus.exclusiveHint')}
          {(config.confirmLongest || config.confirmNearest) &&
            ` ${t('bonus.confirmHint')}`}
          {available.some((b) => !b.exclusive) && ` ${t('bonus.multiplierHint')}`}
        </p>
        <div className="px" style={{ paddingTop: 14 }}>
          <button type="button" className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
