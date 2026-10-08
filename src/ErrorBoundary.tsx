import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { recordError } from './errors'
import { t } from './i18n'
import { navigate } from './nav'

interface State {
  error: Error | null
}

/**
 * Bez hranice chyb shodí jediná výjimka celý React a zůstane bílá obrazovka,
 * která vypadá jako pád aplikace. Tady se chyba uloží, ukáže a jde se dál.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    recordError(
      Object.assign(error, {
        stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
      }),
      'react',
    )
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="screen">
        <main className="content">
          <div className="notice error" role="alert">
            <strong>{t('app.crashed')}</strong>
            <p className="hint">{t('app.crashHint')}</p>
            <p className="hint">{error.message}</p>
          </div>
          <div className="px stack">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                navigate({ view: 'overview' }, true)
                this.setState({ error: null })
              }}
            >
              {t('app.retry')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => window.location.reload()}
            >
              {t('app.updateApply')}
            </button>
          </div>
        </main>
      </div>
    )
  }
}
