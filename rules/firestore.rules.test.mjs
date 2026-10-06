/**
 * Testy security rules v emulátoru Firestore.
 *
 *   npm run test:rules
 *
 * Běží mimo CI (potřebují Javu a stažený emulátor). Každý případ odpovídá
 * jednomu řádku v docs/architecture.md § Role.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

const PROJECT = 'tc26-rules-test'
const TID = 'tc26'
const ADMIN = 'mac.kubecka@gmail.com'
const WRITER = 'fery@example.com'
const STRANGER = 'cizi@example.com'

let env

function user(uid, email, verified = true) {
  return env
    .authenticatedContext(uid, email ? { email, email_verified: verified } : {})
    .firestore()
}

function roundDoc(status = 'live') {
  return {
    id: 'r1',
    number: 1,
    status,
    playerIds: ['p1', 'p2'],
    scores: { p1: {}, p2: {} },
    bonuses: { p1: {}, p2: {} },
    course: { pars: [4, 4], tees: [] },
    flights: [{ players: ['p1', 'p2'], startHole: 0 }],
    games: [],
  }
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8089,
    },
  })
})

after(async () => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'tournaments', TID), { name: 'Turecko Cup 26' })
    await setDoc(doc(db, 'tournaments', TID, 'private', 'access'), {
      adminEmails: [ADMIN],
      writerEmails: [WRITER],
      writerUids: ['anon-1'],
    })
    await setDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), roundDoc())
    await setDoc(doc(db, 'tournaments', TID, 'rounds', 'r2'), {
      ...roundDoc('finished'),
      id: 'r2',
    })
  })
})

function scoreUpdate(db, playerId, hole, value, uid, extra = {}) {
  return updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), {
    [`scores.${playerId}.${hole}`]: value,
    lastEdit: { playerId, hole, by: uid, at: serverTimestamp() },
    ...extra,
  })
}

test('anonym čte turnaj i kolo', async () => {
  const db = env.unauthenticatedContext().firestore()
  await assertSucceeds(getDoc(doc(db, 'tournaments', TID)))
  await assertSucceeds(getDoc(doc(db, 'tournaments', TID, 'rounds', 'r1')))
})

test('anonym nečte oprávnění a nezapisuje', async () => {
  const db = env.unauthenticatedContext().firestore()
  await assertFails(getDoc(doc(db, 'tournaments', TID, 'private', 'access')))
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 'nobody'))
})

test('zapisovatel zapíše, opraví i smaže jednu buňku', async () => {
  const db = user('w1', WRITER)
  await assertSucceeds(scoreUpdate(db, 'p1', '0', 4, 'w1'))
  await assertSucceeds(scoreUpdate(db, 'p1', '0', 0, 'w1'))
  await assertSucceeds(scoreUpdate(db, 'p1', '0', deleteField(), 'w1'))
})

test('zapisovatel zapíše i s logem úprav v jedné dávce', async () => {
  const db = user('w1', WRITER)
  const batch = writeBatch(db)
  batch.update(doc(db, 'tournaments', TID, 'rounds', 'r1'), {
    'scores.p2.3': 5,
    lastEdit: { playerId: 'p2', hole: '3', by: 'w1', at: serverTimestamp() },
  })
  batch.set(doc(collection(db, 'tournaments', TID, 'rounds', 'r1', 'edits')), {
    playerId: 'p2',
    hole: '3',
    from: null,
    to: 5,
    by: 'w1',
    at: serverTimestamp(),
    clientAt: 'x',
    appVersion: '0.1.0',
  })
  await assertSucceeds(batch.commit())
})

test('zapisovatel nesmí přepsat celou mapu skóre', async () => {
  // Dvě zapsané jamky; přepsání celé mapy by smazalo obě najednou.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'tournaments', TID, 'rounds', 'r1'), {
      'scores.p1.0': 4,
      'scores.p1.1': 5,
    })
  })
  const db = user('w1', WRITER)
  await assertFails(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), {
      scores: { p1: {}, p2: {} },
      lastEdit: { playerId: 'p1', hole: '0', by: 'w1', at: serverTimestamp() },
    }),
  )
})

test('zapisovatel nesmí změnit dvě buňky jedním zápisem', async () => {
  const db = user('w1', WRITER)
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 'w1', { 'scores.p2.0': 5 }))
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 'w1', { 'scores.p1.1': 5 }))
})

test('zapisovatel nesmí podvrhnout lastEdit.by ani čas', async () => {
  const db = user('w1', WRITER)
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 'nekdo-jiny'))
  await assertFails(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), {
      'scores.p1.0': 4,
      lastEdit: { playerId: 'p1', hole: '0', by: 'w1', at: new Date() },
    }),
  )
})

test('zapisovatel nesmí zapsat text, zápornou hodnotu ani 25', async () => {
  const db = user('w1', WRITER)
  await assertFails(scoreUpdate(db, 'p1', '0', '5', 'w1'))
  await assertFails(scoreUpdate(db, 'p1', '0', -1, 'w1'))
  await assertFails(scoreUpdate(db, 'p1', '0', 25, 'w1'))
  await assertFails(scoreUpdate(db, 'p1', '18', 4, 'w1'))
  await assertFails(scoreUpdate(db, 'p9', '0', 4, 'w1'))
})

test('zapisovatel nesmí měnit konfiguraci kola ani uzavřené kolo', async () => {
  const db = user('w1', WRITER)
  await assertFails(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), { status: 'finished' }),
  )
  await assertFails(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r2'), {
      'scores.p1.0': 4,
      lastEdit: { playerId: 'p1', hole: '0', by: 'w1', at: serverTimestamp() },
    }),
  )
})

test('přihlášený mimo whitelist nesmí zapisovat', async () => {
  const db = user('s1', STRANGER)
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 's1'))
})

test('neověřený e-mail nestačí', async () => {
  const db = user('w2', WRITER, false)
  await assertFails(scoreUpdate(db, 'p1', '0', 4, 'w2'))
})

test('anonymní účet ve writerUids smí zapisovat', async () => {
  const db = user('anon-1', null)
  await assertSucceeds(scoreUpdate(db, 'p1', '0', 4, 'anon-1'))
})

test('admin mění konfiguraci, oprávnění i skóre hromadně', async () => {
  const db = user('a1', ADMIN)
  await assertSucceeds(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), { status: 'finished' }),
  )
  await assertSucceeds(
    updateDoc(doc(db, 'tournaments', TID, 'rounds', 'r1'), {
      scores: { p1: {}, p2: {} },
    }),
  )
  await assertSucceeds(
    setDoc(doc(db, 'tournaments', TID, 'private', 'access'), {
      adminEmails: [ADMIN],
      writerEmails: [],
      writerUids: [],
    }),
  )
  await assertSucceeds(getDoc(doc(db, 'tournaments', TID, 'private', 'access')))
})

test('bootstrap admin založí turnaj, i když oprávnění ještě neexistují', async () => {
  await env.clearFirestore()
  const db = user('a1', ADMIN)
  await assertSucceeds(setDoc(doc(db, 'tournaments', TID), { name: 'Nový' }))
  await assertSucceeds(
    setDoc(doc(db, 'tournaments', TID, 'private', 'access'), {
      adminEmails: [ADMIN],
      writerEmails: [],
      writerUids: [],
    }),
  )
})

test('log úprav nejde měnit ani mazat', async () => {
  const db = user('w1', WRITER)
  const ref = doc(db, 'tournaments', TID, 'rounds', 'r1', 'edits', 'e1')
  await assertSucceeds(
    setDoc(ref, {
      playerId: 'p1',
      hole: '0',
      from: null,
      to: 4,
      by: 'w1',
      at: serverTimestamp(),
    }),
  )
  await assertFails(updateDoc(ref, { to: 5 }))
})
