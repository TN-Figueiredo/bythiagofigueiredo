'use client'

import { useState, useEffect, useCallback } from 'react'
import { getContentForSocialPost } from '@/lib/social/actions'
import type { CMSContent } from './use-composer'

interface CMSPickerProps {
  siteId: string
  onSelect: (content: CMSContent) => void
}

type ContentTab = 'all' | 'blog' | 'newsletter' | 'video'

const TABS: { key: ContentTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'blog', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'video', label: 'Video' },
]

interface ContentItem {
  id: string
  type: string
  title: string
  excerpt: string | null
  imageUrl: string | null
  url: string
  locale: string
}

export function CMSPicker({ siteId, onSelect }: CMSPickerProps) {
  const [tab, setTab] = useState<ContentTab>('all')
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      const types = tab === 'all' ? ['blog', 'newsletter', 'video'] : [tab]
      const results: ContentItem[] = []
      for (const type of types) {
        const result = await getContentForSocialPost(type, siteId)
        if (result.ok && result.data) {
          results.push({
            id: result.data.contentId,
            type,
            title: result.data.title,
            excerpt: result.data.excerpt ?? null,
            imageUrl: result.data.image ?? null,
            url: result.data.url ?? '',
            locale: result.data.locale ?? 'pt-BR',
          })
        }
      }
      setItems(results)
    } finally {
      setLoading(false)
    }
  }, [tab, siteId])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  function handleSelect(item: ContentItem) {
    setSelected(item.id)
    onSelect({
      id: item.id,
      type: item.type,
      title: item.title,
      excerpt: item.excerpt,
      imageUrl: item.imageUrl,
      url: item.url,
      locale: item.locale,
    })
  }

  const TYPE_BADGES: Record<string, { label: string; color: string }> = {
    blog: { label: 'BLOG', color: 'bg-blue-500/15 text-blue-400' },
    newsletter: { label: 'NEWSLETTER', color: 'bg-green-500/15 text-green-400' },
    video: { label: 'VIDEO', color: 'bg-red-500/15 text-red-400' },
  }

  return (
    <div className="space-y-4">
      {/* Cowork banner */}
      <div className="rounded-lg bg-[var(--cms-cowork,#7c3aed)]/10 border border-[var(--cms-cowork,#7c3aed)]/20 px-4 py-2">
        <p className="text-xs font-medium text-[var(--cms-cowork,#7c3aed)]">
          Montado automatico pela IA
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-cms-accent text-white'
                : 'bg-cms-surface text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content list */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-cms-surface" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-cms-text-muted py-8 text-center">Nenhum conteudo encontrado</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                selected === item.id
                  ? 'border-cms-accent bg-cms-accent/5'
                  : 'border-cms-border bg-cms-surface hover:border-cms-text/20'
              }`}
            >
              {item.imageUrl && (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cms-bg">
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGES[item.type]?.color ?? 'bg-gray-500/15 text-gray-400'}`}>
                    {TYPE_BADGES[item.type]?.label ?? item.type.toUpperCase()}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-cms-surface text-cms-text-dim">
                    {item.locale === 'pt-BR' ? 'PT' : 'EN'}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-cms-text">{item.title}</p>
                {item.excerpt && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-cms-text-muted">{item.excerpt}</p>
                )}
              </div>
            </button>
          ))}

          {selected && (
            <div className="rounded-lg bg-[var(--cms-cowork,#7c3aed)]/5 border border-[var(--cms-cowork,#7c3aed)]/20 px-3 py-2">
              <p className="text-xs text-[var(--cms-cowork,#7c3aed)]">Montado automatico</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
