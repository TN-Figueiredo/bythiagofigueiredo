'use client'

import { useState, useTransition } from 'react'
import type { SocialStrings } from '../../_i18n/types'

type AutomationCategory = 'content_trigger' | 'system_alert' | 'optimization'

interface AutomationRule {
  id: string
  label: string
  icon: string
  description: string
  category: AutomationCategory
  enabled: boolean
  mode: 'draft' | 'auto_publish'
}

const DEFAULT_RULES: AutomationRule[] = [
  // Content Triggers
  { id: 'blog_published', label: 'blogPublished', icon: '\u{1F4F0}', description: 'blogPublishedDesc', category: 'content_trigger', enabled: false, mode: 'draft' },
  { id: 'video_published', label: 'videoPublished', icon: '\u{1F3AC}', description: 'videoPublishedDesc', category: 'content_trigger', enabled: false, mode: 'auto_publish' },
  { id: 'newsletter_sent', label: 'newsletterSent', icon: '✉️', description: 'newsletterSentDesc', category: 'content_trigger', enabled: false, mode: 'draft' },
  { id: 'playlist_updated', label: 'playlistUpdated', icon: '\u{1F3B5}', description: 'playlistUpdatedDesc', category: 'content_trigger', enabled: false, mode: 'draft' },
  // System Alerts
  { id: 'token_expiring', label: 'tokenExpiring', icon: '\u{1F511}', description: 'tokenExpiringDesc', category: 'system_alert', enabled: true, mode: 'draft' },
  { id: 'post_failed', label: 'postFailed', icon: '\u{1F504}', description: 'postFailedDesc', category: 'system_alert', enabled: true, mode: 'auto_publish' },
  // Optimization
  { id: 'evergreen_timer', label: 'evergreenTimer', icon: '♻️', description: 'evergreenTimerDesc', category: 'optimization', enabled: false, mode: 'draft' },
  { id: 'ab_test_complete', label: 'abTestComplete', icon: '\u{1F3C6}', description: 'abTestCompleteDesc', category: 'optimization', enabled: false, mode: 'auto_publish' },
]

const CATEGORIES: { key: AutomationCategory; icon: string; nameKey: 'categoryContent' | 'categorySystem' | 'categoryOptimization' }[] = [
  { key: 'content_trigger', icon: '\u{1F4DD}', nameKey: 'categoryContent' },
  { key: 'system_alert', icon: '\u{1F6E1}️', nameKey: 'categorySystem' },
  { key: 'optimization', icon: '⚡', nameKey: 'categoryOptimization' },
]

const PLATFORMS = ['youtube', 'facebook', 'instagram', 'bluesky'] as const

interface AutomationsListProps {
  strings: SocialStrings
}

interface ConfigState {
  mode: 'draft' | 'auto_publish'
  platforms: string[]
  aiEnhance: boolean
  template: string
}

export function AutomationsList({ strings: t }: AutomationsListProps) {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [configOpenId, setConfigOpenId] = useState<string | null>(null)
  const [configState, setConfigState] = useState<ConfigState>({ mode: 'draft', platforms: [], aiEnhance: false, template: '' })
  const [, startTransition] = useTransition()

  const activeCount = rules.filter(r => r.enabled).length
  const pausedCount = rules.length - activeCount

  function handleToggle(id: string) {
    startTransition(() => {
      setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
    })
  }

  function openConfig(id: string) {
    if (configOpenId === id) {
      setConfigOpenId(null)
      return
    }
    const rule = rules.find(r => r.id === id)
    if (rule) {
      setConfigState({ mode: rule.mode, platforms: [], aiEnhance: false, template: '' })
      setConfigOpenId(id)
    }
  }

  function handleConfigSave() {
    if (!configOpenId) return
    setRules(prev => prev.map(r => r.id === configOpenId ? { ...r, mode: configState.mode } : r))
    setConfigOpenId(null)
  }

  function handleConfigCancel() {
    setConfigOpenId(null)
  }

  function handleDeleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
    setConfigOpenId(null)
  }

  function togglePlatform(platform: string) {
    setConfigState(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }))
  }

  const automations = t.accounts.automations

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 p-3.5 px-5 bg-cms-bg rounded-xl border border-cms-border">
        <div className="text-center">
          <p className="text-lg font-bold text-cms-text">{rules.length}</p>
          <p className="text-[10px] text-cms-text-muted uppercase tracking-wider">Rules</p>
        </div>
        <div className="w-px h-8 bg-cms-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-green-400">{activeCount}</p>
          <p className="text-[10px] text-cms-text-muted uppercase tracking-wider">Active</p>
        </div>
        <div className="w-px h-8 bg-cms-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-cms-text-muted">{pausedCount}</p>
          <p className="text-[10px] text-cms-text-muted uppercase tracking-wider">Paused</p>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const catRules = rules.filter(r => r.category === cat.key)
        if (catRules.length === 0) return null
        const activeInCategory = catRules.filter(r => r.enabled).length

        return (
          <div key={cat.key} className="space-y-2.5">
            {/* Category header */}
            <div className="flex items-center gap-2.5 mb-2.5 px-1">
              <span className="text-base">{cat.icon}</span>
              <span className="font-semibold text-sm text-cms-text">
                {automations[cat.nameKey]}
              </span>
              <span className="bg-cms-bg text-cms-text-muted text-[10px] px-2 py-0.5 rounded-full">
                {catRules.length} {activeInCategory > 0 ? `· ${activeInCategory} active` : 'rules'}
              </span>
              <div className="flex-1 h-px bg-cms-border" />
            </div>

            {/* Rules */}
            {catRules.map(rule => {
              const isConfigOpen = configOpenId === rule.id
              const labelText = automations[rule.label as keyof typeof automations] as string
              const descText = automations[rule.description as keyof typeof automations] as string

              return (
                <div key={rule.id}>
                  {/* Rule card */}
                  <div
                    className={`bg-cms-surface border rounded-lg p-3.5 flex items-center gap-3.5 transition-transform ${
                      isConfigOpen
                        ? 'border-purple-500/40 rounded-b-none'
                        : rule.enabled
                          ? 'border-cms-border'
                          : 'border-cms-border/50 opacity-55'
                    } hover:-translate-y-px`}
                    style={{ paddingLeft: '1.125rem', paddingRight: '1.125rem' }}
                  >
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      onClick={() => handleToggle(rule.id)}
                      className={`w-10 h-[22px] rounded-full relative flex-shrink-0 transition-colors ${
                        rule.enabled ? 'bg-green-500' : 'bg-gray-700'
                      }`}
                      aria-label={`Toggle ${labelText}`}
                    >
                      <div
                        className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow ${
                          rule.enabled ? 'right-[2px]' : 'left-[2px]'
                        }`}
                      />
                    </button>

                    {/* Icon */}
                    <div className="w-[38px] h-[38px] rounded-lg bg-cms-bg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{rule.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-[13px] ${
                            rule.enabled ? 'text-cms-text' : 'text-cms-text-muted'
                          }`}
                        >
                          {labelText}
                        </span>
                        {/* Mode badge */}
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-medium ${
                            rule.mode === 'auto_publish'
                              ? rule.enabled
                                ? 'bg-green-500/12 text-green-400'
                                : 'bg-green-500/8 text-gray-500'
                              : rule.enabled
                                ? 'bg-purple-500/12 text-purple-400'
                                : 'bg-purple-500/8 text-gray-500'
                          }`}
                        >
                          {rule.mode === 'auto_publish' ? 'AUTO' : 'DRAFT'}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          rule.enabled ? 'text-gray-500' : 'text-gray-600'
                        }`}
                      >
                        {descText}
                      </p>
                    </div>

                    {/* Configure button */}
                    <button
                      type="button"
                      onClick={() => openConfig(rule.id)}
                      className={`text-[11px] px-3.5 py-1.5 rounded-md font-medium flex-shrink-0 transition-colors ${
                        rule.enabled
                          ? 'bg-cms-accent/8 border border-cms-accent/15 text-cms-accent hover:bg-cms-accent/15'
                          : 'bg-transparent border border-cms-border/50 text-cms-text-muted hover:text-cms-text'
                      }`}
                    >
                      {isConfigOpen ? 'Close ▴' : `${automations.configure} ▾`}
                    </button>
                  </div>

                  {/* Inline config panel */}
                  {isConfigOpen && (
                    <div
                      role="region"
                      aria-label={`${labelText} configuration`}
                      className="bg-cms-surface border border-purple-500/40 border-t-0 rounded-b-lg p-5"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left column */}
                        <div className="space-y-4">
                          {/* Action Mode */}
                          <div>
                            <label className="text-xs font-medium text-cms-text-muted uppercase tracking-wider">
                              {t.accounts.config.actionMode}
                            </label>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => setConfigState(prev => ({ ...prev, mode: 'draft' }))}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                  configState.mode === 'draft'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-cms-bg text-cms-text-muted border border-cms-border hover:text-cms-text'
                                }`}
                              >
                                {automations.modeDraft}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfigState(prev => ({ ...prev, mode: 'auto_publish' }))}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                  configState.mode === 'auto_publish'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-cms-bg text-cms-text-muted border border-cms-border hover:text-cms-text'
                                }`}
                              >
                                {automations.modeAutoPublish}
                              </button>
                            </div>
                          </div>

                          {/* Target Platforms */}
                          <div>
                            <label className="text-xs font-medium text-cms-text-muted uppercase tracking-wider">
                              {automations.targetPlatformsLabel}
                            </label>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {PLATFORMS.map(p => {
                                const selected = configState.platforms.includes(p)
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => togglePlatform(p)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                      selected
                                        ? 'bg-cms-accent/15 text-cms-accent border border-cms-accent/25'
                                        : 'bg-cms-bg text-cms-text-muted border border-cms-border hover:text-cms-text'
                                    }`}
                                  >
                                    {selected && <span className="text-[10px]">{'✓'}</span>}
                                    {t.platforms[p]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* AI Enhance */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={configState.aiEnhance}
                              onClick={() => setConfigState(prev => ({ ...prev, aiEnhance: !prev.aiEnhance }))}
                              className={`w-10 h-[22px] rounded-full relative flex-shrink-0 transition-colors ${
                                configState.aiEnhance ? 'bg-green-500' : 'bg-gray-700'
                              }`}
                              aria-label={automations.aiEnhanceLabel}
                            >
                              <div
                                className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow ${
                                  configState.aiEnhance ? 'right-[2px]' : 'left-[2px]'
                                }`}
                              />
                            </button>
                            <span className="text-xs text-cms-text">
                              {automations.aiEnhanceLabel}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-semibold">
                              AI
                            </span>
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-cms-text-muted uppercase tracking-wider">
                            {automations.templateLabel}
                          </label>
                          <textarea
                            value={configState.template}
                            onChange={e => setConfigState(prev => ({ ...prev, template: e.target.value }))}
                            rows={4}
                            placeholder={'{title}\n{excerpt}\n{short_link}'}
                            className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text font-mono placeholder:text-cms-text-muted/40 focus:outline-none focus:border-cms-accent/50"
                          />
                          <p className="text-[10px] text-cms-text-muted">
                            {automations.templateVars}:{' '}
                            <code className="text-purple-400/80">{'{title}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{excerpt}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{short_link}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{cover_image}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{author}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{category}'}</code>,{' '}
                            <code className="text-purple-400/80">{'{tags}'}</code>
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-cms-border/50">
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-[11px] px-3 py-1.5 rounded-md font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          {automations.deleteRule}
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleConfigCancel}
                            className="text-[11px] px-3.5 py-1.5 rounded-md font-medium text-cms-text-muted hover:text-cms-text transition-colors"
                          >
                            {t.accounts.config.cancel}
                          </button>
                          <button
                            type="button"
                            onClick={handleConfigSave}
                            className="text-[11px] px-4 py-1.5 rounded-md font-medium bg-cms-accent text-white hover:bg-cms-accent/90 transition-colors"
                          >
                            {t.accounts.config.save}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
