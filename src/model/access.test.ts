import { describe, expect, it } from 'vitest'
import { decodeAccess, resolveIdentity, setPlayerEmail } from './access'

const BOOTSTRAP = 'mac.kubecka@gmail.com'
const access = {
  adminEmails: ['mac.kubecka@gmail.com'],
  playerEmails: { p1: 'mac.kubecka@gmail.com', p6: 'bezdekf@gmail.com' },
}

describe('decodeAccess', () => {
  it('převede e-maily na malá písmena a zahodí starý tvar', () => {
    expect(
      decodeAccess({
        adminEmails: ['Mac.Kubecka@Gmail.com'],
        writerEmails: ['x@y.cz'],
        writerUids: ['abc'],
        playerEmails: { p2: ' Pavel@Gmail.com ', p3: '', p4: 7 },
      }),
    ).toEqual({
      adminEmails: ['mac.kubecka@gmail.com'],
      playerEmails: { p2: 'pavel@gmail.com' },
    })
  })

  it('poškozená data dají prázdná oprávnění', () => {
    expect(decodeAccess(null)).toEqual({ adminEmails: [], playerEmails: {} })
  })
})

describe('resolveIdentity', () => {
  it('admin, který je zároveň hráčem', () => {
    expect(resolveIdentity(access, 'MAC.kubecka@gmail.com', BOOTSTRAP)).toEqual({
      role: 'admin',
      playerId: 'p1',
    })
  })

  it('hráč podle e-mailu', () => {
    expect(resolveIdentity(access, 'bezdekf@gmail.com', BOOTSTRAP)).toEqual({
      role: 'writer',
      playerId: 'p6',
    })
  })

  it('cizí účet je outsider', () => {
    expect(resolveIdentity(access, 'cizi@gmail.com', BOOTSTRAP).role).toBe('outsider')
  })

  it('bootstrap admin i bez dokumentu oprávnění', () => {
    expect(resolveIdentity(null, BOOTSTRAP, BOOTSTRAP)).toEqual({
      role: 'admin',
      playerId: null,
    })
  })
})

describe('setPlayerEmail', () => {
  it('uloží e-mail malými písmeny', () => {
    const result = setPlayerEmail(access, 'p2', ' Pavel.Toman@Gmail.com')
    expect(result.ok && result.access.playerEmails.p2).toBe('pavel.toman@gmail.com')
  })

  it('prázdná hodnota e-mail smaže', () => {
    const result = setPlayerEmail(access, 'p6', '')
    expect(result.ok && result.access.playerEmails).toEqual({
      p1: 'mac.kubecka@gmail.com',
    })
  })

  it('odmítne neplatný e-mail', () => {
    expect(setPlayerEmail(access, 'p2', 'pavel')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('odmítne e-mail, který už má jiný hráč', () => {
    expect(setPlayerEmail(access, 'p2', 'BEZDEKF@gmail.com')).toEqual({
      ok: false,
      reason: 'taken',
      playerId: 'p6',
    })
  })

  it('stejný e-mail u stejného hráče projde', () => {
    expect(setPlayerEmail(access, 'p6', 'bezdekf@gmail.com').ok).toBe(true)
  })
})
