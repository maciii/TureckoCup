/**
 * Datový model turnaje.
 *
 * Tvar odpovídá dokumentům ve Firestore 1:1, takže se nic nepřekládá tam ani
 * zpět - s jedinou výjimkou, kterou Firestore vynucuje: žádné pole uvnitř
 * pole. Proto jsou flighty a strany her seznamy objektů a skóre je mapa
 * `hráč -> číslo jamky (string) -> rány`, ne pole polí.
 *
 * Raw skóre je jediný zdroj pravdy. Všechno ostatní (skiny, Stableford,
 * duely, týmové body, leaderboard) se počítá na klientu při zobrazení.
 */

export type TeamId = 'A' | 'B'
export const TEAM_IDS: TeamId[] = ['A', 'B']

/** `p1`..`p8`, stabilní po celý turnaj. */
export type PlayerId = string

export type Position = 1 | 2 | 3 | 4
export const POSITIONS: Position[] = [1, 2, 3, 4]

export interface Player {
  id: PlayerId
  name: string
  /** Přezdívka do úzkých míst (hlavička jamky, scorekarta). */
  nick?: string
  teamId: TeamId
  position: Position
  /** WHS index; `null` dokud ho administrátor nedoplní. */
  handicapIndex: number | null
  /** Pořadí v soupisce. */
  order: number
}

export interface Tournament {
  id: string
  name: string
  year: number
  teams: Record<TeamId, { name: string }>
  playerIds: PlayerId[]
  createdAt?: string
}

/** Soukromý dokument `private/access` - čte ho jen admin. */
export interface Access {
  adminEmails: string[]
  writerEmails: string[]
  /** Anonymní účty bez e-mailu (záloha pro hráče bez Googlu). */
  writerUids: string[]
}

export interface CourseTee {
  id: string
  name: string
  courseRating?: number
  slopeRating?: number
  par?: number
  /** Délka v metrech. */
  distance?: number
}

/**
 * Hřiště tak, jak si ho nese kolo - hluboká kopie z katalogu golfgames-courses.
 * Pozdější oprava katalogu odehrané kolo nepřepočítá (stejné pravidlo jako
 * v Golfgames).
 */
export interface CourseSnapshot {
  id: string
  name: string
  club?: string
  country?: string
  holeCount: number
  /** Par každé jamky, délka === holeCount. */
  pars: number[]
  /** Stroke index jamek (1 = nejtěžší), délka === holeCount. */
  strokeIndex: number[]
  tees: CourseTee[]
  attribution?: string
  catalogUpdatedAt?: string
}

export type RoundStatus = 'planned' | 'live' | 'finished'

export type GameKind =
  | 'individual-stableford'
  | 'individual-skins'
  | 'team-skins'
  | 'position-duel'
  | 'team-match'

/** Formát duelu pozic a hlavní týmové hry. */
export type DuelFormat = 'strokes-gross' | 'strokes-net' | 'stableford' | 'match-play'

export interface GameSide {
  id: string
  name?: string
  players: PlayerId[]
}

export interface GameOptions {
  /** Podíl hracího handicapu; 1 = plný. */
  allowance: number
  /** Hraje se netto? Brutto hra handicap ignoruje. */
  net: boolean
  /** Skins jednotlivců: v rámci flightu, nebo přes všech osm. */
  scope?: 'flight' | 'all'
  /** Dělená jamka přenáší skin do další. */
  carry?: boolean
  /** Formát duelů (pozice, hlavní hra). */
  format?: DuelFormat
}

/** Kolik týmových bodů hra přináší. */
export interface TeamPointsRule {
  /** Za každý vyhraný skin (Team Skins). */
  perSkin?: number
  /** Za vyhraný duel/zápas. */
  win?: number
  /** Za remízu duelu/zápasu. */
  halve?: number
}

/**
 * Jedna hra kola. Kolo jich má seznam a všechny se vyhodnocují nezávisle nad
 * stejnými raw daty - hru jde přidat, změnit i smazat kdykoli, i po dohrání.
 */
export interface GameConfig {
  id: string
  kind: GameKind
  /** Vlastní název do výsledků; bez něj název podle druhu hry. */
  name?: string
  /** Strany (dvojice, týmy); u her jednotlivců chybí. */
  sides?: GameSide[]
  /** Rozsah jamek (indexy od nuly, včetně obou); chybí = celé kolo. */
  holes?: { from: number; to: number }
  options: GameOptions
  /** Vstupuje do hlavního týmového skóre? */
  countsForTeam: boolean
  teamPoints: TeamPointsRule
}

export interface Flight {
  players: PlayerId[]
  /** Index první hrané jamky (0 = jednička, 9 = desítka). */
  startHole: number
}

/** Klíč jamky v mapách skóre: `'0'`..`'17'`. */
export type HoleKey = string

/** Zvednutá jamka. Chybějící klíč znamená nezapsáno. */
export const PICKED_UP = 0

/** Nejvyšší zapsatelný počet ran - pojistka proti překliku. */
export const MAX_STROKES = 20

export type ScoreMap = Record<PlayerId, Record<HoleKey, number>>
export type BonusMap = Record<PlayerId, Record<HoleKey, string[]>>

export interface LastEdit {
  playerId: PlayerId
  hole: HoleKey
  /** uid zapisovatele. */
  by: string
  /** Serverový čas; na klientu Timestamp nebo string. */
  at: unknown
}

export interface TournamentRound {
  id: string
  number: number
  /** ISO datum (YYYY-MM-DD). */
  date: string
  status: RoundStatus
  course: CourseSnapshot
  defaultTeeId: string
  playerIds: PlayerId[]
  /** Odpaliště hráče, když se liší od výchozího. */
  playerTees: Record<PlayerId, string>
  /** Snímek HCP indexů pro tohle kolo - pozdější změna u hráče kolo nepřepočítá. */
  playerIndex: Record<PlayerId, number | null>
  /** Ruční přepis hracího handicapu administrátorem (celé rány). */
  courseHandicapOverride: Record<PlayerId, number>
  flights: Flight[]
  /** Snímek pozic 1-4 pro tohle kolo; index v poli = pozice − 1. */
  positions: Record<TeamId, PlayerId[]>
  games: GameConfig[]
  scores: ScoreMap
  bonuses: BonusMap
  lastEdit?: LastEdit
  note?: string
}

/** Záznam v logu úprav `rounds/{rid}/edits`. */
export interface EditRecord {
  playerId: PlayerId
  hole: HoleKey
  from: number | null
  to: number | null
  by: string
  byEmail?: string
  at: unknown
  clientAt: string
  appVersion: string
}

/** Celý stav turnaje tak, jak ho vidí obrazovky a evaluace. */
export interface TournamentState {
  tournament: Tournament | null
  players: Player[]
  rounds: TournamentRound[]
  /** Jen pro admina; ostatní `null`. */
  access: Access | null
}

export const EMPTY_STATE: TournamentState = {
  tournament: null,
  players: [],
  rounds: [],
  access: null,
}
