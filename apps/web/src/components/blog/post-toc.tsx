'use client'

import { useScrollState } from './scroll-context'
import { ShareButtons } from './share-buttons'
import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'
import type { TocEntry } from './types'

type Props = {
  sections: TocEntry[]
  url: string
  locale?: string
}

export function PostToc({ sections, url, locale }: Props) {
  const { activeSection, resolvedSections } = useScrollState()
  const t = locale === 'pt-BR' ? ptBR : en
  const displaySections = resolvedSections.length > 0 ? resolvedSections : sections

  return (
    <div>
      <div className="blog-sidebar-label">{t.inThisText.toUpperCase()}</div>
      <nav aria-label={t.inThisText}>
        <ul className="list-none">
          {displaySections.map((entry) => {
            const isActive = activeSection === entry.slug
            return (
              <li key={entry.slug} style={{ marginLeft: '-2px' }}>
                <a
                  href={`#${entry.slug}`}
                  className={`block no-underline text-[13px] py-1 border-l-2 transition-all leading-snug ${
                    entry.depth === 3 ? 'pl-6 text-xs' : 'pl-3'
                  } ${isActive ? 'text-pb-ink border-pb-accent font-medium' : 'text-pb-muted border-transparent'}`}
                  onClick={(e) => {
                    e.preventDefault()
                    const el = document.getElementById(entry.slug)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      window.history.pushState(null, '', `#${entry.slug}`)
                    }
                  }}
                >
                  {entry.text}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <hr className="border-none border-t border-dashed border-[--pb-line] my-4" />
      <div className="blog-sidebar-label">{t.share.toUpperCase()}</div>
      <ShareButtons url={url} locale={locale} />
    </div>
  )
}

export function BackToTop({ locale }: { locale?: string }) {
  const { progress } = useScrollState()
  const t = locale === 'pt-BR' ? ptBR : en

  if (progress < 0.15) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t.backToTop}
      className="font-jetbrains text-[11px] text-pb-accent cursor-pointer mt-3 flex items-center gap-1 bg-transparent border-none p-0"
    >
      {t.backToTop} ↑
    </button>
  )
}
