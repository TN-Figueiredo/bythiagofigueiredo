'use client'

import { useState } from 'react'

import { DEFAULT_TEMPLATES } from '@tn-figueiredo/social'

import type { SocialStrings } from '../../_i18n/types'

interface TemplatePickerProps {
  onSelect: (template: string) => void
  strings: SocialStrings
}

const TEMPLATE_LIST = [
  { id: 'blog-post', key: 'blogAnnouncement' },
  { id: 'video-launch', key: 'videoLaunch' },
  { id: 'link-share', key: 'linkShare' },
  { id: 'newsletter', key: 'newsletterShare' },
  { id: 'evergreen', key: 'evergreenReshare' },
] as const

export function TemplatePicker({ onSelect, strings: t }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-cms-accent hover:underline">
        {t.composer.template.title} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-cms-border bg-cms-surface shadow-lg">
          {TEMPLATE_LIST.map(tmpl => {
            const label = t.composer.template[tmpl.key as keyof typeof t.composer.template] as string
            const text = DEFAULT_TEMPLATES[tmpl.id] ?? ''
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => { onSelect(text); setOpen(false) }}
                className="block w-full px-4 py-2 text-left hover:bg-cms-surface-hover"
              >
                <p className="text-sm font-medium text-cms-text">{label}</p>
                <p className="text-xs text-cms-text-dim truncate">{text}</p>
              </button>
            )
          })}
          <div className="border-t border-cms-border px-4 py-2">
            <button type="button" className="text-xs text-cms-accent hover:underline">{t.composer.template.createCustom}</button>
          </div>
        </div>
      )}
    </div>
  )
}
