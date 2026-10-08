import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { announceUpdate } from './pwa'
import App from './App'
import { DataProvider } from './data'
import { LocaleProvider } from './i18n'
import './styles.css'

// Offline-first: service worker se registruje hned a novou verzi si vezme
// při dalším spuštění, ať se zápis na hřišti nepřerušuje.
// Nová verze čeká; obnovení stránky potvrdí uživatel v menu (viz pwa.ts).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => announceUpdate(() => void updateSW(true)),
})

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <LocaleProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </LocaleProvider>
    </StrictMode>,
  )
}
