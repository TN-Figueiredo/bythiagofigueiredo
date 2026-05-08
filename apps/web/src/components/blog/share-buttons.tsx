'use client'

import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'

type Props = {
  url: string
  compact?: boolean
  locale?: string
}

export function ShareButtons({ url, compact, locale }: Props) {
  const t = locale === 'pt-BR' ? ptBR : en

  return (
    <div className={`flex gap-2 ${compact ? 'ml-3' : ''}`}>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.shareOnX}
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.shareOnLinkedIn}
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        in
      </a>
      <button
        onClick={() => {
          try { navigator.clipboard.writeText(url) } catch { /* clipboard API may not be available */ }
        }}
        aria-label={t.copyLink}
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors cursor-pointer"
      >
        <span role="img" aria-hidden="true">🔗</span>
      </button>
    </div>
  )
}
