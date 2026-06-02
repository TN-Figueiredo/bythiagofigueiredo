'use client'

import React, { useState, useMemo, useTransition } from 'react'
import Image from 'next/image'
import { CategoryBadge, FeaturedToggle, HiddenToggle, PinButton, SyncButton, AbStatusBadge, VideoContextMenu } from './video-row-actions'
import { triggerSync } from './actions'
import { VideoOptimizerDrawer } from './video-optimizer-drawer'

export interface VideoRow {
  id: string
  youtubeVideoId: string
  title: string
  titleTranslation: string | null
  publishedAt: string
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  duration: string
  isFeatured: boolean
  isHidden: boolean
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  channelId: string
  channelLocale: 'pt' | 'en'
  channelHandle: string
  channelName: string
  pinnedUntil: string | null
  durationSeconds: number | null
  abTest: { id: string; status: string; started_at: string | null; result_metadata: { ctr_lift_percent: number } | null } | null
  sourcePipelineId: string | null
  cmsNotes: string | null
  version: number
  hasFatigueAlert: boolean
}

export interface ChannelOption {
  id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
}

export interface CategoryOption {
  id: string
  namePt: string
  nameEn: string
  color: string
}

interface Props {
  videos: VideoRow[]
  channels: ChannelOption[]
  categories: CategoryOption[]
}

const LOCALE_FLAG: Record<string, string> = {
  pt: 'PT',
  en: 'EN',
}

function formatDate(iso: string): string {
  return iso.replace('T', ' ').slice(0, 10)
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function VideosConnected({ videos, channels, categories }: Props) {
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drawerVideo, setDrawerVideo] = useState<VideoRow | null>(null)
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (channelFilter && v.channelHandle !== channelFilter) return false
      if (categoryFilter) {
        if (categoryFilter === '__uncategorized__' && v.categoryId) return false
        if (categoryFilter !== '__uncategorized__' && v.categoryId !== categoryFilter) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !v.title.toLowerCase().includes(q) &&
          !(v.titleTranslation ?? '').toLowerCase().includes(q) &&
          !v.channelHandle.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [videos, channelFilter, categoryFilter, search])

  const pendingSuggestions = filtered.filter(
    (v) => v.suggestedCategoryId && !v.categoryId,
  ).length

  const channelsWithPins = useMemo(() => {
    const set = new Set<string>()
    for (const v of videos) {
      if (v.pinnedUntil && new Date(v.pinnedUntil) > new Date()) {
        set.add(v.channelId)
      }
    }
    return set
  }, [videos])

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-cms-text">YouTube Videos</h2>
          <p className="mt-0.5 text-sm text-cms-text-muted">
            {filtered.length} of {videos.length} videos
            {pendingSuggestions > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-400">
                {pendingSuggestions} pending category suggestion{pendingSuggestions !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <SyncButton
          onSync={async () => {
            startTransition(async () => {
              await triggerSync()
            })
          }}
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        {/* Channel filter */}
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
          aria-label="Filter by channel"
        >
          <option value="">All channels</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.handle}>
              {LOCALE_FLAG[ch.locale] ?? ch.locale} {ch.name}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value="__uncategorized__">Uncategorized</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.namePt} / {cat.nameEn}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cms-text-dim"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            aria-label="Search videos"
            className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface py-1.5 pl-8 pr-3 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
          <p className="text-sm text-cms-text-muted">No videos match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-cms-border text-left text-xs font-medium text-cms-text-muted">
                <th className="px-3 py-2.5 w-[90px]">Thumbnail</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5 w-[160px]">Category</th>
                <th className="px-3 py-2.5 w-[60px] text-center">Featured</th>
                <th className="px-3 py-2.5 w-[60px] text-center">Hidden</th>
                <th className="px-3 py-2.5 w-[70px] text-center">A/B</th>
                <th className="px-3 py-2.5 w-[80px] text-center">Pick</th>
                <th className="px-3 py-2.5 w-[90px]">Published</th>
                <th className="px-3 py-2.5 w-[80px] text-right">Views</th>
                <th className="px-3 py-2.5 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((video) => (
                <React.Fragment key={video.id}>
                <tr
                  onClick={() => setExpandedId(expandedId === video.id ? null : video.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === video.id ? null : video.id) } }}
                  className={`border-b border-cms-border last:border-0 cursor-pointer hover:bg-cms-surface-hover ${
                    video.pinnedUntil && new Date(video.pinnedUntil) > new Date()
                      ? 'shadow-[inset_3px_0_0_0_#f59e0b]'
                      : ''
                  } ${expandedId === video.id ? 'bg-cms-surface-hover/50' : ''}`}
                >
                  {/* Thumbnail */}
                  <td className="px-3 py-2">
                    {video.thumbnailUrl ? (
                      <a
                        href={`https://youtube.com/watch?v=${video.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded"
                        title="Open on YouTube"
                      >
                        <Image
                          src={video.thumbnailUrl}
                          alt={video.title}
                          width={80}
                          height={45}
                          className="object-cover"
                        />
                      </a>
                    ) : (
                      <div className="h-[45px] w-[80px] rounded bg-cms-surface-hover flex items-center justify-center">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="text-cms-text-dim"
                          aria-hidden="true"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8M12 17v4" />
                        </svg>
                      </div>
                    )}
                    <span className="mt-0.5 block text-center text-xs text-cms-text-dim">
                      {video.duration}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2 max-w-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[10px] font-medium bg-cms-surface-hover text-cms-text-muted">
                        {LOCALE_FLAG[video.channelLocale] ?? video.channelLocale}
                      </span>
                      <div>
                        <p className="line-clamp-2 font-medium text-cms-text leading-snug">
                          {video.title}
                          {video.sourcePipelineId && (
                            <span className="ml-1.5 bg-purple-900/30 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                              Pipeline
                            </span>
                          )}
                          {video.hasFatigueAlert && (
                            <span className="ml-1.5 bg-red-900/30 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium" title="Alerta de fadiga pendente">
                              FADIGA
                            </span>
                          )}
                        </p>
                        {video.titleTranslation && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-cms-text-muted italic">
                            {video.titleTranslation}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-cms-text-dim">
                          {video.channelHandle.startsWith('@') ? video.channelHandle : `@${video.channelHandle}`}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2">
                    <CategoryBadge
                      videoId={video.id}
                      categoryId={video.categoryId}
                      suggestedCategoryId={video.suggestedCategoryId}
                      suggestedCategoryName={video.suggestedCategoryName}
                      categoryName={video.categoryName}
                      categoryColor={video.categoryColor}
                    />
                  </td>

                  {/* Featured toggle */}
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <FeaturedToggle videoId={video.id} isFeatured={video.isFeatured} />
                    </div>
                  </td>

                  {/* Hidden toggle */}
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <HiddenToggle videoId={video.id} isHidden={video.isHidden} />
                    </div>
                  </td>

                  {/* A/B test status */}
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <AbStatusBadge
                      test={video.abTest}
                      videoId={video.id}
                      isShort={(video.durationSeconds ?? 0) <= 60}
                    />
                  </td>

                  {/* Weekly pick pin */}
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <PinButton
                        videoId={video.id}
                        channelId={video.channelId}
                        pinnedUntil={video.pinnedUntil}
                        hasExistingPin={channelsWithPins.has(video.channelId)}
                      />
                    </div>
                  </td>

                  {/* Published date */}
                  <td className="px-3 py-2 text-xs text-cms-text-muted whitespace-nowrap">
                    {formatDate(video.publishedAt)}
                  </td>

                  {/* Views */}
                  <td className="px-3 py-2 text-right text-xs text-cms-text-muted whitespace-nowrap">
                    <span title={`${video.viewCount.toLocaleString()} views`}>
                      {formatCount(video.viewCount)}
                    </span>
                    {video.likeCount > 0 && (
                      <span className="block text-[10px] text-cms-text-dim">
                        {formatCount(video.likeCount)} likes
                      </span>
                    )}
                  </td>

                  {/* Context menu */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDrawerVideo(video)}
                        className="rounded border border-cms-border px-1.5 py-0.5 text-[11px] text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
                        title="Abrir Video Optimizer"
                      >
                        ⚡
                      </button>
                      <VideoContextMenu
                        videoId={video.id}
                        isShort={(video.durationSeconds ?? 0) <= 60}
                        abTest={video.abTest}
                      />
                    </div>
                  </td>
                </tr>

                {/* Expansion row */}
                {expandedId === video.id && (
                  <tr className="border-b border-cms-border bg-cms-bg/50">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="flex gap-6">
                        {/* Left: larger thumbnail */}
                        <div className="shrink-0">
                          {video.thumbnailUrl ? (
                            <Image
                              src={video.thumbnailUrl}
                              alt={video.title}
                              width={240}
                              height={135}
                              className="rounded-[var(--cms-radius)] object-cover"
                            />
                          ) : (
                            <div className="h-[135px] w-[240px] rounded-[var(--cms-radius)] bg-cms-surface-hover flex items-center justify-center text-cms-text-dim text-sm">
                              No thumbnail
                            </div>
                          )}
                        </div>

                        {/* Right: details */}
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-medium text-cms-text">{video.title}</h3>
                            {video.titleTranslation && (
                              <p className="mt-0.5 text-sm text-cms-text-muted italic">{video.titleTranslation}</p>
                            )}
                            <p className="mt-1 text-xs text-cms-text-dim">
                              {video.channelHandle.startsWith('@') ? video.channelHandle : `@${video.channelHandle}`} · {video.duration} · {video.viewCount.toLocaleString()} views
                            </p>
                          </div>

                          {/* A/B Test panel */}
                          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim mb-2">A/B Testing</p>
                            {(video.durationSeconds ?? 0) <= 60 ? (
                              <p className="text-sm text-cms-text-muted">Shorts are not eligible for A/B testing.</p>
                            ) : video.abTest ? (
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    video.abTest.status === 'active' ? 'bg-green-900/30 text-green-400' :
                                    video.abTest.status === 'paused' ? 'bg-amber-900/30 text-amber-400' :
                                    'bg-blue-900/30 text-blue-400'
                                  }`}>
                                    {video.abTest.status.charAt(0).toUpperCase() + video.abTest.status.slice(1)}
                                  </span>
                                </div>
                                <a
                                  href={`/cms/youtube/ab-lab/${video.abTest.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-cms-accent hover:underline"
                                >
                                  View Details →
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-cms-text-muted">No test running</p>
                                <a
                                  href={`/cms/youtube/ab-lab/new?videoId=${video.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-cms-accent hover:underline"
                                >
                                  Start A/B Test →
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Pipeline badge if applicable */}
                          {video.sourcePipelineId && (
                            <span className="inline-flex items-center gap-1 bg-purple-900/30 text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              Pipeline linked
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VideoOptimizerDrawer
        video={drawerVideo}
        onClose={() => setDrawerVideo(null)}
      />
    </div>
  )
}
