'use client'

import { useState, useEffect } from 'react'
import { PlatformIcon } from '../../_components/shared/platform-icon'
import { searchContent, type ContentItem } from '../_actions/search-content'

interface CMSContentPickerProps {
  onSelect: (item: ContentItem) => void
}

const TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'blog', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'video', label: 'Vídeo' },
] as const

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  blog: { label: 'BLOG', bg: 'var(--green-soft, rgba(34,197,94,0.15))', color: 'var(--green, #22c55e)' },
  newsletter: { label: 'NEWSLETTER', bg: 'var(--amber-soft, rgba(245,158,11,0.15))', color: 'var(--amber, #f59e0b)' },
  campaign: { label: 'CAMPANHA', bg: 'rgba(110,99,242,0.15)', color: 'rgb(155,147,246)' },
  video: { label: 'VÍDEO', bg: 'rgba(217,97,74,0.15)', color: 'var(--red, #ef4444)' },
}

const DEST_PLATFORMS = ['instagram', 'youtube', 'facebook'] as const

function PlatformDot({ provider }: { provider: string }) {
  const colors: Record<string, string> = { instagram: '#E8823C', youtube: '#E0574E', facebook: '#5B7FD6' }
  const bg = colors[provider] ?? '#888'
  return (
    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px]" style={{ background: bg }}>
      <PlatformIcon provider={provider} size={12} variant="solid" />
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'agora'
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'há 1 dia'
  return `há ${diffD} dias`
}

export function CMSContentPicker({ onSelect }: CMSContentPickerProps) {
  const [tab, setTab] = useState<string>('all')
  const [items, setItems] = useState<ContentItem[]>([])
  const [counts, setCounts] = useState({ all: 0, blog: 0, newsletter: 0, campaign: 0, video: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const typeFilter = tab === 'all' ? undefined : tab as 'blog' | 'newsletter' | 'campaign' | 'video'

    searchContent({ type: typeFilter, limit: 20 }).then(result => {
      if (cancelled) return
      setItems(result.items)
      setCounts(result.counts)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [tab])

  return (
    <div>
      {/* Cowork banner */}
      <div className="mb-[18px] flex gap-[9px] rounded-xl p-[12px_15px] opacity-95" style={{ background: 'var(--cowork, #6e63f2)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-white">
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
          <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
        <div className="text-white">
          <div className="text-[13.5px] font-semibold">Compartilhar do CMS · automático</div>
          <div className="mt-0.5 text-xs leading-[1.5] opacity-85">
            Escolha um conteúdo — eu detecto o idioma, monto a arte no template e escrevo as legendas por destino. Você só revisa.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-5 border-b border-cms-border">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative cursor-pointer border-none bg-transparent pb-[11px] px-px text-[13.5px] transition-colors ${
              tab === t.key ? 'font-semibold text-cms-text' : 'font-medium text-cms-text-dim'
            }`}
          >
            {t.label} <span className="font-mono text-[11px] text-cms-text-dim/60">{counts[t.key as keyof typeof counts] ?? 0}</span>
            {tab === t.key && <div className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-cms-accent" />}
          </button>
        ))}
      </div>

      {/* Content items */}
      {loading ? (
        <div className="flex flex-col gap-[10px]">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[88px] animate-pulse rounded-[var(--radius,12px)] bg-cms-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim/30">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <p className="text-sm text-cms-text-dim">Nenhum conteúdo publicado encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {items.map(item => {
            const badge = TYPE_BADGE[item.type] ?? { label: item.type.toUpperCase(), bg: 'var(--surface-3)', color: 'var(--ink-dim)' }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="cursor-pointer rounded-[var(--radius,12px)] border border-cms-border bg-cms-surface p-[14px] text-left transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-cms-accent/40"
              >
                <div className="flex items-center gap-[14px]">
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[9px] bg-cms-surface" style={{ background: 'var(--surface-3, rgba(255,255,255,0.06))' }}>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    ) : item.type === 'newsletter' ? (
                      <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))' }}>
                        <span className="font-fraunces text-xs font-bold" style={{ color: 'rgb(31,27,23)' }}>TF</span>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim/30">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <span className="text-[11px] text-cms-text-dim/60">{formatRelativeTime(item.updatedAt)}</span>
                    </div>
                    <div className="truncate text-sm font-semibold leading-[1.3] text-cms-text">{item.title}</div>
                    {item.description && (
                      <div className="mt-[3px] truncate text-xs text-cms-text-dim">{item.description}</div>
                    )}
                  </div>
                  {/* Platform dots + chevron */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex gap-1">
                      {DEST_PLATFORMS.map(p => <PlatformDot key={p} provider={p} />)}
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/40">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
