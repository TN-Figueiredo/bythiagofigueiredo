'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { LinktreePageData } from '../_lib/types'
import { Header } from './header'
import { HighlightCard } from './highlight-card'
import { LatestSection } from './latest-section'
import { LangSection } from './lang-section'
import { LinkRow } from './link-row'
import { SocialBar } from './social-bar'
import { ShareButton } from './share-button'
import { ThemeToggle } from './theme-toggle'
import { useLinktreeTracking } from './use-linktree-tracking'

interface LinktreeClientProps extends LinktreePageData {
  initialLocale: string
  initialTheme: string
}

function resolveTheme(pref: string): 'dark' | 'light' {
  if (pref === 'dark' || pref === 'light') return pref
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function setCookie(name: string, value: string, domain: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${value}; path=/; domain=.${domain}; max-age=31536000; SameSite=Lax${secure}`
}

export function LinktreeClient({
  initialLocale,
  initialTheme,
  config,
  site,
  author,
  latestPost,
  latestVideo,
  socials,
  sections,
  sharedLinks,
}: LinktreeClientProps) {
  const [locale, setLocale] = useState(initialLocale)
  const [themePref, setThemePref] = useState(initialTheme)
  const { trackClick } = useLinktreeTracking(site.id)
  const theme = resolveTheme(themePref)
  const siteUrl = `https://${site.primaryDomain}`
  const isPt = locale.startsWith('pt')
  const sortedSections = useMemo(() => [...sections].sort((a, b) => {
    if (a.locale === locale) return -1
    if (b.locale === locale) return 1
    return 0
  }), [sections, locale])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  function toggleLocale(newLocale: string) {
    setLocale(newLocale)
    setCookie('btf_go_lang', newLocale, site.primaryDomain)
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemePref(next)
    setCookie('btf_theme', next, site.primaryDomain)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <main className="min-h-dvh bg-[var(--pb-bg)] px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-[400px] flex flex-col gap-3">
        {/* Top bar: locale + theme */}
        <div className="flex justify-end items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Language">
            {site.supportedLocales.map((loc) => {
              const label = loc.startsWith('pt') ? 'PT' : 'EN'
              const isActive = locale === loc
              return (
                <button
                  type="button"
                  key={loc}
                  onClick={() => toggleLocale(loc)}
                  aria-pressed={isActive}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 min-h-[36px] rounded-full border transition-colors ${
                    isActive
                      ? 'bg-[rgba(255,130,64,0.12)] border-[var(--pb-accent)] text-[var(--pb-accent)]'
                      : 'border-[var(--pb-line)] text-[var(--pb-muted)] hover:text-[var(--pb-accent)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <Header site={site} author={author} config={config} locale={locale} />

        <HighlightCard highlight={config.highlight} locale={locale} onTrackClick={trackClick} />

        <LatestSection post={latestPost} video={latestVideo} locale={locale} siteUrl={siteUrl} onTrackClick={trackClick} />

        {sortedSections.map((section) => (
          <LangSection key={section.locale} section={section} siteUrl={site.primaryDomain} locale={locale} onTrackClick={trackClick} />
        ))}

        {/* Shared links */}
        {sharedLinks.length > 0 && (
          <section aria-label={isPt ? 'Links' : 'Links'}>
            <div
              className="relative bg-[var(--pb-paper)] rounded-sm shadow-[var(--pb-shadow-card)] overflow-hidden"
              style={{ transform: 'rotate(0.3deg)' }}
            >
              <div
                className="absolute -top-1 left-1/2 -ml-5 w-9 h-3 pointer-events-none motion-safe:block hidden"
                style={{ background: 'var(--pb-marker, rgba(255,226,140,0.55))', opacity: 0.55, transform: 'rotate(-2deg)' }}
              />
              <div className="pt-3">
                {sharedLinks.map((link) => (
                  <LinkRow
                    key={link.id}
                    label={isPt ? link.label_pt : link.label_en}
                    desc=""
                    url={link.url.startsWith('/') ? `${siteUrl}${isPt ? '/pt' : ''}${link.url}` : link.url}
                    icon={link.icon}
                    locale={locale}
                    isExternal={!link.url.startsWith('/')}
                    linkKey={`shared:${link.id}`}
                    onTrackClick={trackClick}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <SocialBar profiles={socials} onTrackClick={trackClick} />

        <ShareButton
          url={`https://go.${site.primaryDomain}`}
          title={`Links — ${site.name}`}
          locale={locale}
        />

        <footer className="text-center text-[10px] text-[var(--pb-faint)] opacity-60 font-mono tracking-wide mt-2">
          go.{site.primaryDomain}
        </footer>
      </div>
    </main>
  )
}
