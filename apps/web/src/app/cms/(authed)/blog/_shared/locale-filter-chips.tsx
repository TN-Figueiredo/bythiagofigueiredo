'use client'

import { LOCALE_FLAGS } from '../_hub/hub-utils'

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
      className="h-[30px] rounded-lg border border-gray-800 bg-gray-900 px-2.5 text-xs font-medium text-gray-300 outline-none transition-colors hover:border-gray-700 focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
    >
      <option value="">{allLabel}</option>
      {locales.map((locale) => {
        const flag = LOCALE_FLAGS[locale]
        return (
          <option key={locale} value={locale}>
            {flag ? `${flag} ${locale.toUpperCase()}` : locale.toUpperCase()}
          </option>
        )
      })}
    </select>
  )
}
