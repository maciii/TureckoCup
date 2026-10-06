/**
 * Zvedne patch verzi v package.json.
 *
 * Pouští se automaticky před každým buildem (npm skript `prebuild`), takže
 * každý build má vlastní číslo verze - to se pak zobrazuje v aplikaci a jde
 * podle něj poznat, co má uživatel v telefonu nainstalované.
 *
 * V CI se přeskakuje: běh na serveru nemá kam změnu commitnout a zvedat verzi
 * při každém průchodu pipeline by jen tvořilo zmatek v historii.
 *
 * Ruční použití:
 *   node scripts/bump-version.mjs          # patch: 0.2.0 -> 0.2.1
 *   node scripts/bump-version.mjs minor    # 0.2.1 -> 0.3.0
 *   node scripts/bump-version.mjs major    # 0.3.0 -> 1.0.0
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

if (process.env.CI) {
  console.log('CI: verze se nezvedá')
  process.exit(0)
}

const level = process.argv[2] ?? 'patch'
if (!['major', 'minor', 'patch'].includes(level)) {
  console.error(`Neznámá úroveň "${level}", čekám major | minor | patch`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const parts = pkg.version.split('.').map(Number)
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  console.error(`Verze "${pkg.version}" není ve tvaru major.minor.patch`)
  process.exit(1)
}

let [major, minor, patch] = parts
if (level === 'major') [major, minor, patch] = [major + 1, 0, 0]
else if (level === 'minor') [minor, patch] = [minor + 1, 0]
else patch += 1

const next = `${major}.${minor}.${patch}`
pkg.version = next
// Trailing newline, ať se soubor nehádá s formátovači.
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`verze ${parts.join('.')} -> ${next}`)
