'use client'

import { ExternalLink } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { CONFIRM_PREVIEW_STATES, UNSUBSCRIBE_PREVIEW_STATES } from './preview-states'

interface PageStateLinksProps {
  strings: NewsletterHubStrings['testCenter']
}

function StateChip({ state, href }: { state: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-gray-800 bg-[#0a0f1a] px-2.5 py-1.5 text-[11px] text-gray-400 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors"
    >
      {state}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" aria-hidden="true" />
      <span className="sr-only">(opens in new tab)</span>
    </a>
  )
}

export function PageStateLinks({ strings }: PageStateLinksProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.pageStates}
      </label>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">{strings.confirmStates}</p>
          <div className="flex flex-wrap gap-1.5">
            {CONFIRM_PREVIEW_STATES.map((s) => (
              <StateChip key={s} state={s} href={`/cms/newsletters/preview/confirm/${s}`} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">{strings.unsubscribeStates}</p>
          <div className="flex flex-wrap gap-1.5">
            {UNSUBSCRIBE_PREVIEW_STATES.map((s) => (
              <StateChip key={s} state={s} href={`/cms/newsletters/preview/unsubscribe/${s}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
