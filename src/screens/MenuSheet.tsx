import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useData, variantHref } from '../data'
import { t } from '../i18n'
import { navigate } from '../nav'
import type { Route } from '../nav'
import { APP_VERSION } from '../version'
import { Crest, accountName } from './common'

/** Návody žijí mimo aplikaci (sdílené stránky), ať jdou měnit bez nasazení. */
const GUIDE_PLAYERS_URL = 'https://claude.ai/artifact/A1eJ6aEgAkLpUyp3QKXufe'
const GUIDE_ADMIN_URL = 'https://claude.ai/artifact/U3HtGDKhNiRQCASJ61kxVX'

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

/**
 * Výsuvné menu zleva. Co v něm je, řídí role: nepřihlášený vidí nahoře
 * přihlášení (jinde ho hledat nemusí), hráč své jméno a odhlášení, položku
 * Admin jen admin - ostatním by nedávala smysl.
 */
export default function MenuSheet({ onClose, playRoute, current }: Props) {
  const { meta, store, state } = useData()
  const signedIn = meta.account !== null
  // SDK přihlášení se načítá dopředu, aby popup šel otevřít hned z klepnutí.
  useEffect(() => {
    if (!signedIn) store.prepareSignIn()
  }, [signedIn, store])

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
          <Crest className="menu-crest" />
          <div>
            <div className="nm">{state.tournament?.name ?? t('app.name')}</div>
            <div className="sub">
              {meta.account
                ? `${accountName(state.players, meta.account)} · ${t(`admin.role.${meta.role}`)}`
                : t('admin.role.visitor')}
            </div>
          </div>
        </div>

        {!meta.account && (
          <div className="menu-signin">
            <button
              type="button"
              className="btn primary"
              disabled={!meta.authReady}
              onClick={() => {
                onClose()
                void store.signIn()
              }}
            >
              {meta.authReady ? t('admin.signIn') : t('admin.signingIn')}
            </button>
            <p className="hint">{t('nav.signInHint')}</p>
          </div>
        )}

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
        {meta.role === 'admin' &&
          item(
            t('nav.admin'),
            { view: 'admin' },
            <>
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" />
            </>,
            'admin',
            current === 'admin' || current === 'adminRound',
          )}

        <div className="menu-label">{t('nav.guides')}</div>
        <a
          className="menu-item guide"
          href={GUIDE_PLAYERS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon>
            <path d="M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2z" />
            <path d="M20 5a2 2 0 00-2-2h-5v18h5a2 2 0 002-2z" />
          </Icon>
          <span className="menu-item-text">
            {t('nav.guidePlayers')}
            <small>{t('nav.guideHint')}</small>
          </span>
        </a>
        {meta.role === 'admin' && (
          <a
            className="menu-item guide"
            href={GUIDE_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon>
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M9 12h6M9 16h6" />
            </Icon>
            <span className="menu-item-text">
              {t('nav.guideAdmin')}
              <small>{t('nav.guideHint')}</small>
            </span>
          </a>
        )}

        <div className="menu-label">{t('app.versions')}</div>
        {meta.demo === 'preview' ? (
          <a className="menu-item" href={variantHref(null)}>
            <Icon>
              <path d="M5 21V4" />
              <path d="M5 4h11l-2 4 2 4H5" />
            </Icon>
            <span>{t('app.toLive')}</span>
          </a>
        ) : (
          <a className="menu-item preview" href={variantHref('preview')}>
            <Icon>
              <path d="M9 3h6" />
              <path d="M10 3v6L5 19a1.5 1.5 0 001.3 2h11.4a1.5 1.5 0 001.3-2l-5-10V3" />
              <path d="M7.5 15h9" />
            </Icon>
            <span className="menu-item-text">
              {t('app.toPreview')}
              <small>{t('app.toPreviewHint')}</small>
            </span>
          </a>
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
          {meta.account && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                onClose()
                void store.signOut()
              }}
            >
              {t('admin.signOut')}
            </button>
          )}
          {store.resetDemo && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                store.resetDemo?.()
                onClose()
                navigate({ view: 'overview' })
              }}
            >
              {t(meta.demo === 'preview' ? 'app.resetPreview' : 'app.resetDemo')}
            </button>
          )}
          <p className="menu-version">{t('common.version', { version: APP_VERSION })}</p>
        </div>
      </nav>
    </div>
  )
}
