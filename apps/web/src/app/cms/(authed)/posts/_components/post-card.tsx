'use client'

import Link from 'next/link'
import type { Provider } from '@tn-figueiredo/social'

export interface PostBoardItem {
  id: string
  title: string
  hook: string | null
  status: string
  coverImageUrl: string | null
  locales: string[]
  socialPlatforms: Provider[]
  scheduledAt: string | null
  publishedAt: string | null
  pipelineCode: string | null
  sortOrder: number
}

interface PostCardProps {
  item: PostBoardItem
  isDragging?: boolean
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#f87171',
  facebook: '#60a5fa',
  instagram: '#e879f9',
  bluesky: '#38bdf8',
}

export function PostCard({ item, isDragging }: PostCardProps) {
  return (
    <Link
      href={`/cms/posts/${item.id}`}
      className="block rounded-lg border p-3 transition-all hover:border-[var(--gem-accent)]"
      style={{
        background: 'var(--gem-surface, #0d1118)',
        borderColor: isDragging ? 'var(--gem-accent, #818cf8)' : 'var(--gem-border, #1a2030)',
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      <div className="flex gap-2.5">
        {item.coverImageUrl && (
          <img
            src={item.coverImageUrl}
            alt=""
            className="w-12 h-12 rounded object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--gem-text, #e2e8f0)' }}>
            {item.title}
          </p>
          {item.hook && (
            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--gem-muted, #8b949e)' }}>
              {item.hook}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {item.locales.map(l => (
            <span
              key={l}
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
            >
              {l === 'pt-br' ? 'PT' : 'EN'}
            </span>
          ))}
          {item.socialPlatforms.map(p => (
            <span
              key={p}
              className="w-3 h-3 rounded-full"
              style={{ background: PLATFORM_COLORS[p] ?? '#666' }}
              title={p}
            />
          ))}
        </div>
        {item.pipelineCode && (
          <span className="text-[9px] font-mono" style={{ color: 'var(--gem-dim, #3d4654)' }}>
            ← {item.pipelineCode}
          </span>
        )}
      </div>

      {item.scheduledAt && (
        <div className="mt-1.5 text-[9px]" style={{ color: 'var(--gem-muted, #8b949e)' }}>
          {new Date(item.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </Link>
  )
}
