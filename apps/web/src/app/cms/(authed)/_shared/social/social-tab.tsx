'use client'

import { useState, useCallback } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import type { SocialConfig } from '@/lib/social/types'

interface MinimalConnection {
  id: string
  provider: Provider
  account_name: string | null
  site_id: string
}

interface SocialTabProps {
  contentType: 'blog' | 'newsletter' | 'campaign' | 'video'
  contentId: string
  socialConfig: SocialConfig | null
  onConfigChange: (config: SocialConfig) => void
  connections: MinimalConnection[]
}

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63_206,
  instagram: 2_200,
  bluesky: 300,
}

const FORMAT_MAP: Record<string, Record<string, string>> = {
  blog: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  newsletter: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  campaign: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  video: { facebook: 'video_share', instagram: 'reel', bluesky: 'link_card' },
}

const FORMAT_LABELS: Record<string, string> = {
  link_share: 'Link Share',
  story: 'Story',
  link_card: 'Link Card',
  video_share: 'Video Share',
  reel: 'Reel',
  image_post: 'Image Post',
}

function getDefaultConfig(
  connections: MinimalConnection[],
  contentType: string,
): SocialConfig {
  const platforms = connections.map((c) => c.provider)
  const formats: Partial<Record<Provider, import('@/lib/social/types').DeliveryFormat>> = {}
  for (const p of platforms) {
    const fmt = FORMAT_MAP[contentType]?.[p]
    if (fmt) {
      formats[p] = fmt as import('@/lib/social/types').DeliveryFormat
    }
  }
  return {
    enabled: true,
    platforms,
    captions: {},
    hashtags: [],
    formats,
    ig_template: 'card',
    image_source: 'og_image',
  }
}

export function SocialTab({
  contentType,
  contentId: _contentId,
  socialConfig,
  onConfigChange,
  connections,
}: SocialTabProps) {
  const enabled = socialConfig?.enabled ?? false
  const platforms = socialConfig?.platforms ?? []
  const captions = socialConfig?.captions ?? {}
  const hashtags = socialConfig?.hashtags ?? []

  const [activeTab, setActiveTab] = useState<string>(platforms[0] ?? 'facebook')
  const [activeLang, setActiveLang] = useState<'pt' | 'en'>('pt')
  const [hashtagInput, setHashtagInput] = useState('')

  const handleToggle = useCallback(() => {
    if (enabled) {
      onConfigChange({ ...socialConfig!, enabled: false })
    } else {
      const config = socialConfig ?? getDefaultConfig(connections, contentType)
      onConfigChange({ ...config, enabled: true })
    }
  }, [enabled, socialConfig, connections, contentType, onConfigChange])

  const handlePlatformToggle = useCallback(
    (provider: Provider) => {
      if (!socialConfig) return
      const current = socialConfig.platforms ?? []
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider]
      onConfigChange({ ...socialConfig, platforms: next })
    },
    [socialConfig, onConfigChange],
  )

  const handleCaptionChange = useCallback(
    (platform: string, lang: string, value: string) => {
      if (!socialConfig) return
      const platformCaptions = { ...(captions[platform as Provider] ?? {}) }
      platformCaptions[lang as 'pt' | 'en'] = value
      onConfigChange({
        ...socialConfig,
        captions: { ...captions, [platform]: platformCaptions },
      })
    },
    [socialConfig, captions, onConfigChange],
  )

  const handleAddHashtag = useCallback(
    (tag: string) => {
      if (!socialConfig || !tag.trim()) return
      const normalized = tag.startsWith('#') ? tag : `#${tag}`
      if (hashtags.includes(normalized)) return
      onConfigChange({
        ...socialConfig,
        hashtags: [...hashtags, normalized],
      })
      setHashtagInput('')
    },
    [socialConfig, hashtags, onConfigChange],
  )

  const handleRemoveHashtag = useCallback(
    (tag: string) => {
      if (!socialConfig) return
      onConfigChange({
        ...socialConfig,
        hashtags: hashtags.filter((h) => h !== tag),
      })
    },
    [socialConfig, hashtags, onConfigChange],
  )

  const currentCaption = captions[activeTab as Provider]?.[activeLang] ?? ''
  const charLimit = CHAR_LIMITS[activeTab] ?? 63_206
  const formatForPlatform = (provider: string) =>
    FORMAT_MAP[contentType]?.[provider] ?? 'link_share'

  return (
    <div className="space-y-4">
      {/* Share Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
        <span className="text-sm font-medium text-cms-text">
          Compartilhar nas redes sociais ao publicar
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            enabled ? 'bg-cms-accent' : 'bg-cms-border'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Platform Chips */}
          <div className="flex flex-wrap gap-2">
            {connections.map((conn) => {
              const selected = platforms.includes(conn.provider)
              return (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => handlePlatformToggle(conn.provider)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'border-cms-accent/30 bg-cms-accent/10 text-cms-accent'
                      : 'border-cms-border bg-cms-surface text-cms-text-muted'
                  }`}
                >
                  <span>{conn.account_name ?? conn.provider}</span>
                  {selected && (
                    <span className="text-[9px] uppercase tracking-wider text-cms-text-muted">
                      {FORMAT_LABELS[formatForPlatform(conn.provider)] ?? ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Caption Editor with tabs */}
          {platforms.length > 0 && (
            <div className="rounded-lg border border-cms-border bg-cms-surface">
              <div className="flex border-b border-cms-border" role="tablist">
                {platforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === p}
                    aria-label={p}
                    onClick={() => setActiveTab(p)}
                    className={`px-4 py-2 text-sm font-medium capitalize ${
                      activeTab === p
                        ? 'border-b-2 border-cms-accent text-cms-accent'
                        : 'text-cms-text-muted hover:text-cms-text'
                    }`}
                  >
                    {p}
                    <span className="ml-1.5 text-xs text-cms-text-muted">
                      {currentCaption.length}/{charLimit}
                    </span>
                  </button>
                ))}

                {/* Language toggle */}
                <div className="ml-auto flex items-center gap-1 pr-3">
                  {(['pt', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLang(lang)}
                      className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${
                        activeLang === lang
                          ? 'bg-cms-accent/15 text-cms-accent'
                          : 'text-cms-text-muted hover:text-cms-text'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3">
                <textarea
                  value={currentCaption}
                  onChange={(e) =>
                    handleCaptionChange(activeTab, activeLang, e.target.value)
                  }
                  placeholder={`Escreva uma mensagem para o ${activeTab}...`}
                  className="min-h-[120px] w-full resize-y rounded-md border border-cms-border bg-cms-bg p-3 font-mono text-[13px] leading-relaxed text-cms-text placeholder:text-cms-text-muted"
                  maxLength={charLimit}
                />
              </div>
            </div>
          )}

          {/* Hashtag Manager */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 text-xs text-cyan-400"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveHashtag(tag)}
                    className="text-cyan-400/60 hover:text-cyan-400"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddHashtag(hashtagInput)
                  }
                }}
                placeholder="Adicionar hashtag..."
                className="flex-1 rounded-md border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-muted"
              />
              <button
                type="button"
                onClick={() => handleAddHashtag(hashtagInput)}
                className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:text-cms-text"
              >
                + Adicionar
              </button>
            </div>
            <p className="text-xs text-cms-text-muted">
              {hashtags.length}/30 hashtags
            </p>
          </div>

          {/* IG Template Selector (only when IG enabled + story format) */}
          {platforms.includes('instagram') &&
            formatForPlatform('instagram') === 'story' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-cms-text">
                  Template do Story
                </p>
                <div className="flex gap-2">
                  {(['minimal', 'card', 'bold'] as const).map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() =>
                        onConfigChange({
                          ...socialConfig!,
                          ig_template: tpl,
                        })
                      }
                      className={`rounded-md border px-3 py-2 text-sm capitalize ${
                        (socialConfig?.ig_template ?? 'card') === tpl
                          ? 'border-cms-accent bg-cms-accent/10 text-cms-accent'
                          : 'border-cms-border text-cms-text-muted hover:text-cms-text'
                      }`}
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Pipeline Preview */}
          <div className="flex items-center gap-2 rounded-lg border border-cms-border bg-cms-surface px-4 py-2 text-xs text-cms-text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span>Post</span>
            <span className="text-cms-border">&rarr;</span>
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
            <span>Short Link</span>
            <span className="text-cms-border">&rarr;</span>
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
            <span>OG Scrape</span>
            <span className="text-cms-border">&rarr;</span>
            <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
            <span>Deliver</span>
            <span className="ml-1 text-cms-text-muted/60">~2-3 min</span>
          </div>
        </>
      )}
    </div>
  )
}
