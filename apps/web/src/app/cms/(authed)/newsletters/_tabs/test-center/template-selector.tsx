'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

export type TemplateName = 'confirm' | 'welcome' | 'edition'

interface TemplateSelectorProps {
  selected: TemplateName
  onChange: (t: TemplateName) => void
  strings: NewsletterHubStrings['testCenter']
  hasEditions: boolean
}

const TEMPLATES: TemplateName[] = ['confirm', 'welcome', 'edition']

function getTemplateLabel(id: TemplateName, strings: NewsletterHubStrings['testCenter']): string {
  switch (id) {
    case 'confirm': return strings.templateConfirm
    case 'welcome': return strings.templateWelcome
    case 'edition': return strings.templateEdition
  }
}

export function getTemplateLabelExported(id: TemplateName, strings: NewsletterHubStrings['testCenter']): string {
  return getTemplateLabel(id, strings)
}

export function TemplateSelector({ selected, onChange, strings, hasEditions }: TemplateSelectorProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.template}
      </label>
      <div role="radiogroup" aria-label="Email template" className="flex flex-row gap-1.5 lg:flex-col">
        {TEMPLATES.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={selected === id}
            aria-disabled={id === 'edition' && !hasEditions ? true : undefined}
            onClick={() => { if (!(id === 'edition' && !hasEditions)) onChange(id) }}
            className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              selected === id
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium'
                : id === 'edition' && !hasEditions
                ? 'bg-[#0a0f1a] border-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-[#0a0f1a] border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
            title={id === 'edition' && !hasEditions ? strings.noEditions : undefined}
          >
            {getTemplateLabel(id, strings)}
          </button>
        ))}
      </div>
    </div>
  )
}
