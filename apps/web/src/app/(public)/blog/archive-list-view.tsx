'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { localePath } from '@/lib/i18n/locale-path'
import type { BlogStrings } from '@/components/blog/_i18n/types'
import { highlightText } from './search-highlight'
import type { ArchivePost } from './blog-archive-client'

interface ArchiveListViewProps {
  posts: ArchivePost[]
  locale: 'pt-BR' | 'en'
  query: string
  t: BlogStrings
  activeIndex: number
}

export function ArchiveListView({ posts, locale, query, t, activeIndex }: ArchiveListViewProps) {
  const readStore = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new ReadProgressStore()
  }, [])

  return (
    <div>
      {posts.map((post, i) => {
        const progress = readStore?.getProgress(post.id)
        const isRead = (progress?.depth ?? 0) >= 95
        const inProgress = progress && progress.depth > 0 && !isRead

        return (
          <Link
            key={post.id}
            href={localePath(`/blog/${post.slug}`, locale)}
            data-card-index={i}
            className="flex items-center gap-4 py-3 no-underline"
            style={{
              borderBottom: '1px solid #2E2718',
              color: 'inherit',
              outline: activeIndex === i ? '2px solid #FF8240' : 'none',
              outlineOffset: 2,
            }}
          >
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, width: 80, flexShrink: 0, color: '#6B634F' }}>{post.date}</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, width: 64, flexShrink: 0, letterSpacing: '0.08em', textTransform: 'uppercase', color: post.categoryColor }}>{post.category}</span>
            <span className="flex-1" style={{ fontFamily: '"Fraunces", serif', fontSize: 16, color: '#EFE6D2' }}>
              {highlightText(post.title, query)}
              {post.previousPostId && (
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, marginLeft: 8, color: '#FFE37A' }}>{t.series}</span>
              )}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, width: 48, textAlign: 'right', color: '#6B634F' }}>{post.readingTime} {t.minuteRead}</span>
            <span style={{ width: 36, textAlign: 'center', fontSize: 10 }}>
              {isRead && <span style={{ color: '#8eda8e' }}>✓</span>}
              {inProgress && <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#ccc' }}>{Math.round(progress?.depth ?? 0)}%</span>}
              {!isRead && !inProgress && <span style={{ color: '#6B634F' }}>—</span>}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
