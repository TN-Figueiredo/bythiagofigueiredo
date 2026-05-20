'use client'

import React from 'react'

import { getIcon, ArrowRightIcon } from './icons'

interface LinkRowProps {
  label: string
  desc: string
  url: string
  icon: string
  subscriberCount?: number
  isExternal?: boolean
  locale?: string
  linkKey?: string
  onTrackClick?: (key: string) => void
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function LinkRow({ label, desc, url, icon, subscriberCount, isExternal = true, locale, linkKey, onTrackClick }: LinkRowProps) {
  const Icon = getIcon(icon)
  const isYouTube = icon === 'youtube'
  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-3 px-3 min-h-[48px] border-b border-[var(--pb-line)] last:border-b-0 transition-colors hover:bg-[var(--pb-paper2)]"
      onClick={() => linkKey && onTrackClick?.(linkKey)}
    >
      <span
        className="flex-shrink-0 w-[30px] h-[30px] rounded-md flex items-center justify-center"
        style={{ background: isYouTube ? 'rgba(255,51,51,0.1)' : 'rgba(255,130,64,0.1)' }}
      >
        <Icon color={isYouTube ? 'var(--pb-yt)' : 'var(--pb-accent)'} size={14} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)]">{label}</span>
        <span className="block text-[11px] text-[var(--pb-muted)] font-mono mt-0.5">
          {desc}
          {subscriberCount ? (
            <span className="text-[var(--pb-accent)] font-semibold"> · {formatCount(subscriberCount)} {locale?.startsWith('pt') ? 'inscritos' : 'subs'}</span>
          ) : null}
        </span>
      </span>
      <ArrowRightIcon color="var(--pb-faint)" size={10} />
    </a>
  )
}
