'use client'

// Sprint 5a Track D — D8: Layout shell for /privacy + /terms.
//
// Responsibilities:
//  - Provide a two-column layout with sticky table of contents (h2 headings)
//  - Display last-updated footer
//  - Render locale switcher when multiple locales are provided
//
// Server component friendly: the TOC is extracted on the client by scanning
// `h2` elements in the rendered subtree, so MDX content can be arbitrary.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LocaleSwitcher } from '../locale-switcher'

type Locale = 'pt-BR' | 'en'

const LABELS: Record<Locale, { toc: string; lastUpdated: string }> = {
  'pt-BR': { toc: 'Índice', lastUpdated: 'Última atualização' },
  en: { toc: 'Contents', lastUpdated: 'Last updated' },
}

export interface LegalShellProps {
  locale: Locale
  lastUpdated: string
  children: ReactNode
  availableLocales?: Locale[]
  hrefFor?: (locale: Locale) => string
}

interface TocEntry {
  id: string
  text: string
}

export function LegalShell({
  locale,
  lastUpdated,
  children,
  availableLocales,
  hrefFor,
}: LegalShellProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const labels = LABELS[locale]

  useEffect(() => {
    if (!contentRef.current) return
    const heads = Array.from(contentRef.current.querySelectorAll('h2'))
    const next: TocEntry[] = []
    for (const h of heads) {
      let id = h.id
      if (!id) {
        id = (h.textContent ?? '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        h.id = id
      }
      next.push({ id, text: h.textContent ?? '' })
    }
    setToc(next)
  }, [children])

  const showToc = toc.length > 0
  const showLocaleSwitcher = Boolean(
    availableLocales && availableLocales.length > 1 && hrefFor,
  )

  const switcher = useMemo(() => {
    if (!showLocaleSwitcher || !availableLocales || !hrefFor) return null
    return (
      <LocaleSwitcher
        available={availableLocales}
        current={locale}
        hrefFor={(l) => hrefFor(l as Locale)}
        label={labels.toc}
      />
    )
  }, [showLocaleSwitcher, availableLocales, locale, hrefFor, labels.toc])

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
      {(showToc || showLocaleSwitcher) && (
        <aside className="order-1 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {switcher}
          {showToc && (
            <nav aria-label={labels.toc} className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                {labels.toc}
              </span>
              <ul className="flex flex-col gap-1">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text)] hover:underline"
                    >
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      )}
      <div ref={contentRef} className="order-2 prose prose-slate max-w-none dark:prose-invert">
        {children}
        <footer className="mt-10 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-tertiary)]">
          {labels.lastUpdated}: {lastUpdated}
        </footer>
      </div>
    </main>
  )
}
