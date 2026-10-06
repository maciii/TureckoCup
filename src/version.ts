/**
 * Verze aplikace.
 *
 * Hodnotu vpéká Vite při buildu z package.json (viz `define` ve vite.config.ts);
 * zvedá ji scripts/bump-version.mjs při každém lokálním buildu.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
