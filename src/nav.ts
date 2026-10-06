import { useEffect, useState } from 'react'

/**
 * Navigace přes hash v adrese.
 *
 * Plochá navigace jako v Golfgames, ale místo vlastního `pushState` snímku
 * stačí hash: zpět/swipe funguje přes historii prohlížeče, obrazovka přežije
 * obnovení stránky (service worker v režimu autoUpdate umí aplikaci znovu
 * načíst uprostřed zápisu) a odkaz na kolo jde poslat.
 *
 *   #/                 přehled
 *   #/round/r1         kolo
 *   #/play/r1/0        zápis skóre, flight 1
 *   #/admin            admin a účet
 *   #/admin/round/r1   nastavení kola
 */

export type Route =
  | { view: 'overview' }
  | { view: 'round'; roundId: string }
  | { view: 'play'; roundId: string; flight: number | null }
  | { view: 'admin' }
  | { view: 'adminRound'; roundId: string }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'round':
      return parts[1] ? { view: 'round', roundId: parts[1] } : { view: 'overview' }
    case 'play': {
      if (!parts[1]) return { view: 'overview' }
      const flight = parts[2] !== undefined ? Number.parseInt(parts[2], 10) : NaN
      return {
        view: 'play',
        roundId: parts[1],
        flight: Number.isNaN(flight) ? null : flight,
      }
    }
    case 'admin':
      return parts[1] === 'round' && parts[2]
        ? { view: 'adminRound', roundId: parts[2] }
        : { view: 'admin' }
    default:
      return { view: 'overview' }
  }
}

export function routeHash(route: Route): string {
  switch (route.view) {
    case 'overview':
      return '#/'
    case 'round':
      return `#/round/${route.roundId}`
    case 'play':
      return route.flight === null
        ? `#/play/${route.roundId}`
        : `#/play/${route.roundId}/${route.flight}`
    case 'admin':
      return '#/admin'
    case 'adminRound':
      return `#/admin/round/${route.roundId}`
  }
}

export function navigate(route: Route, replace = false): void {
  const hash = routeHash(route)
  if (replace) window.history.replaceState(null, '', hash)
  else window.location.hash = hash
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function goBack(): void {
  if (window.history.length > 1) window.history.back()
  else navigate({ view: 'overview' })
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
