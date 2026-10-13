import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'

/**
 * Spodní list s detailem (rozpis zápasu, hráče, kola). Jde přes portál do
 * `body`, takže ho jde otevřít i z řádku seznamu - klepnutí uvnitř listu
 * nebublá do řádku, který ho otevřel, a seznam zůstává platné HTML.
 */
export default function DetailSheet({
  title,
  subtitle,
  className,
  onClose,
  children,
}: {
  title: string
  subtitle?: ReactNode
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      role="presentation"
    >
      <div
        className={`sheet detail-sheet${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head px">
          <h2>{title}</h2>
          {subtitle && <div className="detail-sub">{subtitle}</div>}
        </div>
        <div className="detail-body">{children}</div>
        <div className="px sheet-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
