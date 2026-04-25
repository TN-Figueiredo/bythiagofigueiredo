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

  return (
    <div>
      <div className="blog-sidebar-label">NESTE TEXTO</div>
      <nav aria-label="Sumario do artigo">
        <ul className="list-none">
          {sections.map((entry) => {
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
      <div className="blog-sidebar-label">COMPARTILHAR</div>
      <ShareButtons url={url} />
    </div>
  )
}

export function BackToTop() {
  const { progress } = useScrollState()

  if (progress < 0.15) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      className="font-jetbrains text-[11px] text-pb-accent cursor-pointer mt-3 flex items-center gap-1 bg-transparent border-none p-0"
    >
      TOPO ↑
    </button>
  )
}
