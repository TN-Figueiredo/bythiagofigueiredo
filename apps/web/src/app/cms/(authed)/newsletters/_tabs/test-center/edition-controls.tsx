'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

interface EditionControlsProps {
  types: Array<{ id: string; name: string; color: string }>
  selectedTypeId: string | null
  selectedEditionId: string | null
  onTypeChange: (typeId: string | null) => void
  onEditionChange: (editionId: string | null) => void
  editions: Array<{ id: string; subject: string; status: string }>
  strings: NewsletterHubStrings['testCenter']
  disabled: boolean
}

export function EditionControls({
  types,
  selectedTypeId,
  selectedEditionId,
  onTypeChange,
  onEditionChange,
  editions,
  strings,
  disabled,
}: EditionControlsProps) {
  return (
    <div aria-disabled={disabled} className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.edition}
      </label>
      <div className="flex flex-col gap-2">
        <select
          value={selectedTypeId ?? ''}
          onChange={(e) => {
            onTypeChange(e.target.value || null)
            onEditionChange(null)
          }}
          disabled={disabled}
          className="w-full rounded-md border border-gray-800 bg-[#0a0f1a] px-3 py-2 text-xs text-gray-300 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50"
          aria-label={strings.selectType}
        >
          <option value="">{strings.selectType}</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={selectedEditionId ?? ''}
          onChange={(e) => onEditionChange(e.target.value || null)}
          disabled={editions.length === 0}
          className="w-full rounded-md border border-gray-800 bg-[#0a0f1a] px-3 py-2 text-xs text-gray-300 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50"
          aria-label={strings.selectEdition}
        >
          <option value="">{editions.length === 0 ? strings.noEditions : strings.selectEdition}</option>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.subject} ({e.status})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
