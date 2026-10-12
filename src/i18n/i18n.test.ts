import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cs } from './cs'
import { dynamicKey, t } from './index'
import { GAME_KINDS } from '../evaluations'
import { SEED_COURSES } from '../data/seed'

/** Klíče složené za běhu z id musí v katalogu existovat. */
describe('katalog textů', () => {
  it('každý druh hry má název a popis', () => {
    for (const kind of GAME_KINDS) {
      expect(cs, kind).toHaveProperty(`games.${kind}.name`)
      expect(cs, kind).toHaveProperty(`games.${kind}.description`)
    }
  })

  it('stavy kola a formáty duelů mají texty', () => {
    for (const status of ['planned', 'live', 'finished']) {
      expect(cs).toHaveProperty(`status.${status}`)
    }
    for (const format of ['strokes-gross', 'strokes-net', 'stableford', 'match-play']) {
      expect(cs).toHaveProperty(`format.${format}`)
    }
  })

  it('odpaliště turnajových hřišť mají překlad', () => {
    for (const course of SEED_COURSES) {
      for (const tee of course.tees) {
        expect(cs, `${course.id}/${tee.id}`).toHaveProperty(`tee.${tee.id}`)
      }
    }
  })

  it('množná čísla vybírají správný tvar', () => {
    expect(t('common.skins', { count: 1 })).toBe('1 skin')
    expect(t('common.skins', { count: 2 })).toBe('2 skiny')
    expect(t('common.skins', { count: 5 })).toBe('5 skinů')
  })

  it('žádný text není prázdný', () => {
    const empty = Object.entries(cs).filter(
      ([, v]) => typeof v === 'string' && v.trim() === '',
    )
    expect(empty).toEqual([])
  })

  it('neznámý klíč vrátí klíč, ne prázdno', () => {
    expect(t(dynamicKey('games', 'neznama', 'name'))).toBe('games.neznama.name')
  })

  it('každý klíč katalogu se v kódu používá (žádné mrtvé texty)', () => {
    // Klíče skládané za běhu z id se hledají podle předpony.
    const dynamicPrefixes = [
      'games.',
      'bonus.',
      'pickup.',
      'handicapMode.',
      'team.',
      'status.',
      'score.',
      'format.',
      'tee.',
      'admin.role.',
      'admin.signInError.',
      'admin.bonusConfirm.',
      'admin.gameDoubleBy.',
      'award.',
      'teamSkins.mode.',
    ]
    const source = sourceFiles('src')
      .filter((file) => !file.endsWith('cs.ts') && !file.endsWith('.test.ts'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    const unused = Object.keys(cs).filter(
      (key) =>
        !source.includes(`'${key}'`) &&
        !dynamicPrefixes.some((prefix) => key.startsWith(prefix)),
    )
    expect(unused).toEqual([])
  })
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}
