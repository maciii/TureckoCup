import type {
  Access,
  BonusConfig,
  GameConfig,
  Player,
  PlayerId,
  RoundStatus,
  TeamId,
  TournamentRound,
} from '../model/types'
import { MAX_STROKES, PICKED_UP } from '../model/types'
import { holeKey, holeOrder, isEntered, parAt, strokesReceived } from '../model/round'
import { BONUSES, DEFAULT_BONUS_CONFIG } from '../model/bonuses'

/** Extra body testovací verze: výchozí Golfgames hodnoty, navíc birdie za bod a do týmu půl bodu. */
const PREVIEW_BONUSES: BonusConfig = {
  ...DEFAULT_BONUS_CONFIG,
  values: { ...DEFAULT_BONUS_CONFIG.values, birdie: 1 },
  teamPerPoint: 0.5,
}
import { t } from '../i18n'
import type { MessageKey } from '../i18n'
import {
  BOOTSTRAP_ADMIN_EMAIL,
  SEED_PLAYERS,
  SEED_SCHEDULE,
  SEED_TOURNAMENT,
  emptyScoreMaps,
  seedRoundConfig,
} from './seed'

/**
 * Testovací verze: vymyšlený turnaj, jak bude vypadat po čtyřech dnech.
 *
 * Tři kola dohraná, čtvrté rozehrané (první flight v klubovně, druhý na
 * patnácté jamce), páté naplánované. Každé kolo má jinou sadu her, jiné
 * pozice, odpaliště i startovní jamky, aby šla na jednom místě projít každá
 * varianta nastavení. Skóre je náhodné, ale z pevného semínka: všichni na
 * odkazu vidí stejná čísla a dá se o nich mluvit; tlačítko v menu vylosuje
 * nová.
 *
 * Generuje se jen raw skóre a konfigurace - výsledky her počítají stejné
 * evaluace jako v ostrém turnaji.
 */

export const PREVIEW_SEED = 18

/** Malý deterministický generátor (mulberry32) - stejné semínko, stejný turnaj. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Vymyšlené indexy za hráče, kterým v ostrém turnaji zatím chybí. */
const PREVIEW_INDEX: Record<PlayerId, number> = {
  p4: 18.4,
  p5: 21.7,
  p7: 15.2,
  p8: 26.3,
}

export const PREVIEW_PLAYERS: Player[] = SEED_PLAYERS.map((player) => ({
  ...player,
  handicapIndex: player.handicapIndex ?? PREVIEW_INDEX[player.id] ?? 18,
}))

/** Skutečné e-maily jen u ukázkových identit (Mac, Ferry), ostatní vymyšlené. */
export const PREVIEW_ACCESS: Access = {
  adminEmails: [BOOTSTRAP_ADMIN_EMAIL],
  playerEmails: {
    p1: BOOTSTRAP_ADMIN_EMAIL,
    p2: 'pavlos@example.com',
    p3: 'ota@example.com',
    p4: 'soldik@example.com',
    p5: 'jarin@example.com',
    p6: 'bezdekf@gmail.com',
    p7: 'vrbic@example.com',
    p8: 'honza@example.com',
  },
}

function game(
  id: string,
  kind: GameConfig['kind'],
  nameKey: MessageKey | null,
  options: GameConfig['options'],
  teamPoints: GameConfig['teamPoints'] = {},
  extra: Partial<GameConfig> = {},
): GameConfig {
  return {
    id,
    kind,
    ...(nameKey ? { name: t(nameKey) } : {}),
    options,
    countsForTeam: false,
    teamPoints,
    ...extra,
  }
}

/** Dvojice proti dvojici v každém flightu: A1+A2 vs B1+B2 a A3+A4 vs B3+B4. */
function pairSides(positions: Record<TeamId, PlayerId[]>): GameConfig['sides'] {
  const pair = (team: TeamId, from: number) => positions[team].slice(from, from + 2)
  return [
    { id: 'a12', players: pair('A', 0) },
    { id: 'b12', players: pair('B', 0) },
    { id: 'a34', players: pair('A', 2) },
    { id: 'b34', players: pair('B', 2) },
  ]
}

/** Hry každého dne - pokaždé jiná kombinace druhů, formátů a bodování. */
function gamesForDay(day: number, positions: Record<TeamId, PlayerId[]>): GameConfig[] {
  switch (day) {
    case 1:
      return [
        game('stableford', 'individual-stableford', null, { allowance: 1, net: true }),
        game('skins', 'individual-skins', 'preview.game.skinsFlight', {
          allowance: 1,
          net: true,
          scope: 'flight',
          carry: true,
        }),
        game(
          'team-skins',
          'team-skins',
          null,
          { allowance: 1, net: true, carry: true },
          { perSkin: 1 },
          { countsForTeam: true },
        ),
        game(
          'positions',
          'position-duel',
          'preview.game.duelsNet',
          { allowance: 1, net: true, format: 'strokes-net' },
          { win: 1, halve: 0.5 },
          { countsForTeam: true },
        ),
      ]
    case 2:
      return [
        game(
          'stableford-gross',
          'individual-stableford',
          'preview.game.stablefordGross',
          {
            allowance: 1,
            net: false,
          },
        ),
        game('skins-all', 'individual-skins', 'preview.game.skinsAll', {
          allowance: 1,
          net: true,
          scope: 'all',
          carry: true,
        }),
        game(
          'skins-front',
          'individual-skins',
          'preview.game.skinsFront',
          {
            allowance: 1,
            net: true,
            scope: 'flight',
            carry: false,
          },
          {},
          { holes: { from: 0, to: 8 } },
        ),
        game(
          'team-skins',
          'team-skins',
          'preview.game.teamSkinsNoCarry',
          { allowance: 1, net: true, carry: false },
          { perSkin: 1 },
          { countsForTeam: true },
        ),
        game(
          'positions',
          'position-duel',
          'preview.game.duelsMatch',
          { allowance: 1, net: true, format: 'match-play' },
          { win: 1, halve: 0.5 },
          { countsForTeam: true },
        ),
      ]
    case 3:
      return [
        game('stableford-90', 'individual-stableford', 'preview.game.stableford90', {
          allowance: 0.9,
          net: true,
        }),
        game('skins', 'individual-skins', 'preview.game.skinsNoCarry', {
          allowance: 0.9,
          net: true,
          scope: 'flight',
          carry: false,
        }),
        game(
          'four-ball',
          'team-match',
          'preview.game.fourBall',
          { allowance: 0.85, net: true, format: 'match-play' },
          { win: 1, halve: 0.5 },
          { countsForTeam: true, sides: pairSides(positions) },
        ),
        game(
          'positions',
          'position-duel',
          'preview.game.duelsStableford',
          { allowance: 1, net: true, format: 'stableford' },
          { win: 1, halve: 0.5 },
        ),
        game(
          'best-aggregate',
          'best-aggregate',
          'preview.game.bestAggregate',
          // Den 3 ukáže extra body v bodech dvojice.
          { allowance: 0.9, net: true, bonuses: true },
          { win: 1, halve: 0.5 },
          { countsForTeam: true, sides: pairSides(positions) },
        ),
      ]
    default:
      return [
        game('stableford', 'individual-stableford', null, { allowance: 1, net: true }),
        game('skins-gross', 'individual-skins', 'preview.game.skinsGross', {
          allowance: 1,
          net: false,
          scope: 'all',
          carry: true,
        }),
        game(
          'team-skins-back',
          'team-skins',
          'preview.game.teamSkinsBack',
          { allowance: 1, net: true, carry: true },
          { perSkin: 2 },
          { countsForTeam: true, holes: { from: 9, to: 17 } },
        ),
        game(
          'positions',
          'position-duel',
          'preview.game.duelsGross',
          { allowance: 1, net: false, format: 'strokes-gross' },
          { win: 2, halve: 1 },
          { countsForTeam: true },
        ),
      ]
  }
}

/** Pozice kola: ze soupisky, s výměnami, aby se pozice mezi dny lišily. */
function positionsForDay(day: number): Record<TeamId, PlayerId[]> {
  const byTeam = (team: TeamId) =>
    PREVIEW_PLAYERS.filter((p) => p.teamId === team)
      .sort((a, b) => a.position - b.position)
      .map((p) => p.id)
  const positions = { A: byTeam('A'), B: byTeam('B') }
  const swap = (team: TeamId, i: number, j: number) => {
    const list = positions[team]
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
  if (day === 2) swap('A', 0, 1)
  if (day === 3) swap('B', 2, 3)
  if (day === 4) {
    // Ferry (B2) jde do druhého flightu, ať má ukázkový zapisovatel co dopsat.
    swap('A', 1, 2)
    swap('B', 1, 2)
  }
  return positions
}

/** Rány na jamce: netto par nejčastěji, občas birdie, sem tam zvednutí. */
function strokesFor(random: () => number, par: number, received: number): number {
  if (random() < 0.02) return PICKED_UP
  const roll = random()
  const diff =
    roll < 0.01
      ? -2
      : roll < 0.13
        ? -1
        : roll < 0.51
          ? 0
          : roll < 0.83
            ? 1
            : roll < 0.95
              ? 2
              : 3
  return Math.min(MAX_STROKES, Math.max(1, par + received + diff))
}

interface DayPlan {
  status: RoundStatus
  tee: string
  playerTees?: Record<PlayerId, string>
  courseHandicapOverride?: Record<PlayerId, number>
  /** Startovní jamka druhého flightu (index). */
  secondStart?: number
  /** Kolik jamek po pořadí hraní má flight zapsáno; poslední může být rozepsaná. */
  played?: [number, number]
  /** Program kola: hromadný odjezd a tee time obou flightů. */
  departure: string
  teeTimes: [string, string]
}

const DAY_PLANS: DayPlan[] = [
  { status: 'finished', tee: 'yellow', departure: '14:45', teeTimes: ['15:50', '16:00'] },
  {
    status: 'finished',
    tee: 'white',
    playerTees: { p8: 'red' },
    departure: '07:30',
    teeTimes: ['08:40', '08:50'],
  },
  // Start z jedničky i z desítky ve stejnou chvíli.
  {
    status: 'finished',
    tee: 'white',
    secondStart: 9,
    departure: '08:10',
    teeTimes: ['09:20', '09:20'],
  },
  {
    status: 'live',
    tee: 'yellow',
    courseHandicapOverride: { p8: 30 },
    played: [18, 14],
    departure: '11:15',
    teeTimes: ['12:30', '12:40'],
  },
  { status: 'planned', tee: 'white', departure: '08:00', teeTimes: ['09:10', '09:20'] },
]

export function previewRounds(seed = PREVIEW_SEED): TournamentRound[] {
  const random = createRandom(seed)
  return SEED_SCHEDULE.map((entry, index) => {
    const day = index + 1
    const plan = DAY_PLANS[index]!
    const base = seedRoundConfig(entry, PREVIEW_PLAYERS)
    const positions = day <= 4 ? positionsForDay(day) : base.positions
    const round: TournamentRound = {
      ...base,
      status: plan.status,
      defaultTeeId: plan.tee,
      playerTees: plan.playerTees ?? {},
      courseHandicapOverride: plan.courseHandicapOverride ?? {},
      positions,
      flights: [
        {
          players: [positions.A[0]!, positions.A[1]!, positions.B[0]!, positions.B[1]!],
          startHole: 0,
          teeTime: plan.teeTimes[0],
        },
        {
          players: [positions.A[2]!, positions.A[3]!, positions.B[2]!, positions.B[3]!],
          startHole: plan.secondStart ?? 0,
          teeTime: plan.teeTimes[1],
        },
      ],
      departure: plan.departure,
      games: day <= 4 ? gamesForDay(day, positions) : base.games,
      ...emptyScoreMaps(base.playerIds),
    }
    if (plan.status === 'planned') return round

    // Extra body jsou centrální (tournament.bonuses) - hrají se v každém kole.
    const bonusConfig = PREVIEW_BONUSES
    round.flights.forEach((flight, flightIndex) => {
      const holes = plan.played?.[flightIndex] ?? round.course.holeCount
      const order = holeOrder(round, flight)
      order.slice(0, holes + (holes < order.length ? 1 : 0)).forEach((hole, i) => {
        // Rozehraná jamka: zapsaná jen u první dvojice flightu.
        const partial = i === holes
        flight.players.forEach((id, slot) => {
          if (partial && slot >= 2) return
          round.scores[id]![holeKey(hole)] = strokesFor(
            random,
            parAt(round, hole),
            strokesReceived(round, id, hole),
          )
          // Sandie občas, ať je ve scorekartě vidět i obyčejný bonus.
          if ((bonusConfig.values.sandie ?? 0) > 0 && random() < 0.06)
            round.bonuses[id]![holeKey(hole)] = ['sandie']
        })
      })
    })
    // Longest (par 5) a Nearest (par 3) drží na jamce jediný hráč - losuje se
    // z těch, kdo jamku zapsali.
    {
      for (let hole = 0; hole < round.course.holeCount; hole++) {
        for (const bonus of BONUSES) {
          if (!bonus.exclusive || bonus.onlyPar !== parAt(round, hole)) continue
          if ((bonusConfig.values[bonus.id] ?? 0) <= 0) continue
          const entered = round.playerIds.filter((id) => isEntered(round, id, hole))
          const holder = entered[Math.floor(random() * entered.length)]
          if (!holder) continue
          const key = holeKey(hole)
          round.bonuses[holder]![key] = [...(round.bonuses[holder]![key] ?? []), bonus.id]
        }
      }
    }
    return round
  })
}

export function previewState(seed = PREVIEW_SEED) {
  return {
    // Testovací verze ukazuje i centrální pravidlo: zvednutá jamka = 2× par.
    tournament: {
      ...SEED_TOURNAMENT,
      pickup: { timesPar: 2, plus: 0, addStrokes: false },
      bonuses: PREVIEW_BONUSES,
    },
    players: PREVIEW_PLAYERS.map((p) => ({ ...p })),
    rounds: previewRounds(seed),
    access: structuredClone(PREVIEW_ACCESS),
  }
}
