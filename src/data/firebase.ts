import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { t } from '../i18n'

/**
 * Líné načtení Firebase (převzato z Golfgames). SDK se importuje dynamicky,
 * ale na rozdíl od Golfgames je **předcachované** service workerem: tady je
 * Firebase celá datová vrstva a aplikace musí naběhnout i bez signálu.
 *
 * Firestore dostane trvalou cache (IndexedDB) sdílenou mezi záložkami, aby
 * fronta zápisů přežila zabití aplikace. V privátním režimu persistence
 * spadne a použije se paměťová cache - zápisy pak přežijí jen běh stránky.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return missingConfigKeys().length === 0
}

export function missingConfigKeys(): string[] {
  const required: [string, string | undefined][] = [
    ['VITE_FIREBASE_API_KEY', config.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', config.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', config.projectId],
    ['VITE_FIREBASE_APP_ID', config.appId],
  ]
  return required.filter(([, value]) => !value).map(([name]) => name)
}

export interface FirebaseBundle {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  /** Trvalá cache se nepodařila - zápisy offline přežijí jen běh stránky. */
  memoryOnly: boolean
}

let pending: Promise<FirebaseBundle> | null = null

export function loadFirebase(): Promise<FirebaseBundle> {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error(t('error.notConfigured')))
  }

  pending ??= (async () => {
    const [{ initializeApp, getApps, getApp }, authModule, firestoreModule] =
      await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ])

    const app = getApps().length > 0 ? getApp() : initializeApp(config)
    const auth = authModule.getAuth(app)
    await authModule.setPersistence(auth, authModule.browserLocalPersistence)

    let db: Firestore
    let memoryOnly = false
    try {
      db = firestoreModule.initializeFirestore(app, {
        localCache: firestoreModule.persistentLocalCache({
          tabManager: firestoreModule.persistentMultipleTabManager(),
        }),
      })
    } catch {
      db = firestoreModule.initializeFirestore(app, {
        localCache: firestoreModule.memoryLocalCache(),
      })
      memoryOnly = true
    }

    return { app, auth, db, memoryOnly }
  })()

  return pending
}
