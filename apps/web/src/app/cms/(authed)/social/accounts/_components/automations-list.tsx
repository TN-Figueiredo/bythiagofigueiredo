'use client'

import { useState, useTransition } from 'react'
import type { SocialStrings } from '../../_i18n/types'
import { AutomationConfigModal } from './automation-config-modal'

interface AutomationRule {
  id: string
  label: string
  enabled: boolean
  mode: 'draft' | 'auto_publish'
}

const DEFAULT_RULES: AutomationRule[] = [
  { id: 'blog_published', label: 'blogPublished', enabled: false, mode: 'draft' },
  { id: 'video_published', label: 'videoPublished', enabled: false, mode: 'auto_publish' },
  { id: 'newsletter_sent', label: 'newsletterSent', enabled: false, mode: 'draft' },
  { id: 'evergreen_timer', label: 'evergreenTimer', enabled: false, mode: 'draft' },
  { id: 'token_expiring', label: 'tokenExpiring', enabled: true, mode: 'draft' },
  { id: 'post_failed', label: 'postFailed', enabled: true, mode: 'auto_publish' },
  { id: 'ab_test_complete', label: 'abTestComplete', enabled: false, mode: 'auto_publish' },
  { id: 'playlist_updated', label: 'playlistUpdated', enabled: false, mode: 'draft' },
]

interface AutomationsListProps {
  strings: SocialStrings
}

export function AutomationsList({ strings: t }: AutomationsListProps) {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [configRule, setConfigRule] = useState<AutomationRule | null>(null)
  const [, startTransition] = useTransition()

  function handleToggle(id: string) {
    startTransition(() => {
      setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
    })
  }

  return (
    <>
      <div className="space-y-2">
        {rules.map(rule => {
          const label = t.accounts.automations[rule.label as keyof typeof t.accounts.automations] as string
          return (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={label}
                  onClick={() => handleToggle(rule.id)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${rule.enabled ? 'bg-cms-accent' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-cms-text">{label}</p>
                  <p className="text-xs text-cms-text-muted">
                    {t.accounts.automations.modeLabel}: {rule.mode === 'draft' ? t.accounts.automations.modeDraft : t.accounts.automations.modeAutoPublish}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigRule(rule)}
                className="text-sm text-cms-accent hover:underline"
              >
                {t.accounts.automations.configure}
              </button>
            </div>
          )
        })}
      </div>

      {configRule && (
        <AutomationConfigModal
          rule={configRule}
          strings={t}
          onClose={() => setConfigRule(null)}
          onSave={(updated) => {
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r))
            setConfigRule(null)
          }}
        />
      )}
    </>
  )
}
