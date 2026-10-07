import type { Auth } from 'firebase/auth'
import { t } from '../i18n'
import { loadFirebase } from './firebase'
import type { Account } from './store'

/**
 * Přihlášení účtem Google (převzato z Golfgames beze změny mechaniky).
 *
 * Vyskakovací okno smí otevřít jen kód běžící přímo v obsluze klepnutí.
 * Jakékoli čekání na síť mezitím gesto „spotřebuje" a Safari okno zablokuje.
 * Proto se SDK načte předem (`preloadAuth`) a `signInWithGoogle()` pak popup
 * otevírá synchronně, bez jediného `await` před sebou. Přesměrování zůstává
 * jako záloha; v Safari je spolehlivé jen s `authDomain` na doméně aplikace
 * (viz docs/setup-firebase.md, přihlášení na iPhonu).
 */

type AuthModule = typeof import('firebase/auth')

function googleProvider(module: AuthModule) {
  const provider = new module.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

let ready: { auth: Auth; module: AuthModule } | null = null
let loading: Promise<{ auth: Auth; module: AuthModule }> | null = null

export function preloadAuth(): Promise<{ auth: Auth; module: AuthModule }> {
  loading ??= (async () => {
    const { auth } = await loadFirebase()
    const module = await import('firebase/auth')
    await module.getRedirectResult(auth).catch(() => null)
    ready = { auth, module }
    return ready
  })()
  return loading
}

export function isAuthReady(): boolean {
  return ready !== null
}

export type SignInError = 'cancelled' | 'network' | 'popup' | 'notReady' | 'unknown'

const CANCELLED = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]

const POPUP_BLOCKED = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]

export function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}

export function describeSignInError(error: unknown): SignInError {
  const code = codeOf(error)
  if (code === 'app/not-ready') return 'notReady'
  if (CANCELLED.includes(code)) return 'cancelled'
  if (code === 'auth/network-request-failed') return 'network'
  if (POPUP_BLOCKED.includes(code)) return 'popup'
  return 'unknown'
}

function toAccount(user: {
  uid: string
  displayName: string | null
  email: string | null
}): Account {
  return {
    uid: user.uid,
    name: user.displayName ?? user.email ?? t('error.unnamedAccount'),
    email: (user.email ?? '').toLowerCase(),
    // Hráče k účtu přiřadí datová vrstva podle private/access.
    playerId: null,
  }
}

/** Funkce **není async** a popup otevírá hned prvním příkazem. */
export function signInWithGoogle(): Promise<Account | null> {
  if (!ready) {
    void preloadAuth()
    return Promise.reject(
      Object.assign(new Error('SDK není načtené'), { code: 'app/not-ready' }),
    )
  }

  const { auth, module } = ready
  const provider = googleProvider(module)

  return module.signInWithPopup(auth, provider).then(
    (credential) => toAccount(credential.user),
    async (error: unknown) => {
      if (!POPUP_BLOCKED.includes(codeOf(error))) throw error
      await module.signInWithRedirect(auth, provider)
      return null
    },
  )
}

export async function signOutAccount(): Promise<void> {
  const { auth } = await loadFirebase()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
}

export async function watchAccount(
  onChange: (account: Account | null) => void,
): Promise<() => void> {
  const { auth } = await loadFirebase()
  const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')
  void getRedirectResult(auth).catch(() => null)
  return onAuthStateChanged(auth, (user) => onChange(user ? toAccount(user) : null))
}
