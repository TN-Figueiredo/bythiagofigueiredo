'use client'

import Link from 'next/link'
import { ImageIcon } from 'lucide-react'
import type { StoryRow } from '@/lib/social/actions/stories'

interface StoryCardProps {
  story: StoryRow
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft:      { label: 'Rascunho',   className: 'bg-cms-surface text-cms-text-muted border border-cms-border' },
    scheduled:  { label: 'Agendado',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
    publishing: { label: 'Publicando', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    completed:  { label: 'Publicado',  className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    failed:     { label: 'Erro',       className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    cancelled:  { label: 'Cancelado',  className: 'bg-cms-surface text-cms-text-muted border border-cms-border' },
  }

  const cfg = map[status] ?? { label: status, className: 'bg-cms-surface text-cms-text-muted' }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type SlideComposition = {
  background?: { type?: string; url?: string; color?: string }
  elements?: Array<{ type?: string; src?: string }>
}

function extractThumbnailUrl(story: StoryRow): string | undefined {
  const content = story as unknown as { content?: { cover_image_url?: string; media_urls?: string[] } }
  if (content.content?.media_urls?.[0]) return content.content.media_urls[0]
  if (content.content?.cover_image_url) return content.content.cover_image_url
  const firstSlide = story.story_slides?.[0] as SlideComposition | undefined
  if (firstSlide?.background?.type === 'image' && firstSlide.background.url) {
    return firstSlide.background.url
  }
  const imgEl = firstSlide?.elements?.find(
    (el) => el.type === 'image' && el.src && !el.src.startsWith('{{'),
  )
  if (imgEl?.src) return imgEl.src
  return undefined
}

export function StoryCard({ story }: StoryCardProps) {
  const slideCount = Array.isArray(story.story_slides) ? story.story_slides.length : 0
  const href = story.status === 'draft'
    ? `/cms/social/stories/${story.id}/edit`
    : `/cms/social/stories/${story.id}`

  const dateLabel =
    story.status === 'scheduled' && story.scheduled_at
      ? `Agendado para ${formatDate(story.scheduled_at)}`
      : story.published_at
        ? `Publicado ${formatDate(story.published_at)}`
        : `Criado ${formatDate(story.created_at)}`

  const thumbnailUrl = extractThumbnailUrl(story)

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-all hover:border-cms-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent"
    >
      {/* 9:16 thumbnail area */}
      <div className="relative w-full" style={{ paddingTop: '177.78%' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-cms-surface to-cms-border">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <ImageIcon className="h-8 w-8 text-cms-text-muted opacity-40" />
            </div>
          )}
          {slideCount > 0 && (
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
              {slideCount} slide{slideCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2">
          <StatusBadge status={story.status} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-xs font-medium text-cms-text">
          {story.source_content_type
            ? `Story — ${story.source_content_type}`
            : 'Story manual'}
        </p>
        <p className="truncate text-[10px] text-cms-text-muted">{dateLabel}</p>
      </div>
    </Link>
  )
}
