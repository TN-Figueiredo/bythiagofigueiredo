'use client'

import { useState } from 'react'
import type { AuthorData, EngagementStats } from './types'
import { ShareButtons } from './share-buttons'

type Props = {
  author: AuthorData
  engagement: EngagementStats
  locale: string
  url: string
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function AuthorRow({ author, engagement, locale, url }: Props) {
  const [liked, setLiked] = useState(false)
  const [bookmarked, setBookmarked] = useState(engagement.bookmarked)
  const formattedViews = engagement.views.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en')
  const likes = engagement.likes + (liked ? 1 : 0)

  return (
    <div className="flex items-center gap-4 mb-8 flex-wrap">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-fraunces font-semibold text-sm shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--pb-accent), var(--pb-marker))',
          color: '#1A140C',
          border: '2px solid var(--pb-paper)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      >
        {author.initials}
      </div>
      <div>
        <div className="text-sm text-pb-ink">
          por <span className="underline underline-offset-2">{author.name}</span>
        </div>
        <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
      </div>
      <div className="flex items-center gap-4 ml-auto text-[13px] text-pb-muted font-jetbrains tracking-[0.04em]">
        <span className="flex items-center gap-1.5">
          <EyeIcon />
          {formattedViews}
        </span>
        <button
          onClick={() => setLiked(!liked)}
          className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer transition-colors"
          style={{ color: liked ? 'var(--pb-accent)' : 'var(--pb-muted)', fontSize: 13 }}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
        >
          <HeartIcon filled={liked} />
          {likes}
        </button>
        <button
          onClick={() => setBookmarked(!bookmarked)}
          className="flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer transition-colors font-jetbrains text-[11px] tracking-[0.12em] uppercase"
          style={{ color: bookmarked ? 'var(--pb-accent)' : 'var(--pb-muted)' }}
          aria-label={bookmarked ? 'Remover salvo' : 'Salvar artigo'}
        >
          <BookmarkIcon filled={bookmarked} />
          {bookmarked ? 'salvo' : 'salvar'}
        </button>
      </div>
      <ShareButtons url={url} compact />
    </div>
  )
}
