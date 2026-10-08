import { readFileSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Údržba živých dat turnaje servisním účtem (role Cloud Datastore User).
 *
 * Pouští ho workflow `Live admin` (ručně, s výběrem úlohy); zápisy jdou
 * Admin SDK mimo security rules, proto tu nejsou žádné volné úpravy - jen
 * pojmenované úlohy, každá vypíše, co změnila:
 *
 *   check   nic nemění: soupiska, kola (stav, odpaliště, hry, snímek HCP)
 *   tees    výchozí odpaliště kol podle seedu (žlutá; Lykia Links zlatá)
 *   games   odstraní z kol hru 'bonuses' (extra body jsou od 0.11.0 centrální)
 *   index   HCP index hráčů do nedohraných kol (snímek `playerIndex`)
 *
 *   node scripts/live-admin.mjs check
 *   GOOGLE_APPLICATION_CREDENTIALS=klíč.json VITE_FIREBASE_PROJECT_ID=turecko-cup
 */

const TASKS = ['check', 'tees', 'games', 'index']
const task = process.argv[2]
if (!TASKS.includes(task)) {
  console.error(`Použití: node scripts/live-admin.mjs <${TASKS.join('|')}>`)
  process.exit(2)
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'turecko-cup'
const tournamentId = process.env.VITE_TOURNAMENT_ID || 'tc26'
initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const root = db.collection('tournaments').doc(tournamentId)

/** Odpaliště podle seedu: žlutá všude, Lykia Links žlutá nemá - zlatá. */
const TEES = { r1: 'yellow', r2: 'gold', r3: 'yellow', r4: 'yellow', r5: 'yellow' }

const players = (await root.collection('players').get()).docs.map((d) => d.data())
const rounds = (await root.collection('rounds').get()).docs
  .map((d) => d.data())
  .sort((a, b) => a.number - b.number)
const tournament = (await root.get()).data()

function fmt(value) {
  return value === null || value === undefined ? '–' : String(value)
}

function report() {
  console.log(
    `Turnaj ${tournament?.name ?? tournamentId}: ${players.length} hráčů, ${rounds.length} kol`,
  )
  console.log(
    `  pravidla: pickup=${JSON.stringify(tournament?.pickup ?? null)} handicapMode=${fmt(tournament?.handicapMode)} bonuses=${tournament?.bonuses ? 'nastaveno' : 'výchozí'}`,
  )
  for (const team of ['A', 'B']) {
    const members = players
      .filter((p) => p.teamId === team)
      .sort((a, b) => a.position - b.position)
      .map((p) => `${p.position} ${p.name} ${fmt(p.handicapIndex)}`)
    console.log(`  ${tournament?.teams?.[team]?.name ?? team}: ${members.join(' · ')}`)
  }
  for (const round of rounds) {
    const stale = players.filter(
      (p) => (round.playerIndex?.[p.id] ?? null) !== p.handicapIndex,
    )
    const tee = round.course?.tees?.find((t) => t.id === round.defaultTeeId)
    console.log(
      `  ${round.id} ${round.status} ${round.course?.name} · odpaliště ${round.defaultTeeId} (${tee ? `${tee.courseRating}/${tee.slopeRating}` : '?'})` +
        ` · hry ${round.games.map((g) => g.kind).join(', ')}` +
        (stale.length ? ` · STARÝ INDEX: ${stale.map((p) => p.name).join(', ')}` : ''),
    )
  }
}

async function tees() {
  for (const round of rounds) {
    const want = TEES[round.id]
    if (!want || round.defaultTeeId === want) continue
    if (!round.course?.tees?.some((t) => t.id === want)) {
      console.log(
        `  ${round.id}: hřiště ${round.course?.name} nemá odpaliště ${want}, nechávám ${round.defaultTeeId}`,
      )
      continue
    }
    await root.collection('rounds').doc(round.id).update({ defaultTeeId: want })
    console.log(`  ${round.id}: odpaliště ${round.defaultTeeId} -> ${want}`)
  }
}

async function games() {
  for (const round of rounds) {
    const kept = round.games.filter((g) => g.kind !== 'bonuses')
    if (kept.length === round.games.length) continue
    await root.collection('rounds').doc(round.id).update({ games: kept })
    console.log(
      `  ${round.id}: odstraněna hra Extra body (${round.games.length - kept.length}×)`,
    )
  }
}

async function index() {
  for (const round of rounds) {
    if (round.status === 'finished') continue
    const playerIndex = { ...round.playerIndex }
    const changed = []
    for (const p of players) {
      if ((playerIndex[p.id] ?? null) === p.handicapIndex) continue
      playerIndex[p.id] = p.handicapIndex
      changed.push(
        `${p.name} ${fmt(round.playerIndex?.[p.id])} -> ${fmt(p.handicapIndex)}`,
      )
    }
    if (changed.length === 0) continue
    await root.collection('rounds').doc(round.id).update({ playerIndex })
    console.log(`  ${round.id}: ${changed.join(', ')}`)
  }
}

console.log(`Úloha: ${task} (projekt ${projectId})`)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
  console.log(`Účet: ${key.client_email ?? '?'}`)
}
report()
if (task === 'tees') await tees()
if (task === 'games') await games()
if (task === 'index') await index()
if (task !== 'check') console.log('Hotovo.')
