'use client'

export const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
}

export const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'PT-BR',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
}

const LOCALE_COLORS: Record<string, { color: string; bg: string }> = {
  'pt-BR': { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  en: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

interface LocaleToggleProps {
  currentLocale: string
  existingLocales: string[]
  supportedLocales: string[]
  isPostPersisted: boolean
  isSaving: boolean
  onSwitchLocale: (locale: string) => void
  onAddLocale: (locale: string) => void
}

export function LocaleToggle({
  currentLocale,
  existingLocales,
  supportedLocales,
  isPostPersisted,
  isSaving,
  onSwitchLocale,
  onAddLocale,
}: LocaleToggleProps) {
  const missingLocales = supportedLocales.filter(
    (locale) => !existingLocales.includes(locale)
  )

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-[#161d2d] p-0.5">
      {/* Render existing locale badges */}
      {existingLocales.map((locale) => {
        const isActive = locale === currentLocale
        const colors = LOCALE_COLORS[locale]
        const flag = LOCALE_FLAGS[locale] ?? locale
        const label = LOCALE_LABELS[locale] ?? locale

        if (isActive) {
          return (
            <span
              key={locale}
              aria-label={label}
              style={
                colors
                  ? { color: colors.color, backgroundColor: colors.bg }
                  : undefined
              }
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold"
            >
              <span>{flag}</span>
              <span>{label}</span>
            </span>
          )
        }

        return (
          <button
            key={locale}
            type="button"
            aria-label={label}
            disabled={isSaving}
            onClick={() => onSwitchLocale(locale)}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-opacity hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>{flag}</span>
            <span>{label}</span>
          </button>
        )
      })}

      {/* Render add buttons for missing locales (only when post is persisted) */}
      {isPostPersisted &&
        missingLocales.map((locale) => {
          const flag = LOCALE_FLAGS[locale] ?? locale
          const label = LOCALE_LABELS[locale] ?? locale

          return (
            <button
              key={`add-${locale}`}
              type="button"
              aria-label={`+ ${label}`}
              disabled={isSaving}
              onClick={() => onAddLocale(locale)}
              className="inline-flex items-center gap-0.5 rounded border border-dashed border-indigo-500/50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-400 transition-colors hover:border-indigo-400 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{flag}</span>
              <span>+{label}</span>
            </button>
          )
        })}
    </div>
  )
}
