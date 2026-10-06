import { describe, expect, it } from 'vitest'
import { findInvalidValue } from '../data/ops'
import { assignPosition, normalizePositions } from './round'

describe('assignPosition', () => {
  it('doplní prázdné pozice, nikdy nenechá díru v poli', () => {
    const list = assignPosition([], 2, 'p3')
    expect(list).toEqual(['', '', 'p3', ''])
    expect(findInvalidValue(list)).toBeNull()
  })

  it('zachová ostatní pozice', () => {
    expect(assignPosition(['p1', 'p2', 'p3', 'p4'], 1, 'p5')).toEqual([
      'p1',
      'p5',
      'p3',
      'p4',
    ])
  })

  it('hráč z jiné pozice se prohodí s původním', () => {
    expect(assignPosition(['p1', 'p2', 'p3', 'p4'], 0, 'p3')).toEqual([
      'p3',
      'p2',
      'p1',
      'p4',
    ])
  })

  it('pomlčka pozici vyprázdní', () => {
    expect(assignPosition(['p1', 'p2'], 1, '')).toEqual(['p1', '', '', ''])
  })

  it('poškozená data (null, kratší pole) opraví', () => {
    expect(assignPosition([null, undefined, 'p3'], 3, 'p4')).toEqual(['', '', 'p3', 'p4'])
  })
})

describe('normalizePositions', () => {
  it('vrátí vždy čtyři místa bez děr', () => {
    expect(normalizePositions(undefined)).toEqual(['', '', '', ''])
    expect(normalizePositions(['p1'])).toEqual(['p1', '', '', ''])
  })
})
