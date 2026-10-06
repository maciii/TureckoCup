import type {
  Access,
  CourseSnapshot,
  GameConfig,
  Player,
  PlayerId,
  TeamId,
  Tournament,
  TournamentRound,
} from '../model/types'
import aspendos from '../courses/aspendos.json'
import lykia from '../courses/lykia-links.json'
import carya from '../courses/belek-carya.json'
import kaya from '../courses/kaya-palazzo-golf-course.json'

/**
 * Výchozí data turnaje podle specifikace v3 (kapitoly 5, 6, 7, 9, 10).
 *
 * Stejný seed používá ukázkový režim i tlačítko „Inicializovat turnaj"
 * v produkci. Rozdělení do týmů a pozic je **zástupné** - specifikace ho
 * neurčuje, administrátor ho upraví v aplikaci. HCP čtyř hráčů chybí (TBD)
 * a doplní se tamtéž.
 */

export const TOURNAMENT_ID = 'tc26'
export const BOOTSTRAP_ADMIN_EMAIL = 'mac.kubecka@gmail.com'

export const SEED_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Mac',
    nick: 'Mac',
    teamId: 'A',
    position: 2,
    handicapIndex: 12.7,
    order: 1,
  },
  {
    id: 'p2',
    name: 'Pavel Tomán',
    nick: 'Pavlos',
    teamId: 'B',
    position: 1,
    handicapIndex: 7.6,
    order: 2,
  },
  {
    id: 'p3',
    name: 'Ota',
    nick: 'Ota',
    teamId: 'A',
    position: 1,
    handicapIndex: 7,
    order: 3,
  },
  {
    id: 'p4',
    name: 'Soldík',
    nick: 'Soldík',
    teamId: 'B',
    position: 3,
    handicapIndex: null,
    order: 4,
  },
  {
    id: 'p5',
    name: 'Jarin',
    nick: 'Jarin',
    teamId: 'A',
    position: 3,
    handicapIndex: null,
    order: 5,
  },
  {
    id: 'p6',
    name: 'Fery',
    nick: 'Fery',
    teamId: 'B',
    position: 2,
    handicapIndex: 9.4,
    order: 6,
  },
  {
    id: 'p7',
    name: 'Radek',
    nick: 'Radek',
    teamId: 'A',
    position: 4,
    handicapIndex: null,
    order: 7,
  },
  {
    id: 'p8',
    name: 'Honza',
    nick: 'Honza',
    teamId: 'B',
    position: 4,
    handicapIndex: null,
    order: 8,
  },
]

export const SEED_TOURNAMENT: Tournament = {
  id: TOURNAMENT_ID,
  name: 'Turecko Cup 26',
  year: 2026,
  teams: { A: { name: 'Team A' }, B: { name: 'Team B' } },
  playerIds: SEED_PLAYERS.map((p) => p.id),
}

export const SEED_ACCESS: Access = {
  adminEmails: [BOOTSTRAP_ADMIN_EMAIL],
  writerEmails: [BOOTSTRAP_ADMIN_EMAIL, 'bezdekf@gmail.com'],
  writerUids: [],
}

const COURSES: Record<string, CourseSnapshot> = {
  aspendos: aspendos as CourseSnapshot,
  'lykia-links': lykia as CourseSnapshot,
  'belek-carya': carya as CourseSnapshot,
  'kaya-palazzo-golf-course': kaya as CourseSnapshot,
}

export const SEED_COURSES: CourseSnapshot[] = Object.values(COURSES)

const SCHEDULE: { number: number; date: string; courseId: string; tee: string }[] = [
  { number: 1, date: '2026-10-08', courseId: 'aspendos', tee: 'white' },
  { number: 2, date: '2026-10-09', courseId: 'lykia-links', tee: 'white' },
  { number: 3, date: '2026-10-10', courseId: 'belek-carya', tee: 'white' },
  { number: 4, date: '2026-10-12', courseId: 'kaya-palazzo-golf-course', tee: 'white' },
  { number: 5, date: '2026-10-13', courseId: 'kaya-palazzo-golf-course', tee: 'white' },
]

/** Výchozí hry kola: Stableford, Skins ve flightu, Team Skins a duely pozic. */
export function defaultGames(): GameConfig[] {
  return [
    {
      id: 'stableford',
      kind: 'individual-stableford',
      options: { allowance: 1, net: true },
      countsForTeam: false,
      teamPoints: {},
    },
    {
      id: 'skins',
      kind: 'individual-skins',
      options: { allowance: 1, net: true, scope: 'flight', carry: true },
      countsForTeam: false,
      teamPoints: {},
    },
    {
      id: 'team-skins',
      kind: 'team-skins',
      options: { allowance: 1, net: true, carry: true },
      countsForTeam: true,
      teamPoints: { perSkin: 1 },
    },
    {
      id: 'positions',
      kind: 'position-duel',
      options: { allowance: 1, net: true, format: 'strokes-net' },
      countsForTeam: false,
      teamPoints: { win: 1, halve: 0.5 },
    },
  ]
}

function positionsOf(players: Player[]): Record<TeamId, PlayerId[]> {
  const byTeam = (teamId: TeamId) =>
    [...players]
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => a.position - b.position)
      .map((p) => p.id)
  return { A: byTeam('A'), B: byTeam('B') }
}

/** Flighty: A1, A2, B1, B2 a A3, A4, B3, B4 - oba týmy v každém flightu. */
function flightsOf(players: Player[]) {
  const positions = positionsOf(players)
  return [
    {
      players: [positions.A[0], positions.A[1], positions.B[0], positions.B[1]].flatMap(
        (id) => (id ? [id] : []),
      ),
      startHole: 0,
    },
    {
      players: [positions.A[2], positions.A[3], positions.B[2], positions.B[3]].flatMap(
        (id) => (id ? [id] : []),
      ),
      startHole: 0,
    },
  ]
}

export function emptyScoreMaps(playerIds: PlayerId[]) {
  return {
    scores: Object.fromEntries(
      playerIds.map((id) => [id, {}]),
    ) as TournamentRound['scores'],
    bonuses: Object.fromEntries(
      playerIds.map((id) => [id, {}]),
    ) as TournamentRound['bonuses'],
  }
}

/** Konfigurace kola ze seedu - bez skóre, to se při re-seedu nikdy nesahá. */
export function seedRoundConfig(
  entry: (typeof SCHEDULE)[number],
  players: Player[],
): Omit<TournamentRound, 'scores' | 'bonuses'> {
  const course = COURSES[entry.courseId]
  if (!course) throw new Error(`Neznámé hřiště ${entry.courseId}`)
  return {
    id: `r${entry.number}`,
    number: entry.number,
    date: entry.date,
    status: 'planned',
    course: structuredClone(course),
    defaultTeeId: entry.tee,
    playerIds: players.map((p) => p.id),
    playerTees: {},
    playerIndex: Object.fromEntries(players.map((p) => [p.id, p.handicapIndex])),
    courseHandicapOverride: {},
    flights: flightsOf(players),
    positions: positionsOf(players),
    games: defaultGames(),
  }
}

export function seedRounds(players: Player[] = SEED_PLAYERS): TournamentRound[] {
  return SCHEDULE.map((entry) => ({
    ...seedRoundConfig(entry, players),
    ...emptyScoreMaps(players.map((p) => p.id)),
  }))
}

export const SEED_SCHEDULE = SCHEDULE
