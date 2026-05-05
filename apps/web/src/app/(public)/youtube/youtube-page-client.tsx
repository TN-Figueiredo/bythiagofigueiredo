'use client'

import { useState, useEffect, useMemo } from 'react'
import type { YouTubePageData, YouTubeVideoView } from './youtube-types'
import { YouTubeHero } from './youtube-hero'
import { YouTubeChannelStrip } from './youtube-channel-strip'
import { YouTubeStatsStrip } from './youtube-stats-strip'
import { YouTubeFeatureBlock } from './youtube-feature-block'
import { YouTubeCommentsWall } from './youtube-comments-wall'
import { YouTubeSubscribe } from './youtube-subscribe'
import { YouTubeArchive } from './youtube-archive'

interface Props {
  data: YouTubePageData
  locale: 'pt' | 'en'
}

const PAGE_SIZE = 6

export function YouTubePageClient({ data, locale }: Props) {
  const { videos, channels, categories, comments } = data
  const L = locale

  // Filter state
  const readParams = () => {
    if (typeof window === 'undefined') return { cat: 'latest', ch: 'all', tag: '', q: '' }
    const p = new URLSearchParams(window.location.search)
    return {
      cat: p.get('cat') || 'latest',
      ch: p.get('ch') || 'all',
      tag: p.get('tag') || '',
      q: p.get('q') || '',
    }
  }
  const [filters, setFilters] = useState(readParams)
  const [page, setPage] = useState(1)

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams()
    if (filters.cat !== 'latest') p.set('cat', filters.cat)
    if (filters.ch !== 'all') p.set('ch', filters.ch)
    if (filters.tag) p.set('tag', filters.tag)
    if (filters.q) p.set('q', filters.q)
    const qs = p.toString()
    const url = window.location.pathname + (qs ? '?' + qs : '')
    window.history.replaceState(null, '', url)
  }, [filters])

  const update = (patch: Partial<typeof filters>) => { setFilters(f => ({ ...f, ...patch })); setPage(1) }
  const reset = () => { setFilters({ cat: 'latest', ch: 'all', tag: '', q: '' }); setPage(1) }

  // Computed
  const sortedAll = useMemo(() => [...videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [videos])
  const latestPT = sortedAll.find(v => v.locale === 'pt')
  const latestEN = sortedAll.find(v => v.locale === 'en')
  const enOlder = sortedAll.filter(v => v.locale === 'en' && v.id !== latestEN?.id).slice(0, 2)

  const featurePick = sortedAll.find(v => v.isFeatured) ?? sortedAll[0] ?? null
  const featureSidekicks = sortedAll.filter(v => v.id !== featurePick?.id).slice(0, 3)

  // Filtering
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return sortedAll.filter(v => {
      if (filters.ch !== 'all' && v.locale !== filters.ch) return false
      if (filters.cat !== 'latest' && v.categorySlug !== filters.cat) return false
      if (filters.tag && !v.tags.includes(filters.tag)) return false
      if (q) {
        const hay = [v.title, v.titleTranslation, v.description, v.categorySlug, ...v.tags].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [sortedAll, filters])

  const hasFilters = filters.cat !== 'latest' || filters.ch !== 'all' || !!filters.tag || !!filters.q
  const visible = filtered.slice(0, page * PAGE_SIZE)

  // Helpers
  const fmtNum = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', L === 'pt' ? ',' : '.') + 'k'
    return String(n)
  }
  const goToArchive = (patch: Partial<typeof filters>) => {
    update(patch)
    setTimeout(() => {
      document.getElementById('archive')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const hoursTotal = (data.totalDurationSeconds / 3600).toFixed(1).replace('.', L === 'pt' ? ',' : '.')

  // Tag stats
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {}
    videos.forEach(v => v.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, n]) => ({ tag, n }))
  }, [videos])

  // Theme colors (dark mode -- matching design/youtube.jsx)
  const theme = {
    bg: '#14110B',
    ink: '#F2EBDB',
    muted: 'rgba(242,235,219,0.65)',
    faint: 'rgba(242,235,219,0.4)',
    line: 'rgba(242,235,219,0.12)',
    accent: '#C7702E',
    marker: '#FFE37A',
    yt: '#FF2D20',
    paper: 'rgba(242,235,219,0.055)',
    paper2: 'rgba(242,235,219,0.04)',
    tape: 'rgba(255,227,122,0.35)',
    tape2: 'rgba(199,112,46,0.4)',
    tapeR: 'rgba(255,45,32,0.3)',
    hand: { fontFamily: '"Caveat", cursive', fontWeight: 600 } as const,
  }

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: '100vh' }} data-testid="youtube-page-client">
      <YouTubeHero
        locale={L} theme={theme}
        latestPT={latestPT ?? null} latestEN={latestEN ?? null}
        enOlder={enOlder} fmtNum={fmtNum}
      />
      <YouTubeChannelStrip locale={L} theme={theme} channels={channels} />
      <YouTubeStatsStrip
        locale={L} theme={theme}
        videoCount={data.totalVideoCount}
        hoursTotal={hoursTotal}
        totalComments={videos.reduce((acc, v) => acc + v.commentCount, 0)}
        mostWatchedViews={sortedAll.length > 0 ? sortedAll.reduce((max, v) => v.viewCount > max.viewCount ? v : max).viewCount : 0}
        fmtNum={fmtNum}
      />
      <YouTubeFeatureBlock
        locale={L} theme={theme}
        featurePick={featurePick}
        featureSidekicks={featureSidekicks}
        categories={categories}
        fmtNum={fmtNum}
        onCategoryClick={(slug) => goToArchive({ cat: slug })}
      />
      <YouTubeCommentsWall locale={L} theme={theme} comments={comments}/>
      <YouTubeArchive
        locale={L} theme={theme}
        filters={filters} update={update} reset={reset}
        filtered={filtered} visible={visible}
        hasFilters={hasFilters}
        page={page} setPage={setPage}
        categories={categories}
        allTags={allTags}
        totalVideoCount={data.totalVideoCount}
        fmtNum={fmtNum}
      />
      <YouTubeSubscribe locale={L} theme={theme} channels={channels}/>
    </div>
  )
}
