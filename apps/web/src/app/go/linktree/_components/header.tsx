'use client'

import React from 'react'

import { useEffect, useState } from 'react'
import type { AuthorInfo, SiteInfo, LinktreeConfig } from '../_lib/types'

interface HeaderProps {
  site: SiteInfo
  author: AuthorInfo
  config: LinktreeConfig
  locale: string
}

function getGreeting(locale: string): string {
  const hour = new Date().getHours()
  const isPt = locale.startsWith('pt')
  if (hour >= 5 && hour < 12) return isPt ? 'bom dia ✦' : 'good morning ✦'
  if (hour >= 12 && hour < 18) return isPt ? 'boa tarde ✦' : 'good afternoon ✦'
  return isPt ? 'boa noite ✦' : 'good evening ✦'
}

export function Header({ site, author, config, locale }: HeaderProps) {
  const [greeting, setGreeting] = useState('')
  const isPt = locale.startsWith('pt')
  const tagline = isPt ? config.tagline_pt : config.tagline_en
  const siteUrl = `https://${site.primaryDomain}`

  useEffect(() => {
    setGreeting(getGreeting(locale))
  }, [locale])

  return (
    <header className="text-center mb-3">
      {/* Carimbo — TF monogram */}
      <a
        href={siteUrl}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-[var(--pb-accent)] mb-1.5 transition-opacity hover:opacity-80"
        aria-label={`Go to ${site.name}`}
      >
        <span className="text-[22px] font-[family-name:var(--font-fraunces)] text-[var(--pb-ink)]">
          <span className="font-medium">T</span>
          <span className="italic text-[var(--pb-accent)]">F</span>
        </span>
      </a>
      <div className="text-[9px] opacity-35 italic text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)]">by</div>
      {/* Name */}
      <a
        href={siteUrl}
        className="block text-sm font-medium text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)] hover:underline hover:decoration-[var(--pb-accent)] hover:underline-offset-[3px]"
      >
        {author.displayName}
      </a>
      {/* Tagline */}
      {tagline && (
        <p className="text-[11px] text-[var(--pb-muted)] font-mono mt-0.5">{tagline}</p>
      )}
      {/* Greeting */}
      {greeting && (
        <p className="text-xs text-[var(--pb-accent)] font-[family-name:var(--font-caveat)] opacity-60 mt-0.5">
          {greeting}
        </p>
      )}
    </header>
  )
}
