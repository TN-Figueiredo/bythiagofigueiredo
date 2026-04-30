'use client'

import type { NewsletterType } from '../_hub/hub-types'

interface TypeFilterChipsProps {
  types: NewsletterType[]
  selectedTypeId: string | null
  onSelect: (typeId: string | null) => void
  allLabel: string
}

export function TypeFilterChips({ types, selectedTypeId, onSelect, allLabel }: TypeFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by newsletter type">
      <button
        role="radio"
        aria-checked={selectedTypeId === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          selectedTypeId === null
            ? 'bg-gray-100 text-gray-900'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        {allLabel}
      </button>
      {types.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={selectedTypeId === t.id}
          onClick={() => onSelect(t.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedTypeId === t.id
              ? 'text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
          style={selectedTypeId === t.id ? { backgroundColor: t.color } : undefined}
        >
          {t.name}
          {t.subscriberCount > 0 && (
            <span className="ml-1 opacity-60">{t.subscriberCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}
