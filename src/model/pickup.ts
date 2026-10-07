import type { PickupRule } from './types'

/**
 * Zvednutá jamka ve hře na rány.
 *
 * Stableford dává za zvednutí nulu a ve Skins jamka propadá - tam netřeba
 * nic vymýšlet. Ve hrách na rány (duely pozic a four-ball na brutto nebo
 * netto rány) ale součet potřebuje číslo. Pravidlo je centrální (turnaj),
 * admin ho vybere z presetů nebo zadá vlastní vzorec.
 */

/** Netto dvojbogey: par + 2 + rány z handicapu na jamce. */
export const DEFAULT_PICKUP: PickupRule = { timesPar: 1, plus: 2, addStrokes: true }

export type PickupPresetId = 'netDoubleBogey' | 'doublePar' | 'doubleParPlus2'

export const PICKUP_PRESETS: { id: PickupPresetId; rule: PickupRule }[] = [
  { id: 'netDoubleBogey', rule: DEFAULT_PICKUP },
  { id: 'doublePar', rule: { timesPar: 2, plus: 0, addStrokes: false } },
  { id: 'doubleParPlus2', rule: { timesPar: 2, plus: 2, addStrokes: false } },
]

/** Pravidlo turnaje, nebo výchozí; neúplný záznam ze starších dat se doplní. */
export function pickupRuleOf(rule: Partial<PickupRule> | undefined): PickupRule {
  return {
    timesPar: Number.isFinite(rule?.timesPar) ? (rule!.timesPar as number) : 1,
    plus: Number.isFinite(rule?.plus) ? (rule!.plus as number) : 2,
    addStrokes: rule?.addStrokes ?? true,
  }
}

/** Brutto rány započtené za zvednutou jamku. */
export function pickupStrokes(
  rule: PickupRule,
  par: number,
  strokesReceived: number,
): number {
  return Math.max(
    1,
    Math.round(rule.timesPar * par + rule.plus + (rule.addStrokes ? strokesReceived : 0)),
  )
}

export function pickupPresetId(rule: PickupRule): PickupPresetId | 'custom' {
  const match = PICKUP_PRESETS.find(
    (preset) =>
      preset.rule.timesPar === rule.timesPar &&
      preset.rule.plus === rule.plus &&
      preset.rule.addStrokes === rule.addStrokes,
  )
  return match?.id ?? 'custom'
}

/** Vzorec do UI: `2 × par + 2`, `par + 2 + rány`. */
export function pickupFormula(
  rule: PickupRule,
  strokesLabel: string,
  parLabel: string,
): string {
  const parts: string[] = [
    rule.timesPar === 1 ? parLabel : `${formatNumber(rule.timesPar)} × ${parLabel}`,
  ]
  if (rule.plus > 0) parts.push(formatNumber(rule.plus))
  if (rule.addStrokes) parts.push(strokesLabel)
  return parts.join(' + ')
}

function formatNumber(value: number): string {
  return String(value).replace('.', ',')
}
