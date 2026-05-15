'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import type { SocialConfig, DeliveryFormat } from '@/lib/social/types'
import { CONTENT_FORMAT_MAP, PIPELINE_FORMAT_TO_CONTENT_TYPE } from '@/lib/social/types'

interface SocialConfigEditorProps {
  config: SocialConfig | null
  onChange: (config: SocialConfig) => void
  disabled?: boolean
  contentFormat?: string
  autoFillHook?: string | null
  autoFillTags?: string[]
}

const ALL_PROVIDERS: Provider[] = ['facebook', 'instagram', 'bluesky', 'youtube']

const PROVIDER_LABELS: Record<Provider, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
}

const ALL_FORMATS: DeliveryFormat[] = [
  'link_share',
  'image_post',
  'story',
  'reel',
  'link_card',
  'video_share',
]

const FORMAT_LABELS: Record<DeliveryFormat, string> = {
  link_share: 'Link Share',
  image_post: 'Image Post',
  story: 'Story',
  reel: 'Reel',
  link_card: 'Link Card',
  video_share: 'Video Share',
}

const IMAGE_SOURCE_OPTIONS: { value: SocialConfig['image_source']; label: string }[] = [
  { value: 'og_image', label: 'OG Image' },
  { value: 'cover_image', label: 'Cover Image' },
  { value: 'custom', label: 'Custom' },
]

const IG_TEMPLATE_OPTIONS: { value: SocialConfig['ig_template']; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'card', label: 'Card' },
  { value: 'bold', label: 'Bold' },
]

const DEFAULT_CONFIG: SocialConfig = {
  enabled: true,
  platforms: [],
  captions: {},
  hashtags: [],
  image_source: 'og_image',
  ig_template: 'card',
  formats: {},
}

function parseHashtags(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean)
}

export function SocialConfigEditor({ config, onChange, disabled, contentFormat, autoFillHook, autoFillTags }: SocialConfigEditorProps) {
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<Provider>>(() => new Set())

  const update = useCallback(
    (patch: Partial<SocialConfig>) => {
      if (!config) return
      onChange({ ...config, ...patch })
    },
    [config, onChange],
  )

  const togglePlatform = useCallback(
    (provider: Provider) => {
      if (!config) return
      const has = config.platforms.includes(provider)
      const platforms = has
        ? config.platforms.filter((p) => p !== provider)
        : [...config.platforms, provider]

      onChange({ ...config, platforms })
    },
    [config, onChange],
  )

  const setCaption = useCallback(
    (provider: Provider, lang: 'pt' | 'en', value: string) => {
      if (!config) return
      const captions = { ...config.captions }
      captions[provider] = { ...captions[provider], [lang]: value }
      onChange({ ...config, captions })
    },
    [config, onChange],
  )

  const setFormat = useCallback(
    (provider: Provider, format: DeliveryFormat) => {
      if (!config) return
      const formats = { ...config.formats }
      formats[provider] = format
      onChange({ ...config, formats })
    },
    [config, onChange],
  )

  const toggleExpand = useCallback((provider: Provider) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }, [])

  const defaultFormats = useMemo((): Partial<Record<Provider, DeliveryFormat>> => {
    if (!contentFormat) return {}
    const contentType = PIPELINE_FORMAT_TO_CONTENT_TYPE[contentFormat]
    if (!contentType) return {}
    return CONTENT_FORMAT_MAP[contentType] ?? {}
  }, [contentFormat])

  if (!config) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({
          ...DEFAULT_CONFIG,
          hashtags: autoFillTags ?? [],
          captions: autoFillHook ? { facebook: { pt: autoFillHook, en: '' }, instagram: { pt: autoFillHook, en: '' }, bluesky: { pt: autoFillHook, en: '' }, youtube: { pt: autoFillHook, en: '' } } : {},
        })}
        className="w-full py-2 text-xs font-semibold rounded-md transition-opacity"
        style={{
          background: 'var(--gem-accent)',
          color: 'var(--gem-on-accent, #fff)',
          border: '1px solid var(--gem-accent)',
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        Configurar Social
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--gem-text)' }}>
          Social
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          aria-label="Ativar publicação social"
          disabled={disabled}
          onClick={() => update({ enabled: !config.enabled })}
          className="relative w-8 h-[18px] rounded-full transition-colors"
          style={{
            background: config.enabled ? 'var(--gem-done)' : 'var(--gem-border)',
            opacity: disabled ? 0.4 : 1,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          <span
            className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-transform"
            style={{
              background: '#fff',
              left: config.enabled ? '16px' : '2px',
            }}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Platform checkboxes */}
          <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
            <legend className="text-[10px] font-semibold mb-1" style={{ color: 'var(--gem-muted)' }}>
              Plataformas
            </legend>
            <div className="grid grid-cols-2 gap-1">
              {ALL_PROVIDERS.map((provider) => (
                <label
                  key={provider}
                  className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none py-0.5"
                  style={{ color: 'var(--gem-text)' }}
                >
                  <input
                    type="checkbox"
                    checked={config.platforms.includes(provider)}
                    onChange={() => togglePlatform(provider)}
                    className="w-3 h-3"
                    style={{ accentColor: 'var(--gem-accent)' }}
                  />
                  {PROVIDER_LABELS[provider]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Captions per platform */}
          {config.platforms.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--gem-muted)' }}>
                Legendas
              </span>
              {config.platforms.map((provider) => {
                const isExpanded = expandedPlatforms.has(provider)
                return (
                  <div
                    key={provider}
                    className="rounded-md overflow-hidden"
                    style={{
                      border: '1px solid var(--gem-border)',
                      background: 'color-mix(in srgb, var(--gem-surface) 80%, transparent)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(provider)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-medium"
                      style={{ color: 'var(--gem-text)' }}
                    >
                      {PROVIDER_LABELS[provider]}
                      <span
                        className="text-[9px] transition-transform"
                        style={{
                          color: 'var(--gem-dim)',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▼
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2 flex flex-col gap-1.5">
                        <div>
                          <div className="flex items-center justify-between">
                            <label htmlFor={`caption-${provider}-pt`} className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>PT</label>
                            {(config.captions[provider]?.pt?.length ?? 0) > 0 && (
                              <span className="text-[8px] tabular-nums" style={{ color: (config.captions[provider]?.pt?.length ?? 0) > 2000 ? 'var(--gem-danger, #ef4444)' : 'var(--gem-dim)' }}>
                                {config.captions[provider]?.pt?.length ?? 0}/2200
                              </span>
                            )}
                          </div>
                          <textarea
                            id={`caption-${provider}-pt`}
                            rows={2}
                            maxLength={2200}
                            disabled={disabled}
                            value={config.captions[provider]?.pt ?? ''}
                            onChange={(e) => setCaption(provider, 'pt', e.target.value)}
                            className="w-full text-[11px] p-1.5 rounded resize-none"
                            style={{
                              background: 'var(--gem-well, var(--gem-surface))',
                              border: '1px solid var(--gem-border)',
                              color: 'var(--gem-text)',
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label htmlFor={`caption-${provider}-en`} className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>EN</label>
                            {(config.captions[provider]?.en?.length ?? 0) > 0 && (
                              <span className="text-[8px] tabular-nums" style={{ color: (config.captions[provider]?.en?.length ?? 0) > 2000 ? 'var(--gem-danger, #ef4444)' : 'var(--gem-dim)' }}>
                                {config.captions[provider]?.en?.length ?? 0}/2200
                              </span>
                            )}
                          </div>
                          <textarea
                            id={`caption-${provider}-en`}
                            rows={2}
                            maxLength={2200}
                            disabled={disabled}
                            value={config.captions[provider]?.en ?? ''}
                            onChange={(e) => setCaption(provider, 'en', e.target.value)}
                            className="w-full text-[11px] p-1.5 rounded resize-none"
                            style={{
                              background: 'var(--gem-well, var(--gem-surface))',
                              border: '1px solid var(--gem-border)',
                              color: 'var(--gem-text)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Hashtags */}
          <div className="flex flex-col gap-1">
            <label htmlFor="social-hashtags" className="text-[10px] font-semibold" style={{ color: 'var(--gem-muted)' }}>
              Hashtags
            </label>
            <input
              id="social-hashtags"
              type="text"
              disabled={disabled}
              placeholder="tag1, tag2, tag3"
              defaultValue={config.hashtags.join(' ')}
              onBlur={(e) => update({ hashtags: parseHashtags(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  update({ hashtags: parseHashtags(e.currentTarget.value) })
                }
              }}
              className="w-full text-[11px] px-2 py-1 rounded"
              style={{
                background: 'var(--gem-well, var(--gem-surface))',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-text)',
              }}
            />
            {config.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {config.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: 'color-mix(in srgb, var(--gem-accent) 12%, transparent)',
                      color: 'var(--gem-accent)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Image source */}
          <fieldset className="flex flex-col gap-1" disabled={disabled}>
            <legend className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--gem-muted)' }}>
              Fonte da imagem
            </legend>
            <div className="flex flex-col gap-0.5">
              {IMAGE_SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none py-0.5"
                  style={{ color: 'var(--gem-text)' }}
                >
                  <input
                    type="radio"
                    name="image_source"
                    checked={config.image_source === opt.value}
                    onChange={() => update({ image_source: opt.value })}
                    className="w-3 h-3"
                    style={{ accentColor: 'var(--gem-accent)' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* IG template — only when instagram is selected */}
          {config.platforms.includes('instagram') && (
            <fieldset className="flex flex-col gap-1" disabled={disabled}>
              <legend className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--gem-muted)' }}>
                Template Instagram
              </legend>
              <div className="flex gap-2">
                {IG_TEMPLATE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1 text-[11px] cursor-pointer select-none"
                    style={{ color: 'var(--gem-text)' }}
                  >
                    <input
                      type="radio"
                      name="ig_template"
                      checked={config.ig_template === opt.value}
                      onChange={() => update({ ig_template: opt.value })}
                      className="w-3 h-3"
                      style={{ accentColor: 'var(--gem-accent)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Format per platform */}
          {config.platforms.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--gem-muted)' }}>
                Formato por plataforma
              </span>
              {config.platforms.map((provider) => (
                <div key={provider} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--gem-text)' }}>
                    {PROVIDER_LABELS[provider]}
                  </span>
                  <select
                    aria-label={`Formato para ${PROVIDER_LABELS[provider]}`}
                    disabled={disabled}
                    value={config.formats[provider] ?? defaultFormats[provider] ?? 'link_share'}
                    onChange={(e) => {
                      const val = e.target.value
                      if (ALL_FORMATS.includes(val as DeliveryFormat)) {
                        setFormat(provider, val as DeliveryFormat)
                      }
                    }}
                    className="text-[11px] px-1.5 py-0.5 rounded min-w-0 flex-1"
                    style={{
                      background: 'var(--gem-well, var(--gem-surface))',
                      border: '1px solid var(--gem-border)',
                      color: 'var(--gem-text)',
                    }}
                  >
                    {ALL_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {FORMAT_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
