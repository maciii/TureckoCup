import { APP_VERSION } from './version'

/**
 * Záznam poslední chyby aplikace. Na hřišti nikdo konzoli neotevře: chyba,
 * která shodí React (bílá obrazovka), nebo neošetřený promise se uloží do
 * localStorage a menu ji ukáže, aby šla nahlásit a opravit.
 */

const KEY = 'tc26.lastError.v1'

export interface StoredError {
  message: string
  stack?: string
  at: string
  version: string
  hash: string
}

export function recordError(error: unknown, origin: string): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const entry: StoredError = {
    message: `${origin}: ${err.message}`,
    ...(err.stack ? { stack: err.stack.slice(0, 1500) } : {}),
    at: new Date().toISOString(),
    version: APP_VERSION,
    hash: window.location.hash,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

export function lastError(): StoredError | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredError) : null
  } catch {
    return null
  }
}

export function clearError(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Globální zachytávání mimo React (promise, handlery událostí). */
export function installErrorLogging(): void {
  window.addEventListener('error', (event) => {
    recordError(event.error ?? event.message, 'window')
  })
  window.addEventListener('unhandledrejection', (event) => {
    recordError(event.reason, 'promise')
  })
}
