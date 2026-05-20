'use client'

import React from 'react'

import type { LatestPost, LatestVideo } from '../_lib/types'

interface LatestSectionProps {
  post: LatestPost | null
  video: LatestVideo | null
  locale: string
  siteUrl: string
}

export function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale.startsWith('pt') ? 'pt-BR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatViews(n: number, locale: string): string {
  const label = locale.startsWith('pt') ? 'views' : 'views'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${label}`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${label}`
  return `${n} ${label}`
}

export function LatestSection({ post, video, locale, siteUrl }: LatestSectionProps) {
  if (!post && !video) return null
  const isPt = locale.startsWith('pt')

  return (
    <section id="latest" aria-label={isPt ? 'Novidades' : 'Latest'}>
      <div
        className="relative bg-[var(--pb-paper)] rounded-sm p-3 shadow-[var(--pb-shadow-card)]"
        style={{ transform: 'rotate(-0.8deg)' }}
      >
        {/* Tape */}
        <div
          className="absolute -top-1 left-1/2 -ml-6 w-12 h-3 pointer-events-none motion-safe:block hidden"
          style={{ background: 'var(--pb-marker, rgba(255,226,140,0.55))', opacity: 0.55, transform: 'rotate(-2deg)' }}
        />
        <div className="flex items-center gap-1.5 pt-1 mb-2">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--pb-faint)]">
            {isPt ? 'Novidades' : 'Latest'}
          </span>
          <span className="text-xs text-[var(--pb-accent)] font-[family-name:var(--font-caveat)] opacity-55">
            {isPt ? 'fresquinho ✦' : 'fresh ✦'}
          </span>
        </div>

        {post && (
          <a
            href={`${siteUrl}/blog/${post.slug}`}
            className="block p-2 border-l-[3px] bg-[rgba(255,255,255,0.02)] mb-1 transition-colors hover:bg-[var(--pb-paper2)]"
            style={{ borderColor: post.tagColor ?? 'var(--pb-accent)' }}
          >
            <span className="block text-[10px] font-bold tracking-widest uppercase text-[var(--pb-muted)]">
              <span aria-hidden="true">▤ </span>{isPt ? 'Último post' : 'Latest post'}
            </span>
            <span className="block text-sm font-semibold text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)] mt-0.5">
              {post.title}
            </span>
            <span className="block text-[11px] text-[var(--pb-faint)] font-mono mt-0.5">
              {formatDate(post.publishedAt, locale)} · {post.readingTimeMin} min
              {post.tagName && (
                <span style={{ color: post.tagColor ?? 'var(--pb-accent)' }}> · {post.tagName}</span>
              )}
            </span>
          </a>
        )}

        {video && (
          <a
            href={`https://youtube.com/watch?v=${video.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 border-l-[3px] border-[var(--pb-yt)] bg-[rgba(255,255,255,0.02)] transition-colors hover:bg-[var(--pb-paper2)]"
          >
            <span className="block text-[10px] font-bold tracking-widest uppercase text-[var(--pb-yt)]">
              <span aria-hidden="true">▶ </span>{isPt ? 'Último vídeo' : 'Latest video'}
            </span>
            <span className="block text-sm font-semibold text-[var(--pb-ink)] font-[family-name:var(--font-fraunces)] mt-0.5">
              {video.title}
            </span>
            <span className="block text-[11px] text-[var(--pb-faint)] font-mono mt-0.5">
              {formatDate(video.publishedAt, locale)} · {video.duration} · {formatViews(video.viewCount, locale)}
            </span>
          </a>
        )}
      </div>
    </section>
  )
}
