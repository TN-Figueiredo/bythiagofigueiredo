'use client'

import { useScrollState } from './scroll-context'
import { ShareButtons } from './share-buttons'
import type { TocEntry } from './types'

type Props = {
  sections: TocEntry[]
  url: string
}

export function PostToc({ sections, url }: Props) {
  const { activeSection } = useScrollState()

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <aside className="blog-sidebar blog-detail-sidebar">
      <div className="blog-sidebar-label">NESTE TEXTO</div>
      <nav aria-label="Sumario do artigo">
        <ul className="list-none">
          {sections.map((entry) => {
            const isActive = activeSection === entry.slug
            return (
              <li
                key={entry.slug}
                role="button"
                tabIndex={0}
                className={`text-[13px] py-1 cursor-pointer border-l-2 transition-all leading-snug ${
                  entry.depth === 3 ? 'pl-6 text-xs' : 'pl-3'
                } ${isActive ? 'text-pb-ink border-pb-accent font-medium' : 'text-pb-muted border-transparent'}`}
                style={{ marginLeft: '-2px' }}
                onClick={() => {
                  const el = document.getElementById(entry.slug)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    const el = document.getElementById(entry.slug)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              >
                {entry.text}
              </li>
            )
          })}
        </ul>
      </nav>
      <hr className="border-none border-t border-dashed border-[--pb-line] my-4" />
      <div className="blog-sidebar-label">COMPARTILHAR</div>
      <ShareButtons url={url} />
      <button
        onClick={scrollToTop}
        aria-label="Voltar ao topo"
        className="font-jetbrains text-[11px] text-pb-accent cursor-pointer mt-3 flex items-center gap-1 bg-transparent border-none p-0"
      >
        TOPO ↑
      </button>
    </aside>
  )
}
