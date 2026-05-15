'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostSocialConfig } from '../../actions'
import type { SocialConfig } from '@/lib/social/types'
import type { Provider } from '@tn-figueiredo/social'
import { socialLocale, type SectionStatus } from '@/lib/posts/types'

const PLATFORMS: Array<{ provider: Provider; label: string; color: string; charLimit: number }> = [
  { provider: 'youtube', label: 'YouTube Community', color: '#f87171', charLimit: 5000 },
  { provider: 'facebook', label: 'Facebook', color: '#60a5fa', charLimit: 63206 },
  { provider: 'instagram', label: 'Instagram', color: '#e879f9', charLimit: 2200 },
  { provider: 'bluesky', label: 'Bluesky', color: '#38bdf8', charLimit: 300 },
]

const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  enabled: false,
  platforms: [],
  captions: {},
  hashtags: [],
  image_source: 'cover_image',
  ig_template: 'card',
  formats: {},
}

export function SocialTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const [config, setConfig] = useState<SocialConfig>(post.socialConfig ?? DEFAULT_SOCIAL_CONFIG)
  const [expandedPlatform, setExpandedPlatform] = useState<Provider | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const togglePlatform = useCallback((provider: Provider) => {
    setConfig(prev => {
      const platforms = prev.platforms.includes(provider)
        ? prev.platforms.filter(p => p !== provider)
        : [...prev.platforms, provider]
      const enabled = platforms.length > 0
      dispatch({ type: 'SET_DIRTY', tab: 'social', dirty: true })
      return { ...prev, platforms, enabled }
    })
  }, [dispatch])

  const setCaption = useCallback((provider: Provider, locale: 'pt' | 'en', text: string) => {
    setConfig(prev => {
      const captions = { ...prev.captions, [provider]: { ...prev.captions[provider], [locale]: text } }
      dispatch({ type: 'SET_DIRTY', tab: 'social', dirty: true })
      return { ...prev, captions }
    })
  }, [dispatch])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const result = await savePostSocialConfig(post.id, config)
      if (result.ok) {
        dispatch({ type: 'SAVE_TAB', tab: 'social' })
        toast.success('Social config salva')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setIsSaving(false)
    }
  }, [post.id, config, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.social) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.social])

  const configuredCount = config.platforms.length
  const sectionStatus: SectionStatus = configuredCount > 0 ? 'done' : 'empty'
  const captionLocale = socialLocale(activeLocale)

  const hasMultiLang = post.translations.length > 1

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="Social" status={sectionStatus} statusText={configuredCount > 0 ? `${configuredCount} de 4` : undefined} isDirty={state.dirty.social} isSaving={isSaving} onSave={handleSave} />

      {/* Multi-language info banner */}
      {hasMultiLang && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
          Este post tem PT + EN. Cada idioma gera posts sociais separados com intervalo de 30 min para evitar flood.
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-4 gap-2">
        {PLATFORMS.map(({ provider, label, color }) => {
          const isActive = config.platforms.includes(provider)
          return (
            <button
              key={provider}
              type="button"
              onClick={() => togglePlatform(provider)}
              aria-pressed={isActive}
              className="flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all"
              style={{
                borderColor: isActive ? color : 'var(--gem-border)',
                background: isActive ? `${color}10` : 'var(--gem-surface)',
              }}
            >
              <span className="w-6 h-6 rounded-full" style={{ background: color }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? color : 'var(--gem-muted)' }}>{label.split(' ')[0]}</span>
              <span className="text-[9px]" style={{ color: isActive ? 'var(--gem-done)' : 'var(--gem-dim)' }}>
                {isActive ? 'Configurado' : 'Não configurado'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Expanded platform editors */}
      {PLATFORMS.filter(p => config.platforms.includes(p.provider)).map(({ provider, label, color, charLimit }) => {
        const caption = config.captions[provider]?.[captionLocale] ?? ''
        const isExpanded = expandedPlatform === provider

        return (
          <div
            key={provider}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: `${color}40`, background: 'var(--gem-surface)' }}
          >
            <button
              type="button"
              onClick={() => setExpandedPlatform(isExpanded ? null : provider)}
              className="w-full flex items-center justify-between px-4 py-2.5"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>{label}</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>
                    Texto ({captionLocale.toUpperCase()})
                  </label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(provider, captionLocale, e.target.value)}
                    rows={3}
                    className="w-full bg-transparent rounded border px-3 py-2 text-xs resize-y focus:border-[var(--gem-accent)] focus:outline-none"
                    style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
                    maxLength={charLimit}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>Limite: {charLimit.toLocaleString()}</span>
                    <span
                      className="text-[9px]"
                      style={{ color: caption.length > charLimit * 0.9 ? 'var(--gem-warn)' : 'var(--gem-dim)' }}
                    >
                      {caption.length}/{charLimit}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
