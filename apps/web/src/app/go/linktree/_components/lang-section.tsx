'use client'

import React from 'react'

import type { LangSection as LangSectionType } from '../_lib/types'
import { LinkRow } from './link-row'

interface LangSectionProps {
  section: LangSectionType
  siteUrl: string
  locale?: string
}

export function LangSection({ section, siteUrl, locale }: LangSectionProps) {
  const isEnglish = section.locale.startsWith('en')
  return (
    <section id={section.locale.startsWith('pt') ? 'pt' : 'en'} aria-label={section.label}>
      <div
        className="relative bg-[var(--pb-paper)] rounded-sm shadow-[var(--pb-shadow-card)] overflow-hidden"
        style={{ transform: `rotate(${isEnglish ? -0.5 : 0.6}deg)` }}
      >
        {/* Tape */}
        <div
          className="absolute -top-1 left-1/2 -ml-6 w-12 h-3 pointer-events-none motion-safe:block hidden"
          style={{
            background: isEnglish ? 'rgba(180,210,255,0.40)' : 'var(--pb-marker, rgba(255,226,140,0.55))',
            opacity: isEnglish ? 0.4 : 0.55,
            transform: isEnglish ? 'rotate(3deg)' : 'rotate(-3deg)',
          }}
        />
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 border-b border-[var(--pb-line)]">
          <span className="text-lg" aria-hidden="true">{section.flag}</span>
          <span className="text-base font-bold text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)]">{section.label}</span>
          <span className="ml-auto text-xs text-[var(--pb-accent)] font-[family-name:var(--font-caveat)] opacity-45">{section.hand}</span>
        </div>
        {/* Rows */}
        <div>
          {section.items.map((item) => (
            <LinkRow
              key={item.id}
              label={item.label}
              desc={item.desc}
              url={item.url}
              icon={item.icon}
              subscriberCount={item.subscriberCount}
              locale={locale ?? section.locale}
              isExternal={!item.url.startsWith(`https://${siteUrl}`)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
