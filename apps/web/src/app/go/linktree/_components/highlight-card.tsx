'use client'

import React from 'react'

import type { Highlight } from '../_lib/types'

interface HighlightCardProps {
  highlight: Highlight
  locale: string
}

export function HighlightCard({ highlight, locale }: HighlightCardProps) {
  if (!highlight.active) return null
  const isPt = locale.startsWith('pt')
  const badge = isPt ? highlight.badge_pt : highlight.badge_en
  const title = isPt ? highlight.title_pt : highlight.title_en
  const desc = isPt ? highlight.desc_pt : highlight.desc_en
  const cta = isPt ? highlight.cta_pt : highlight.cta_en

  if (!title) return null

  return (
    <section id="highlight">
      <a
        href={highlight.url}
        className="block bg-[var(--pb-accent)] rounded-sm p-3 transition-opacity hover:opacity-95"
      >
        {badge && (
          <span className="inline-block text-[10px] font-bold tracking-widest uppercase bg-[rgba(251,246,232,0.85)] text-[var(--pb-accent)] px-2 py-0.5 mb-2">
            {badge}
          </span>
        )}
        <h2 className="text-base font-bold text-[#1A1410] font-[family-name:var(--font-fraunces)] leading-tight mb-1">
          {title}
        </h2>
        {desc && (
          <p className="text-xs text-[rgba(26,20,16,0.6)] font-[family-name:var(--font-fraunces)] mb-3">
            {desc}
          </p>
        )}
        <span className="inline-flex items-center gap-1 bg-[#1A1410] text-[var(--pb-accent)] text-xs font-semibold px-3 py-1.5 rounded-sm font-[family-name:var(--font-fraunces)]">
          {cta || (isPt ? 'Saiba mais' : 'Learn more')} →
        </span>
      </a>
    </section>
  )
}
