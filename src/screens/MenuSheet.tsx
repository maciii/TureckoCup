import { useData } from '../data'
import { t } from '../i18n'
import { navigate } from '../nav'
import type { Route } from '../nav'
import { THEMES, useTheme } from '../theme'
import { APP_VERSION } from '../version'

interface Props {
  onClose: () => void
  playRoute: Route | null
}

/** Výsuvné menu zleva - navigace, vzhled, verze (vzor z Golfgames). */
export default function MenuSheet({ onClose, playRoute }: Props) {
  const { meta, store } = useData()
  const { theme, setTheme } = useTheme()

  function go(route: Route) {
    onClose()
    navigate(route)
  }

  const items: { label: string; route: Route | null; icon: string }[] = [
    { label: t('nav.overview'), route: { view: 'overview' }, icon: '⌂' },
    { label: t('nav.play'), route: playRoute, icon: '✎' },
    { label: t('nav.admin'), route: { view: 'admin' }, icon: '⚙' },
  ]

  return (
    <div className="menu-backdrop" onClick={onClose} role="presentation">
      <nav
        className="menu-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('nav.menu')}
      >
        <div className="menu-drawer-head">
          <h2>{t('app.name')}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className="menu-drawer-list">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="menu-drawer-item"
              disabled={item.route === null}
              onClick={() => item.route && go(item.route)}
            >
              <span className="menu-drawer-icon">{item.icon}</span>
              <span className="menu-drawer-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="menu-drawer-foot">
          {meta.mode === 'local' && store.setDemoIdentity && (
            <div className="menu-drawer-setting">
              <span className="section-title">{t('admin.demoIdentity')}</span>
              <div className="segmented">
                {(['visitor', 'writer', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`segment${meta.role === role ? ' selected' : ''}`}
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
          <div className="menu-drawer-setting">
            <span className="section-title">{t('nav.theme')}</span>
            <div className="segmented">
              {THEMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`segment${option === theme ? ' selected' : ''}`}
                  onClick={() => setTheme(option)}
                >
                  {t(option === 'dark' ? 'theme.dark' : 'theme.light')}
                </button>
              ))}
            </div>
          </div>
          <p className="menu-drawer-version">
            {t('common.version', { version: APP_VERSION })}
          </p>
        </div>
      </nav>
    </div>
  )
}
