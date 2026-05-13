'use client'

import type { SocialStrings } from '../../_i18n/types'

interface BilingualEditorProps {
  enabled: boolean
  onToggle: (v: boolean) => void
  ptContent: string
  enContent: string
  onPtChange: (v: string) => void
  onEnChange: (v: string) => void
  strings: SocialStrings
}

export function BilingualEditor({ enabled, onToggle, ptContent, enContent, onPtChange, onEnChange, strings: t }: BilingualEditorProps) {
  if (!enabled) {
    return (
      <button type="button" onClick={() => onToggle(true)} className="text-sm text-cms-accent hover:underline">
        {t.composer.bilingual.enableEn}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cms-text">{t.composer.bilingual.enableEn}</span>
        <button type="button" onClick={() => onToggle(false)} className="text-xs text-cms-text-muted hover:text-red-400">×</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-cms-text-muted">{t.composer.bilingual.ptBr}</label>
          <textarea value={ptContent} onChange={e => onPtChange(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
        </div>
        <div>
          <label className="text-xs font-medium text-cms-text-muted">{t.composer.bilingual.en}</label>
          <textarea value={enContent} onChange={e => onEnChange(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
          <button type="button" className="mt-1 text-xs text-cms-accent hover:underline">{t.composer.bilingual.autoTranslate}</button>
        </div>
      </div>
    </div>
  )
}
