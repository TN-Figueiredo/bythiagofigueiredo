import Link from 'next/link'
import type { ReactNode } from 'react'

export interface LegalShellProps {
  /**
   * Active locale for the document rendered inside `children`. Used to
   * mark the active link in the locale switcher and to render the
   * `lang` attribute on the article root for accessibility.
   */
  locale: 'pt-BR' | 'en'
  /**
   * ISO-8601 date string (YYYY-MM-DD) surfaced in the footer so users
   * can see the effective date. Matches the `effectiveDate` front-matter
   * on each MDX file.
   */
  lastUpdated: string
  /**
   * Compiled MDX content (a React element tree). LegalShell wraps it
   * with a prose-styled `<article>` and sticky TOC scaffolding.
   */
  children: ReactNode
}

const LABELS = {
  'pt-BR': {
    skipLink: 'Pular para o conteúdo',
    backHome: 'Voltar para o início',
    languageSwitcher: 'Idioma',
    languageShort: { 'pt-BR': 'Português', en: 'English' },
    lastUpdatedLabel: 'Última atualização',
    privacy: 'Política de Privacidade',
    terms: 'Termos de Uso',
    related: 'Documentos relacionados',
  },
  en: {
    skipLink: 'Skip to content',
    backHome: 'Back to home',
    languageSwitcher: 'Language',
    languageShort: { 'pt-BR': 'Português', en: 'English' },
    lastUpdatedLabel: 'Last updated',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    related: 'Related documents',
  },
} as const

/**
 * LegalShell — layout for /privacy and /terms MDX pages.
 *
 * Responsibilities:
 *  - Renders a top header with "back home" + locale switcher (pt-BR ⇄ en)
 *  - Wraps MDX children in a `prose`-styled `<article>` with the right `lang`
 *  - Sticky TOC placeholder (visual scaffolding; real anchors come from MDX `##`)
 *  - Footer with the document's `lastUpdated` stamp + links to the counterpart
 *
 * Intentionally a **server component** (no client hooks) so it can be imported
 * directly by page.tsx server components. All locale switching happens via
 * plain `<Link>` — query param `?lang=` is recognized by the page negotiator.
 */
export function LegalShell({ locale, lastUpdated, children }: LegalShellProps) {
  const t = LABELS[locale]
  const otherLocale: 'pt-BR' | 'en' = locale === 'pt-BR' ? 'en' : 'pt-BR'

  return (
    <div data-testid="legal-shell" lang={locale} className="min-h-screen bg-white text-slate-900">
      <a
        href="#legal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        {t.skipLink}
      </a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            data-testid="legal-shell-home-link"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            ← {t.backHome}
          </Link>
          <nav
            aria-label={t.languageSwitcher}
            data-testid="legal-shell-locale-switcher"
            className="flex items-center gap-2 text-sm"
          >
            <span className="text-slate-500">{t.languageSwitcher}:</span>
            <span
              aria-current="true"
              lang={locale}
              className="font-semibold text-slate-900"
              data-testid={`legal-shell-locale-current-${locale}`}
            >
              {t.languageShort[locale]}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <Link
              href={`?lang=${otherLocale}`}
              hrefLang={otherLocale}
              lang={otherLocale}
              className="text-slate-600 underline hover:text-slate-900"
              data-testid={`legal-shell-locale-other-${otherLocale}`}
            >
              {t.languageShort[otherLocale]}
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1fr_240px]">
        <article
          id="legal-main"
          data-testid="legal-shell-article"
          className="prose prose-slate max-w-none"
        >
          {children}
        </article>
        <aside
          aria-label="Table of contents"
          data-testid="legal-shell-toc"
          className="hidden lg:block"
        >
          <div className="sticky top-8 border-l border-slate-200 pl-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{t.related}</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link href="/privacy" className="hover:text-slate-900">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-900">
                  {t.terms}
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span data-testid="legal-shell-last-updated">
            {t.lastUpdatedLabel}:{' '}
            <time dateTime={lastUpdated} className="font-medium text-slate-700">
              {lastUpdated}
            </time>
          </span>
          <span>
            <Link href="/" className="hover:text-slate-900">
              bythiagofigueiredo.com
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
