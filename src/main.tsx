import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { DataProvider } from './data'
import { LocaleProvider } from './i18n'
import { ThemeProvider } from './theme'
import './styles.css'

// Offline-first: service worker se registruje hned a novou verzi si vezme
// při dalším spuštění, ať se zápis na hřišti nepřerušuje.
registerSW({ immediate: true })

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ThemeProvider>
        <LocaleProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </LocaleProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
