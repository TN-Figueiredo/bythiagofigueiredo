'use client'

interface LocaleFilterChipsProps {
  locales: string[]
  selectedLocale: string | null
  onSelect: (locale: string | null) => void
  allLabel: string
}

export function LocaleFilterChips({ locales, selectedLocale, onSelect, allLabel }: LocaleFilterChipsProps) {
  return (
    <select
      value={selectedLocale ?? ''}
      onChange={(e) => onSelect(e.target.value || null)}
      aria-label="Locale filter"
      className="h-[26px] rounded-md border border-gray-800 bg-gray-900 px-2 text-[11px] font-medium uppercase text-gray-300 outline-none transition-colors hover:border-gray-700 focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
    >
      <option value="">{allLabel}</option>
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale}
        </option>
      ))}
    </select>
  )
}
