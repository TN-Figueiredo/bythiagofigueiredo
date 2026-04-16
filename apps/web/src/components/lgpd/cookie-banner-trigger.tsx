'use client'

// Sprint 5a Track D — D2: Floating "Cookie Settings" button.
// Re-opens the banner after the user dismissed it — required for LGPD
// Art. 8 §5 (right to withdraw consent at any time).

import { useCookieConsent } from './cookie-banner-context'

type Locale = 'pt-BR' | 'en'

const LABELS: Record<Locale, string> = {
  'pt-BR': 'Cookies',
  en: 'Cookie settings',
}

function negotiateLocale(): Locale {
  if (typeof navigator === 'undefined') return 'pt-BR'
  const lang = (navigator.language || 'pt-BR').toLowerCase()
  return lang.startsWith('en') ? 'en' : 'pt-BR'
}

export interface CookieBannerTriggerProps {
  localeOverride?: Locale
  className?: string
}

export function CookieBannerTrigger({ localeOverride, className }: CookieBannerTriggerProps = {}) {
  const { openBanner } = useCookieConsent()
  const locale = localeOverride ?? negotiateLocale()
  const label = LABELS[locale]
  return (
    <button
      type="button"
      onClick={openBanner}
      data-testid="cookie-banner-trigger"
      aria-label={label}
      className={
        className ??
        'fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text)] shadow-sm transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2'
      }
    >
      {label}
    </button>
  )
}
