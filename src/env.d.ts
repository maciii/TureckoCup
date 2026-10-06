/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Verze z package.json, vpečená při buildu (vite.config.ts -> define). */
declare const __APP_VERSION__: string

/**
 * Konfigurace Firebase; plní se při buildu z GitHub Secrets. Když chybí,
 * aplikace běží v místním (ukázkovém) režimu bez přihlášení - viz
 * `src/data/store.ts`.
 */
interface ImportMetaEnv {
  /** Adresa katalogu hřišť; bez ní se čte katalog projektu golfgames-courses. */
  readonly VITE_COURSES_URL?: string
  /** Id turnaje ve Firestore; bez hodnoty `turecko-cup-26`. */
  readonly VITE_TOURNAMENT_ID?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /**
   * Jen pro testy (`npm run test:e2e:firebase`): host emulátorů Auth (9099)
   * a Firestore (8089). Platí jen ve vývojovém serveru, produkce ho ignoruje.
   */
  readonly VITE_FIREBASE_EMULATOR?: string
  /** Jen pro testy s emulátory: Firestore přes long polling místo streamování. */
  readonly VITE_FIREBASE_LONG_POLLING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
