import type { ReactNode } from 'react'
import { useData } from '../data'
import { t } from '../i18n'
import { navigate } from '../nav'
import type { Route } from '../nav'
import { APP_VERSION } from '../version'
import { FlagMark, accountName } from './common'

interface Props {
  onClose: () => void
  playRoute: Route | null
  current: Route['view']
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="menu-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </span>
  )
}

/** Výsuvné menu zleva ve světlém stylu appky; zelená jen jako barva ikon. */
export default function MenuSheet({ onClose, playRoute, current }: Props) {
  const { meta, store, state } = useData()

  function go(route: Route) {
    onClose()
    navigate(route)
  }

  const item = (
    label: string,
    route: Route | null,
    icon: ReactNode,
    extra = '',
    active = false,
  ) => (
    <button
      type="button"
      className={`menu-item${active ? ' selected' : ''}${extra ? ` ${extra}` : ''}`}
      disabled={route === null}
      onClick={() => route && go(route)}
    >
      <Icon>{icon}</Icon>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="menu-backdrop" onClick={onClose} role="presentation">
      <nav
        className="menu-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('nav.menu')}
      >
        <div className="menu-head">
          <b>{t('nav.menu')}</b>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="menu-id">
          <span className="hero-mark" style={{ width: 32, height: 32, margin: 0 }}>
            <FlagMark size={18} />
          </span>
          <div>
            <div className="nm">{state.tournament?.name ?? t('app.name')}</div>
            <div className="sub">
              {meta.account
                ? accountName(state.players, meta.account)
                : t('admin.role.visitor')}
            </div>
          </div>
        </div>

        {playRoute && (
          <>
            <div className="menu-label">{t('nav.play')}</div>
            {item(
              t('nav.play'),
              playRoute,
              <>
                <path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z" />
                <rect x="4" y="6" width="16" height="15" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </>,
              'write',
              current === 'play',
            )}
          </>
        )}

        <div className="menu-label">{t('nav.overviews')}</div>
        {item(
          t('nav.overview'),
          { view: 'overview' },
          <>
            <path d="M4 11l8-7 8 7" />
            <path d="M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" />
          </>,
          '',
          current === 'overview',
        )}
        {item(
          t('nav.admin'),
          { view: 'admin' },
          <>
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" />
          </>,
          'admin',
          current === 'admin' || current === 'adminRound',
        )}

        <div className="menu-foot">
          {meta.mode === 'local' && store.setDemoIdentity && (
            <div className="stack">
              <span className="menu-label" style={{ padding: 0 }}>
                {t('admin.demoIdentity')}
              </span>
              <div className="tabs compact">
                {(['visitor', 'writer', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`tab${meta.role === role ? ' selected' : ''}`}
                    aria-pressed={meta.role === role}
                    onClick={() => store.setDemoIdentity?.(role)}
                  >
                    {t(
                      role === 'admin'
                        ? 'admin.demoAdmin'
                        : role === 'writer'
                          ? 'admin.demoWriter'
                          : 'admin.demoVisitor',
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="menu-version">{t('common.version', { version: APP_VERSION })}</p>
        </div>
      </nav>
    </div>
  )
}
