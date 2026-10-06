/**
 * Množná čísla.
 *
 * Čeština rozlišuje tři tvary (1 jamka / 2–4 jamky / 5 jamek), angličtina dva.
 * Pravidla zná prohlížeč sám přes `Intl.PluralRules`, takže si je nepíšeme -
 * jen podle nich vybereme správný tvar z katalogu.
 */

/** Tvary podle kategorií, které vrací `Intl.PluralRules`. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>

/** Text v katalogu je buď jeden řetězec, nebo sada tvarů podle počtu. */
export type Message = string | PluralForms

/** Instance jsou drahé na vytvoření, tak si je podle jazyka pamatujeme. */
const rules = new Map<string, Intl.PluralRules>()

function rulesFor(locale: string): Intl.PluralRules {
  let instance = rules.get(locale)
  if (!instance) {
    instance = new Intl.PluralRules(locale)
    rules.set(locale, instance)
  }
  return instance
}

/**
 * Vybere tvar odpovídající počtu.
 *
 * Když katalog daný tvar nemá, spadne se na `other` - to je jediný tvar, který
 * má každý jazyk, takže se nikdy nevrátí prázdno.
 */
export function selectPlural(forms: PluralForms, count: number, locale: string): string {
  const category = rulesFor(locale).select(count)
  return forms[category] ?? forms.other ?? ''
}
