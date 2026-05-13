'use client'

import { useState, useEffect, useRef } from 'react'
import type { SocialStrings } from '../../_i18n/types'

interface AutomationRule {
  id: string
  label: string
  enabled: boolean
  mode: 'draft' | 'auto_publish'
}

interface AutomationConfigModalProps {
  rule: AutomationRule
  strings: SocialStrings
  onClose: () => void
  onSave: (rule: AutomationRule) => void
}

export function AutomationConfigModal({ rule, strings: t, onClose, onSave }: AutomationConfigModalProps) {
  const [mode, setMode] = useState(rule.mode)
  const [template, setTemplate] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    if (first) first.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div ref={dialogRef} className="w-full max-w-lg rounded-lg bg-cms-surface border border-cms-border p-6 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="automation-config-title">
        <h2 id="automation-config-title" className="text-lg font-semibold text-cms-text">{t.accounts.config.title}</h2>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.triggerLabel}</label>
          <p className="text-sm text-cms-text">{t.accounts.automations[rule.label as keyof typeof t.accounts.automations] as string}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.actionMode}</label>
          <div className="flex gap-3 mt-1">
            <label className="flex items-center gap-2 text-sm text-cms-text cursor-pointer">
              <input type="radio" checked={mode === 'draft'} onChange={() => setMode('draft')} className="accent-cms-accent" />
              {t.accounts.automations.modeDraft}
            </label>
            <label className="flex items-center gap-2 text-sm text-cms-text cursor-pointer">
              <input type="radio" checked={mode === 'auto_publish'} onChange={() => setMode('auto_publish')} className="accent-cms-accent" />
              {t.accounts.automations.modeAutoPublish}
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.contentTemplate}</label>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            rows={3}
            placeholder="{title}\n{url}\n{hashtags}"
            className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
          />
          <p className="mt-1 text-xs text-cms-text-dim">
            Variables: {'{title}'}, {'{excerpt}'}, {'{short_link}'}, {'{cover_image}'}, {'{author}'}, {'{category}'}, {'{tags}'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-cms-text-muted hover:text-cms-text">
            {t.accounts.config.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...rule, mode })}
            className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          >
            {t.accounts.config.save}
          </button>
        </div>
      </div>
    </div>
  )
}
