'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

export type TemplateName = 'confirm' | 'welcome' | 'edition'

interface TemplateSelectorProps {
  selected: TemplateName
  onChange: (t: TemplateName) => void
  strings: NewsletterHubStrings['testCenter']
}

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  confirm: 'Confirm',
  welcome: 'Welcome',
  edition: 'Edition',
}

export function TemplateSelector({ selected, onChange, strings }: TemplateSelectorProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.template}
      </label>
      <div role="radiogroup" aria-label="Email template" className="flex flex-row gap-1.5 lg:flex-col">
        {(['confirm', 'welcome', 'edition'] as const).map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={selected === id}
            onClick={() => onChange(id)}
            className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              selected === id
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium'
                : 'bg-[#0a0f1a] border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            {TEMPLATE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  )
}
