import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { announceUpdate, scheduleUpdateChecks } from './pwa'
import ErrorBoundary from './ErrorBoundary'
import { installErrorLogging } from './errors'
import App from './App'
import { DataProvider } from './data'
import { LocaleProvider } from './i18n'
import './styles.css'

installErrorLogging()

// Offline-first: service worker se registruje hned. Nová verze se použije
// sama mimo obrazovku zápisu (viz pwa.ts), otevřená aplikace ji hledá
// pravidelně i po návratu na popředí.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => announceUpdate(() => void updateSW(true)),
  onRegisteredSW: (_url, registration) => {
    if (registration) scheduleUpdateChecks(registration)
  },
})

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <LocaleProvider>
        <ErrorBoundary>
          <DataProvider>
            <App />
          </DataProvider>
        </ErrorBoundary>
      </LocaleProvider>
    </StrictMode>,
  )
}
