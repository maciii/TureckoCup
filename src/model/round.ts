import type {
  CourseTee,
  Flight,
  GameConfig,
  HoleKey,
  Player,
  PlayerId,
  TeamId,
  TournamentRound,
} from './types'
import { PICKED_UP } from './types'
import {
  normalizeStrokeIndex,
  playerCourseHandicap,
  strokesForHole,
} from '../scoring/whs'

/**
 * Čisté výpočty nad jedním kolem: kdo kde hraje, kolik ran dostává, co má
 * zapsáno. Evaluace i obrazovky se ptají tady, aby zápis skóre, scorekarta
 * a výsledky nemohly tvrdit každý něco jiného.
 */

/** Vzdaná (zvednutá) jamka ve výpočtech - horší než jakýkoli zapsaný počet ran. */
export const CONCEDED = Number.POSITIVE_INFINITY

export function holeKey(hole: number): HoleKey {
  return String(hole)
}

export function holeCount(round: TournamentRound): number {
  return round.course.holeCount
}

export function parAt(round: TournamentRound, hole: number): number {
  return round.course.pars[hole] ?? 4
}

export function parTotal(round: TournamentRound): number {
  return round.course.pars.reduce((sum, par) => sum + par, 0)
}

/** Zapsané rány; `undefined` = nezapsáno, `0` = zvednuto. */
export function scoreAt(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
): number | undefined {
  const value = round.scores[playerId]?.[holeKey(hole)]
  return typeof value === 'number' ? value : undefined
}

export function isPickedUp(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
): boolean {
  return scoreAt(round, playerId, hole) === PICKED_UP
}

export function isEntered(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
): boolean {
  return scoreAt(round, playerId, hole) !== undefined
}

export function holesPlayed(round: TournamentRound, playerId: PlayerId): number {
  return Object.keys(round.scores[playerId] ?? {}).length
}

/** Součet ran za dohrané jamky (zvednuté se nepočítají). */
export function grossTotal(round: TournamentRound, playerId: PlayerId): number {
  let total = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    const score = scoreAt(round, playerId, hole)
    if (score !== undefined && score !== PICKED_UP) total += score
  }
  return total
}

/** Součet parů jen za jamky, které hráč dohrál - kvůli férovému "vs par". */
export function parForPlayedHoles(round: TournamentRound, playerId: PlayerId): number {
  let total = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    const score = scoreAt(round, playerId, hole)
    if (score !== undefined && score !== PICKED_UP) total += parAt(round, hole)
  }
  return total
}

/** Kolik jamek hráč dohrál (zapsal rány, nezvedl). */
export function holesCompleted(round: TournamentRound, playerId: PlayerId): number {
  let count = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    const score = scoreAt(round, playerId, hole)
    if (score !== undefined && score !== PICKED_UP) count += 1
  }
  return count
}

export function flightOf(round: TournamentRound, playerId: PlayerId): Flight | undefined {
  return round.flights.find((flight) => flight.players.includes(playerId))
}

export function flightIndexOf(round: TournamentRound, playerId: PlayerId): number {
  return round.flights.findIndex((flight) => flight.players.includes(playerId))
}

/** Pořadí hraní jamek flightu (index jamky), od startovní jamky dokola. */
export function holeOrder(round: TournamentRound, flight: Flight | undefined): number[] {
  const count = holeCount(round)
  const start = flight?.startHole ?? 0
  return Array.from({ length: count }, (_, i) => (start + i) % count)
}

export function teamOf(players: Player[], playerId: PlayerId): TeamId | undefined {
  return players.find((p) => p.id === playerId)?.teamId
}

export function playerById(players: Player[], playerId: PlayerId): Player | undefined {
  return players.find((p) => p.id === playerId)
}

export function playerName(players: Player[], playerId: PlayerId): string {
  return playerById(players, playerId)?.name ?? playerId
}

export function shortName(players: Player[], playerId: PlayerId): string {
  const player = playerById(players, playerId)
  if (!player) return playerId
  return player.nick ?? player.name.split(/\s+/)[0] ?? player.name
}

export function teamPlayers(
  round: TournamentRound,
  players: Player[],
  teamId: TeamId,
): PlayerId[] {
  return round.playerIds.filter((id) => teamOf(players, id) === teamId)
}

export function findTee(
  round: TournamentRound,
  teeId: string | undefined,
): CourseTee | undefined {
  if (teeId) {
    const match = round.course.tees.find((tee) => tee.id === teeId)
    if (match) return match
  }
  return (
    round.course.tees.find((tee) => tee.id === round.defaultTeeId) ?? round.course.tees[0]
  )
}

export function playerTee(
  round: TournamentRound,
  playerId: PlayerId,
): CourseTee | undefined {
  return findTee(round, round.playerTees[playerId] ?? round.defaultTeeId)
}

/**
 * Hrací handicap hráče v kole (plný, bez allowance).
 *
 * Ruční přepis administrátora má přednost; bez indexu se počítá nula a UI
 * na to upozorní - kolo se kvůli chybějícímu indexu nesmí zablokovat.
 * V pevném režimu (`handicapMode: 'fixed'`) je hrací HCP zaokrouhlený index
 * bez ohledu na hřiště a odpaliště - stejný počet ran v každém kole.
 */
export function courseHandicapOf(round: TournamentRound, playerId: PlayerId): number {
  const override = round.courseHandicapOverride[playerId]
  if (typeof override === 'number') return override
  const index = round.playerIndex[playerId]
  if (index === null || index === undefined) return 0
  if (round.handicapMode === 'fixed') return Math.round(index)
  return playerCourseHandicap(
    index,
    playerTee(round, playerId),
    holeCount(round),
    parTotal(round),
  )
}

export function hasHandicap(round: TournamentRound, playerId: PlayerId): boolean {
  return (
    typeof round.courseHandicapOverride[playerId] === 'number' ||
    typeof round.playerIndex[playerId] === 'number'
  )
}

/** Hrací handicap po uplatnění allowance hry, zaokrouhlený na celé rány. */
export function playingHandicap(
  round: TournamentRound,
  playerId: PlayerId,
  allowance = 1,
): number {
  return Math.round(courseHandicapOf(round, playerId) * allowance)
}

export function strokeIndexRanked(round: TournamentRound): number[] {
  return normalizeStrokeIndex(round.course.strokeIndex, holeCount(round))
}

/** Rány, které hráč na jamce dostává. */
export function strokesReceived(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
  allowance = 1,
): number {
  const si = strokeIndexRanked(round)[hole] ?? hole + 1
  return strokesForHole(playingHandicap(round, playerId, allowance), si, holeCount(round))
}

/**
 * Netto rána na jamce: `undefined` = nezapsáno, `CONCEDED` = zvednuto, jinak
 * brutto minus přidělené rány. Brutto hra vrací zapsané rány beze změny.
 */
export function netScoreAt(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
  options: { net: boolean; allowance: number },
): number | undefined {
  const score = scoreAt(round, playerId, hole)
  if (score === undefined) return undefined
  if (score === PICKED_UP) return CONCEDED
  if (!options.net) return score
  return score - strokesReceived(round, playerId, hole, options.allowance)
}

/** Rozsah jamek hry (indexy); bez vlastního rozsahu celé kolo. */
export function gameHoles(round: TournamentRound, game: GameConfig): number[] {
  const count = holeCount(round)
  const from = Math.max(0, game.holes?.from ?? 0)
  const to = Math.min(count - 1, game.holes?.to ?? count - 1)
  const holes: number[] = []
  for (let hole = from; hole <= to; hole++) holes.push(hole)
  return holes
}

/** Hráči v flightu i s pořadím, v jakém jsou v soupisce. */
export function flightPlayers(round: TournamentRound, flightIndex: number): PlayerId[] {
  return round.flights[flightIndex]?.players ?? []
}

/** Kolik jamek už na flightu začalo (někdo zapsal). */
export function flightHolesStarted(round: TournamentRound, flight: Flight): number {
  let count = 0
  for (let hole = 0; hole < holeCount(round); hole++) {
    if (flight.players.some((id) => isEntered(round, id, hole))) count += 1
  }
  return count
}

/** Jamka, na kterou flight nejspíš právě došel: první v pořadí hraní bez úplného zápisu. */
export function flightCurrentHole(round: TournamentRound, flight: Flight): number {
  const order = holeOrder(round, flight)
  for (const hole of order) {
    if (!flight.players.every((id) => isEntered(round, id, hole))) return hole
  }
  return order[order.length - 1] ?? 0
}

/** Pozice týmu vždy jako čtyři prvky, prázdné místo `''` (Firestore neumí díru). */
export function normalizePositions(
  current: readonly (PlayerId | null | undefined)[] | undefined,
): PlayerId[] {
  return Array.from({ length: 4 }, (_, index) => current?.[index] ?? '')
}

/**
 * Nový seznam pozic týmu po výběru hráče na pozici `slot` (0-3).
 *
 * Výsledek má vždy čtyři prvky, prázdná pozice je `''`: Firestore neumí díru
 * v poli (`undefined`), a index v poli je číslo pozice, takže prvky nejde
 * vynechat. Když hráč už stojí na jiné pozici, pozice se prohodí - jeden hráč
 * nesmí hrát dva duely.
 */
export function assignPosition(
  current: readonly (PlayerId | null | undefined)[] | undefined,
  slot: number,
  playerId: PlayerId,
): PlayerId[] {
  const list = normalizePositions(current)
  if (slot < 0 || slot > 3) return list
  const previous = list[slot] ?? ''
  if (playerId) {
    const elsewhere = list.findIndex((id, index) => id === playerId && index !== slot)
    if (elsewhere >= 0) list[elsewhere] = previous
  }
  list[slot] = playerId
  return list
}

/**
 * Pořadí hráčů flightu v zápisu a scorekartě: podle dvojic hry se stranami
 * (Four-ball, Best + Součet), jak je admin nastavil - partneři pod sebou,
 * ať sedí s kartou dvojic. Bez takové hry pořadí flightu; hráč mimo strany
 * jde na konec.
 */
export function playOrder(round: TournamentRound, flight: Flight): PlayerId[] {
  const sided = round.games.find(
    (game) =>
      (game.kind === 'team-match' || game.kind === 'best-aggregate') &&
      (game.sides?.length ?? 0) > 0,
  )
  if (!sided) return flight.players
  const inFlight = new Set(flight.players)
  const ordered = (sided.sides ?? []).flatMap((side) =>
    side.players.filter((id) => inFlight.has(id)),
  )
  const seen = new Set(ordered)
  return [...ordered, ...flight.players.filter((id) => !seen.has(id))]
}

/** Jamky s dvojitými body, když to má hra zapnuté (indexy: devítka a osmnáctka). */
export const DOUBLE_HOLES = [8, 17]

/**
 * Násobek bodů hry na jamce: 2 na devítce a osmnáctce s `options.doubleHoles`,
 * jinak 1. Platí tam, kde má jamka body nebo hodnotu (Stableford, skiny,
 * Best + Součet); jamkovka a duely na rány ho neberou.
 */
export function holeMultiplier(options: { doubleHoles?: boolean }, hole: number): number {
  return options.doubleHoles && DOUBLE_HOLES.includes(hole) ? 2 : 1
}

/** Hry, ve kterých hráč (jeho dvojice) na jamce dubloval. */
export function doublesAt(
  round: TournamentRound,
  playerId: PlayerId,
  hole: number,
): string[] {
  const list = round.doubles?.[playerId]?.[holeKey(hole)]
  return Array.isArray(list) ? list : []
}

/** Dublovala strana (dvojice) na jamce v dané hře? Stačí zápis u jednoho z partnerů. */
export function sideDoubled(
  round: TournamentRound,
  gameId: string,
  players: readonly PlayerId[],
  hole: number,
): boolean {
  return players.some((id) => doublesAt(round, id, hole).includes(gameId))
}

/** Který hráč strany nese zápis dublu (pro jeho zrušení); `undefined` = nikdo. */
export function doubleHolder(
  round: TournamentRound,
  gameId: string,
  players: readonly PlayerId[],
  hole: number,
): PlayerId | undefined {
  return players.find((id) => doublesAt(round, id, hole).includes(gameId))
}
