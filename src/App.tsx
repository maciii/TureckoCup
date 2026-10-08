import { useData } from './data'
import { missingConfigKeys } from './data/firebase'
import { resolveDataMode } from './data'
import { t } from './i18n'
import { useRoute } from './nav'
import type { Route } from './nav'
import AdminRoundScreen from './screens/AdminRoundScreen'
import AdminScreen from './screens/AdminScreen'
import OverviewScreen from './screens/OverviewScreen'
import PlayScreen from './screens/PlayScreen'
import RoundScreen from './screens/RoundScreen'
import { useSwipeBack } from './swipeBack'
import { useAutoUpdate } from './pwa'

/** Kořen aplikace: vybere obrazovku podle hashe. */
export default function App() {
  const route = useRoute()
  const { state } = useData()
  useSwipeBack(route.view !== 'overview')
  useAutoUpdate(route.view)

  if (resolveDataMode() === 'unconfigured') {
    return (
      <div className="screen">
        <main className="content">
          <div className="notice error">
            <strong>{t('app.notConnected')}</strong>
            <p className="hint">{t('app.notConnectedHint')}</p>
            <p className="hint">{missingConfigKeys().join(', ')}</p>
          </div>
        </main>
      </div>
    )
  }

  // Zápis vede na živé kolo; bez živého kola na nejbližší plánované.
  const live =
    state.rounds.find((r) => r.status === 'live') ??
    state.rounds.find((r) => r.status === 'planned')
  const playRoute: Route | null = live
    ? { view: 'play', roundId: live.id, flight: null }
    : null

  switch (route.view) {
    case 'round':
      return <RoundScreen roundId={route.roundId} />
    case 'play':
      return <PlayScreen roundId={route.roundId} flight={route.flight} />
    case 'admin':
      return <AdminScreen />
    case 'adminRound':
      return <AdminRoundScreen roundId={route.roundId} />
    default:
      return <OverviewScreen playRoute={playRoute} />
  }
}
