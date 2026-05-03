'use client'

interface LocaleFilterChipsProps {
  locales: string[]
  selectedLocale: string | null
  onSelect: (locale: string | null) => void
  allLabel: string
}

export function LocaleFilterChips({ locales, selectedLocale, onSelect, allLabel }: LocaleFilterChipsProps) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Locale filter">
      <button
        role="radio"
        aria-checked={selectedLocale === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
          selectedLocale === null
            ? 'bg-gray-700 text-gray-100'
            : 'bg-gray-900 text-gray-500 hover:text-gray-300'
        }`}
      >
        {allLabel}
      </button>
      {locales.map((locale) => (
        <button
          key={locale}
          role="radio"
          aria-checked={selectedLocale === locale}
          onClick={() => onSelect(locale)}
          className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase transition-colors ${
            selectedLocale === locale
              ? 'bg-gray-700 text-gray-100'
              : 'bg-gray-900 text-gray-500 hover:text-gray-300'
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
