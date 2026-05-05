import Link from 'next/link'

export interface LocaleSwitcherProps {
  available: string[]
  current: string
  hrefFor: (locale: string) => string
  label?: string
}

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  'pt-BR': 'Português',
}

function hreflangCode(locale: string): string {
  return locale === 'pt-BR' ? 'pt' : locale
}

export function LocaleSwitcher({ available, current, hrefFor, label = 'Idiomas' }: LocaleSwitcherProps) {
  if (!available || available.length <= 1) return null
  return (
    <nav aria-label={label} data-testid="locale-switcher">
      <ul style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
        {available.map((locale) => {
          const isCurrent = locale === current
          const displayName = LOCALE_NAMES[locale] ?? locale
          return (
            <li key={locale}>
              {isCurrent ? (
                <span aria-current="true" lang={hreflangCode(locale)}>
                  {displayName}
                </span>
              ) : (
                <Link href={hrefFor(locale)} hrefLang={hreflangCode(locale)} lang={hreflangCode(locale)}>
                  {displayName}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
