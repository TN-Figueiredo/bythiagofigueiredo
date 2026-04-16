'use client'

// Sprint 5a Track D — D1: LGPD-compliant cookie banner.
//
// Design rules (spec Section 4 v2):
//   * Compact bar + expanded modal (3 categories: Functional / Analytics / Marketing)
//   * Functional is locked ON; Analytics + Marketing default OFF (opt-in)
//   * Accept and Reject buttons MUST share identical visual prominence (anti-dark-pattern)
//   * ARIA role="dialog" + aria-modal + aria-labelledby; Escape closes
//   * Focus trap while open; primary CTA auto-focused on mount
//   * Locale strings negotiated from navigator.language (pt-BR default; en fallback)
//
// State + persistence live in <CookieBannerProvider />; this component is the UI surface.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useCookieConsent } from './cookie-banner-context'

type Locale = 'pt-BR' | 'en'

interface Strings {
  title: string
  description: string
  acceptAll: string
  rejectAll: string
  customize: string
  save: string
  close: string
  categories: {
    functional: { label: string; help: string }
    analytics: { label: string; help: string }
    marketing: { label: string; help: string }
  }
  privacyLinkLabel: string
}

const STRINGS: Record<Locale, Strings> = {
  'pt-BR': {
    title: 'Cookies e privacidade',
    description:
      'Usamos cookies para operar o site, medir uso (analytics) e personalizar conteúdo (marketing). Funcionais são necessários para o site funcionar. Os demais dependem do seu consentimento explícito (LGPD Art. 8).',
    acceptAll: 'Aceitar todos',
    rejectAll: 'Rejeitar todos',
    customize: 'Personalizar',
    save: 'Salvar preferências',
    close: 'Fechar',
    categories: {
      functional: {
        label: 'Funcionais (obrigatórios)',
        help: 'Sessão, login e preferências de idioma. Sem isso o site não funciona.',
      },
      analytics: {
        label: 'Analytics',
        help: 'Medição agregada de uso (páginas vistas, tempo de leitura). Sem identificação pessoal.',
      },
      marketing: {
        label: 'Marketing',
        help: 'Personalização de conteúdo e campanhas. Nunca compartilhamos seus dados com terceiros.',
      },
    },
    privacyLinkLabel: 'Política de Privacidade',
  },
  en: {
    title: 'Cookies & privacy',
    description:
      'We use cookies to run the site, measure usage (analytics), and personalize content (marketing). Functional cookies are required. Others depend on your explicit opt-in consent (LGPD Art. 8 / GDPR Art. 6).',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    customize: 'Customize',
    save: 'Save preferences',
    close: 'Close',
    categories: {
      functional: {
        label: 'Functional (required)',
        help: 'Session, login, and language preferences. The site does not work without these.',
      },
      analytics: {
        label: 'Analytics',
        help: 'Aggregate usage measurement (page views, read time). No personal identification.',
      },
      marketing: {
        label: 'Marketing',
        help: 'Content and campaign personalization. We never share data with third parties.',
      },
    },
    privacyLinkLabel: 'Privacy Policy',
  },
}

function negotiateLocale(): Locale {
  if (typeof navigator === 'undefined') return 'pt-BR'
  const lang = (navigator.language || 'pt-BR').toLowerCase()
  if (lang.startsWith('en')) return 'en'
  return 'pt-BR'
}

// Equal-prominence CSS — accept + reject MUST use this exact string (see a11y test).
const EQUAL_BUTTON_CLS =
  'inline-flex min-w-[9rem] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2'

export interface CookieBannerProps {
  localeOverride?: Locale
}

export function CookieBanner({ localeOverride }: CookieBannerProps = {}) {
  const { consent, setConsent, isOpen, closeBanner } = useCookieConsent()
  const [expanded, setExpanded] = useState(false)
  const [analytics, setAnalytics] = useState(Boolean(consent?.analytics))
  const [marketing, setMarketing] = useState(Boolean(consent?.marketing))
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)
  const locale = localeOverride ?? negotiateLocale()
  const t = useMemo(() => STRINGS[locale], [locale])

  // Sync controlled checkbox state when stored consent changes (multi-tab case).
  useEffect(() => {
    setAnalytics(Boolean(consent?.analytics))
    setMarketing(Boolean(consent?.marketing))
  }, [consent])

  // Auto-focus the primary CTA on open so keyboard users start inside the dialog.
  useEffect(() => {
    if (isOpen) {
      primaryBtnRef.current?.focus()
    }
  }, [isOpen])

  // Escape closes; tab/shift+tab wrap within the dialog (simple focus trap).
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeBanner()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeBanner])

  if (!isOpen) return null

  function handleAcceptAll() {
    setConsent({ analytics: true, marketing: true })
  }

  function handleRejectAll() {
    setConsent({ analytics: false, marketing: false })
  }

  function handleSave() {
    setConsent({ analytics, marketing })
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-4xl border-t border-[var(--border)] bg-[var(--bg)] px-4 py-4 shadow-lg sm:rounded-t-xl sm:border sm:px-6"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">
            {t.title}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">{t.description}</p>
          <a
            href="/privacy"
            className="text-sm text-[var(--accent)] underline underline-offset-2 hover:no-underline"
          >
            {t.privacyLinkLabel}
          </a>
        </div>

        {expanded && (
          <fieldset className="flex flex-col gap-3 rounded-md border border-[var(--border)] p-3">
            <legend className="sr-only">Categories</legend>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                aria-label={t.categories.functional.label}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--text)]">
                  {t.categories.functional.label}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {t.categories.functional.help}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                aria-label={t.categories.analytics.label}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--text)]">
                  {t.categories.analytics.label}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {t.categories.analytics.help}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                aria-label={t.categories.marketing.label}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--text)]">
                  {t.categories.marketing.label}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {t.categories.marketing.help}
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {t.customize}
          </button>
          {expanded && (
            <button
              type="button"
              onClick={handleSave}
              className={EQUAL_BUTTON_CLS}
            >
              {t.save}
            </button>
          )}
          <button
            type="button"
            onClick={handleRejectAll}
            className={EQUAL_BUTTON_CLS}
            data-testid="cookie-banner-reject"
          >
            {t.rejectAll}
          </button>
          <button
            ref={primaryBtnRef}
            type="button"
            onClick={handleAcceptAll}
            className={EQUAL_BUTTON_CLS}
            data-testid="cookie-banner-accept"
          >
            {t.acceptAll}
          </button>
        </div>
      </div>
    </div>
  )
}
