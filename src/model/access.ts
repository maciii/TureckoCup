import type { Access, PlayerId } from './types'

/**
 * Kdo se smí přihlásit a za koho.
 *
 * Každý hráč má v `private/access.playerEmails` svůj Google e-mail. Po
 * přihlášení se podle e-mailu pozná, kdo to je (jméno hráče místo
 * Google účtu), a jen hráči a administrátoři smějí zapisovat. Kdo jiný se
 * přihlásí, aplikace ho odhlásí; rules mu stejně nic nepovolí.
 *
 * E-maily se porovnávají malými písmeny - Google je tak vrací a rules
 * porovnávají `request.auth.token.email.lower()`.
 */

export const EMPTY_ACCESS: Access = { adminEmails: [], playerEmails: {} }

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Jednoduchá kontrola tvaru; skutečné ověření dělá přihlášení Googlem. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Bezpečné načtení dokumentu z Firestoru. Starší tvar (writerEmails,
 * writerUids) se ignoruje - zapisovat smí jen hráč s e-mailem nebo admin.
 */
export function decodeAccess(data: unknown): Access {
  if (typeof data !== 'object' || data === null) return { ...EMPTY_ACCESS }
  const record = data as Record<string, unknown>
  const adminEmails = Array.isArray(record.adminEmails)
    ? record.adminEmails
        .filter((v): v is string => typeof v === 'string')
        .map(normalizeEmail)
    : []
  const playerEmails: Record<PlayerId, string> = {}
  if (typeof record.playerEmails === 'object' && record.playerEmails !== null) {
    for (const [playerId, email] of Object.entries(record.playerEmails)) {
      if (typeof email === 'string' && email.trim()) {
        playerEmails[playerId] = normalizeEmail(email)
      }
    }
  }
  return { adminEmails, playerEmails }
}

export function playerIdByEmail(access: Access | null, email: string): PlayerId | null {
  if (!access || !email) return null
  const wanted = normalizeEmail(email)
  const found = Object.entries(access.playerEmails).find(([, value]) => value === wanted)
  return found ? found[0] : null
}

export type Identity =
  | { role: 'admin'; playerId: PlayerId | null }
  | { role: 'writer'; playerId: PlayerId }
  | { role: 'outsider'; playerId: null }

/**
 * Role přihlášeného účtu. Bootstrap admin je admin i bez dokumentu (turnaj
 * ještě nemusí být založený). Admin může být zároveň hráčem.
 */
export function resolveIdentity(
  access: Access | null,
  email: string,
  bootstrapAdminEmail: string,
): Identity {
  const normalized = normalizeEmail(email)
  const playerId = playerIdByEmail(access, normalized)
  const admin =
    normalized !== '' &&
    (normalized === normalizeEmail(bootstrapAdminEmail) ||
      (access?.adminEmails.includes(normalized) ?? false))
  if (admin) return { role: 'admin', playerId }
  if (playerId) return { role: 'writer', playerId }
  return { role: 'outsider', playerId: null }
}

export type PlayerEmailResult =
  | { ok: true; access: Access }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'taken'; playerId: PlayerId }

/**
 * Nastaví (nebo prázdným řetězcem smaže) e-mail hráče. Jeden e-mail patří
 * jen jednomu hráči - jinak by po přihlášení nešlo poznat, kdo to je.
 */
export function setPlayerEmail(
  access: Access,
  playerId: PlayerId,
  value: string,
): PlayerEmailResult {
  const email = normalizeEmail(value)
  const playerEmails = { ...access.playerEmails }
  if (email === '') {
    delete playerEmails[playerId]
    return { ok: true, access: { ...access, playerEmails } }
  }
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid' }
  const owner = playerIdByEmail(access, email)
  if (owner && owner !== playerId) return { ok: false, reason: 'taken', playerId: owner }
  playerEmails[playerId] = email
  return { ok: true, access: { ...access, playerEmails } }
}
