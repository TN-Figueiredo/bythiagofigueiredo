import Link from 'next/link'

export interface LocaleSwitcherProps {
  available: string[]
  current: string
  hrefFor: (locale: string) => string
  label?: string
}

/**
 * Minimal locale switcher. Renders one link per locale in `available`,
 * marking the current locale as non-interactive. Server-component friendly
 * (no client hooks). Used on public blog detail + listing pages.
 *
 * Keeps markup intentionally small — visual styling is deferred to Sprint 3 polish.
 */
export function LocaleSwitcher({ available, current, hrefFor, label = 'Idiomas' }: LocaleSwitcherProps) {
  if (!available || available.length <= 1) return null
  return (
    <nav aria-label={label} data-testid="locale-switcher">
      <ul style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
        {available.map((locale) => {
          const isCurrent = locale === current
          return (
            <li key={locale}>
              {isCurrent ? (
                <span aria-current="true" lang={locale}>
                  {locale}
                </span>
              ) : (
                <Link href={hrefFor(locale)} hrefLang={locale} lang={locale}>
                  {locale}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
