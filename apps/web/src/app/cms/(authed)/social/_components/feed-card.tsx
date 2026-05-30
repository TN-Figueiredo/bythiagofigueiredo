'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import type { FeedItem } from './feed-grid'

function PlatformChipIcon({ provider, tint }: { provider: string; tint: string }) {
  if (provider === 'instagram') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={tint} stroke="none" />
    </svg>
  )
  if (provider === 'youtube') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill={tint} stroke="none" />
    </svg>
  )
  if (provider === 'facebook') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
    </svg>
  )
  return null
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] bg-green-500/15 text-green-500">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      no ar
    </span>
  )
  if (status === 'scheduled') return (
    <span className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] bg-amber-500/15 text-amber-500">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </svg>
      agendado
    </span>
  )
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] bg-red-500/15 text-red-500">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
      falhou
    </span>
  )
  return (
    <span className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] bg-gray-500/15 text-gray-400">
      {status}
    </span>
  )
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMs < 0) {
    // Future date (scheduled)
    if (diffD >= -1) return `amanha, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  if (diffH < 1) return 'agora'
  if (diffH < 24) return `ha ${diffH}h`
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `ha ${diffD} dias`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function FeedCard({ item }: { item: FeedItem }) {
  const dest = item.destId ? DESTINATIONS[item.destId] : null
  const isStory = item.destId === 'ig_story'
  const dateStr = item.publishedAt ?? item.scheduledAt

  return (
    <Link
      href={`/cms/social/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius,12px)] bg-cms-surface transition-[border-color,transform] duration-[180ms] hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Media area */}
      <div className="relative h-[200px] flex items-center justify-center overflow-hidden border-b border-cms-border" style={{ background: 'rgb(12,11,9)' }}>
        {item.imageUrl ? (
          isStory ? (
            <div className="h-[200px] w-[113px] overflow-hidden" style={{ boxShadow: 'rgba(0,0,0,0.7) 0 10px 28px -12px' }}>
              <Image src={item.imageUrl} alt="" width={113} height={200} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-full w-full">
              <Image src={item.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 248px" className="object-cover" />
            </div>
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-cms-text-dim/30">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs">Sem imagem</span>
          </div>
        )}

        {/* Dest chip — top left */}
        {dest && (
          <div className="absolute left-[10px] top-[10px] inline-flex items-center gap-1.5 rounded-full px-[9px] py-1" style={{ background: 'rgba(8,7,5,0.78)', backdropFilter: 'blur(4px)' }}>
            <PlatformChipIcon provider={item.provider} tint={dest.tint} />
            <span className="text-[11px] font-semibold text-white">{dest.sublabel}</span>
          </div>
        )}

        {/* Status badge — top right */}
        <div className="absolute right-[10px] top-[10px]">
          <StatusBadge status={item.status} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-1 flex-col gap-2 p-[12px_14px]">
        <p className="text-[12.5px] leading-[1.45] text-cms-text line-clamp-2">
          {item.title}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-[11px] text-cms-text-dim/60">
            {formatRelativeDate(dateStr)}
            {dateStr && <> · <span className="font-mono">PT</span></>}
          </span>
        </div>
      </div>
    </Link>
  )
}
