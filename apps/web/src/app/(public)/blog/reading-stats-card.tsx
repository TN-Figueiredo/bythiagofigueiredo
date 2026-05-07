'use client'

import { useState, useEffect } from 'react'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import type { BlogStrings } from '@/components/blog/_i18n/types'

interface ReadingStatsCardProps {
  posts: Array<{ id: string; readingTime: number }>
  t: BlogStrings
}

export function ReadingStatsCard({ posts, t }: ReadingStatsCardProps) {
  const [stats, setStats] = useState<{ read: number; inProgress: number; totalMin: number } | null>(null)

  useEffect(() => {
    const store = new ReadProgressStore()
    let read = 0
    let inProgress = 0
    let totalMin = 0

    for (const post of posts) {
      const progress = store.getProgress(post.id)
      if (!progress) continue
      if (progress.depth >= 95) {
        read++
        totalMin += post.readingTime
      } else if (progress.depth > 0) {
        inProgress++
        totalMin += Math.round(post.readingTime * progress.depth / 100)
      }
    }

    setStats({ read, inProgress, totalMin })
  }, [posts])

  if (!stats || (stats.read === 0 && stats.inProgress === 0)) return null

  const total = posts.length
  const pct = total > 0 ? Math.round((stats.read / total) * 100) : 0

  return (
    <div aria-label={t.yourProgress} style={{ background: 'var(--pb-paper)', border: '1px solid var(--pb-line)', padding: '14px 18px', marginTop: 8 }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--pb-faint)', marginBottom: 10 }}>
        {t.yourProgress}
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: '"Fraunces", serif', fontSize: 28, color: '#8eda8e', fontWeight: 500 }}>{stats.read}</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.read}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--pb-line)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: '"Fraunces", serif', fontSize: 28, color: 'var(--pb-marker)', fontWeight: 500 }}>{stats.inProgress}</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.inProgress}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--pb-line)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: '"Fraunces", serif', fontSize: 28, color: 'var(--pb-muted)', fontWeight: 500 }}>~{stats.totalMin}</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.minRead}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, height: 3, background: 'var(--pb-line)', borderRadius: 2 }}>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.progressLabel(stats.read, total, pct)} style={{ width: `${pct}%`, height: '100%', background: '#8eda8e', borderRadius: 2 }} />
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--pb-faint)', marginTop: 4, letterSpacing: '0.06em' }}>
        {t.progressLabel(stats.read, total, pct)}
      </div>
    </div>
  )
}
