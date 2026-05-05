'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { triggerSync, unpinWeeklyPick, pinWeeklyPick } from './videos/actions'

export interface PinnedVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  pinnedUntil: string
}

export interface LastSyncInfo {
  status: string
  videosFound: number
  videosInserted: number
  videosUpdated: number
  at: string
}

export interface ChannelDashboard {
  id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  pinnedVideo: PinnedVideo | null
  totalViews: number
  totalLikes: number
  featuredCount: number
  hiddenCount: number
  latestVideoAt: string | null
  lastSync: LastSyncInfo | null
  scheduleLabel: string | null
}

interface Props {
  channels: ChannelDashboard[]
  uncategorizedCount: number
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export type PinState = 'active' | 'expiring' | 'expired' | 'none'

export function getPinState(pinnedVideo: PinnedVideo | null): PinState {
  if (!pinnedVideo) return 'none'
  const until = new Date(pinnedVideo.pinnedUntil)
  const now = new Date()
  if (until <= now) return 'expired'
  const daysRemaining = Math.ceil((until.getTime() - now.getTime()) / 86_400_000)
  if (daysRemaining <= 2) return 'expiring'
  return 'active'
}

export function daysLeft(pinnedUntil: string): number {
  return Math.ceil((new Date(pinnedUntil).getTime() - Date.now()) / 86_400_000)
}

function SyncStatusBadge({ channel }: { channel: ChannelDashboard }) {
  if (!channel.lastSync) {
    return (
      <span className="text-xs text-cms-text-dim">No sync data</span>
    )
  }
  const { status, videosFound, videosInserted, videosUpdated } = channel.lastSync
  if (status === 'failed') {
    return <span className="text-xs text-red-400">Last sync failed</span>
  }
  if (status === 'completed') {
    const parts: string[] = []
    if (videosInserted > 0) parts.push(`${videosInserted} new`)
    if (videosUpdated > 0) parts.push(`${videosUpdated} updated`)
    const detail = parts.length > 0 ? parts.join(', ') : 'no changes'
    return (
      <span className="text-xs text-cms-text-dim">
        Last sync: {videosFound} checked, {detail}
      </span>
    )
  }
  return <span className="text-xs text-amber-400">Syncing…</span>
}

function ChannelCard({ channel }: { channel: ChannelDashboard }) {
  const [isPending, startTransition] = useTransition()
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false)
  const flag = channel.locale === 'pt' ? '🇧🇷' : '🇺🇸'
  const pinState = getPinState(channel.pinnedVideo)
  const neverSynced = !channel.lastSyncedAt

  const handleSync = () => {
    startTransition(async () => {
      await triggerSync(channel.id)
    })
  }

  const handleUnpin = () => {
    startTransition(async () => {
      await unpinWeeklyPick({ channelId: channel.id })
      setShowUnpinConfirm(false)
    })
  }

  const pinAccent = pinState === 'active'
    ? 'border-l-emerald-500'
    : pinState === 'expiring'
      ? 'border-l-amber-500'
      : pinState === 'expired'
        ? 'border-l-red-500'
        : 'border-l-slate-600'

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border px-4 py-3">
        <div className="flex items-center gap-3">
          {channel.thumbnailUrl ? (
            <img src={channel.thumbnailUrl} alt="" width={48} height={48} referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="text-2xl">{flag}</span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{flag}</span>
              <span className="text-sm font-semibold text-cms-text">{channel.name}</span>
            </div>
            <span className="text-xs text-cms-text-dim">{channel.handle}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${neverSynced ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className={`text-xs ${neverSynced ? 'text-amber-400' : 'text-cms-text-dim'}`}>
              {neverSynced ? 'Never' : timeAgo(channel.lastSyncedAt!)}
            </span>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSync}
            className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
              neverSynced
                ? 'bg-cms-accent text-white'
                : 'border border-cms-border text-cms-text-muted hover:bg-cms-surface-hover'
            }`}
          >
            {isPending ? '⟳ …' : neverSynced ? '⟳ First Sync' : '⟳ Sync'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-cms-border px-4 py-3">
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{channel.videoCount}</span> videos
        </div>
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{formatCount(channel.subscriberCount)}</span> subscribers
        </div>
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{formatCount(channel.totalViews)}</span> total views
        </div>
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{formatCount(channel.totalLikes)}</span> total likes
        </div>
        {(channel.featuredCount > 0 || channel.hiddenCount > 0) && (
          <>
            {channel.featuredCount > 0 && (
              <div className="text-xs text-cms-text-muted">
                <span className="font-semibold text-amber-400">★ {channel.featuredCount}</span> featured
              </div>
            )}
            {channel.hiddenCount > 0 && (
              <div className="text-xs text-cms-text-muted">
                <span className="font-semibold text-cms-text-dim">{channel.hiddenCount}</span> hidden
              </div>
            )}
          </>
        )}
      </div>

      {/* Sync + Schedule info */}
      <div className="flex items-center justify-between border-b border-cms-border px-4 py-2">
        <SyncStatusBadge channel={channel} />
        {channel.scheduleLabel && (
          <span className="text-xs text-cms-text-dim">{channel.scheduleLabel}</span>
        )}
        {channel.latestVideoAt && (
          <span className="text-xs text-cms-text-dim" title={channel.latestVideoAt}>
            Latest: {timeAgo(channel.latestVideoAt)}
          </span>
        )}
      </div>

      {/* Weekly Pick */}
      <div className={`border-l-[3px] ${pinAccent} px-4 py-3`}>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            pinState === 'active' ? 'text-amber-400'
              : pinState === 'expiring' ? 'text-amber-500'
                : pinState === 'expired' ? 'text-red-400'
                  : 'text-cms-text-dim'
          }`}>
            ★ Weekly Pick
          </span>
          {channel.pinnedVideo && (pinState === 'active' || pinState === 'expiring') && (
            <span className={`text-xs ${
              pinState === 'expiring' ? 'font-medium text-amber-500' : 'text-cms-text-dim'
            }`}>
              {pinState === 'expiring'
                ? `⚠ Expires ${daysLeft(channel.pinnedVideo.pinnedUntil) <= 1 ? 'tomorrow' : `in ${daysLeft(channel.pinnedVideo.pinnedUntil)} days`}`
                : `until ${new Date(channel.pinnedVideo.pinnedUntil).toLocaleDateString('en', { month: 'short', day: 'numeric' })} (${daysLeft(channel.pinnedVideo.pinnedUntil)}d left)`
              }
            </span>
          )}
        </div>

        {channel.pinnedVideo && (pinState === 'active' || pinState === 'expiring') ? (
          <>
            <div className="flex items-center gap-3">
              {channel.pinnedVideo.thumbnailUrl && (
                <img
                  src={channel.pinnedVideo.thumbnailUrl}
                  alt=""
                  width={72}
                  height={40}
                  referrerPolicy="no-referrer"
                  className="rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-cms-text">{channel.pinnedVideo.title}</p>
                <p className="text-xs text-cms-text-dim">
                  {formatCount(channel.pinnedVideo.viewCount)} views · {formatCount(channel.pinnedVideo.likeCount)} likes
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-cms-border pt-2">
              {pinState === 'expiring' && (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(async () => {
                      await pinWeeklyPick({ videoId: channel.pinnedVideo!.id, channelId: channel.id, durationDays: 7 })
                    })}
                    className="text-xs font-medium text-emerald-400 hover:underline disabled:opacity-50"
                  >
                    Extend 7d →
                  </button>
                  <span className="text-cms-text-dim">|</span>
                </>
              )}
              <Link
                href={`/cms/youtube/videos?channel=${channel.id}`}
                className="text-xs font-medium text-cms-accent hover:underline"
              >
                Change pick →
              </Link>
              <span className="text-cms-text-dim">|</span>
              <button
                type="button"
                onClick={() => setShowUnpinConfirm(true)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Unpin
              </button>
            </div>
          </>
        ) : pinState === 'expired' ? (
          <div className="py-2 text-center">
            <p className="mb-2 text-sm text-red-400">Pin expired — home page shows latest video as fallback</p>
            <Link
              href={`/cms/youtube/videos?channel=${channel.id}`}
              className="inline-flex items-center gap-1 rounded bg-cms-accent/10 px-3 py-1.5 text-xs font-medium text-cms-accent hover:bg-cms-accent/20"
            >
              ☆ Choose New Pick →
            </Link>
          </div>
        ) : (
          <div className="py-2 text-center">
            <p className="mb-2 text-sm text-cms-text-dim">No video pinned this week</p>
            <Link
              href={`/cms/youtube/videos?channel=${channel.id}`}
              className="inline-flex items-center gap-1 rounded bg-cms-accent/10 px-3 py-1.5 text-xs font-medium text-cms-accent hover:bg-cms-accent/20"
            >
              ☆ Choose Weekly Pick →
            </Link>
          </div>
        )}
      </div>

      {/* Unpin confirmation dialog */}
      {showUnpinConfirm && (
        <div className="border-t border-cms-border px-4 py-3">
          <p className="mb-1 text-sm font-medium text-cms-text">Remove weekly pick?</p>
          <p className="mb-3 text-xs text-cms-text-muted">
            The home page will fall back to showing the latest video for this channel.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUnpinConfirm(false)}
              className="rounded border border-cms-border px-3 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleUnpin}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Unpin
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardConnected({ channels, uncategorizedCount }: Props) {
  if (channels.length === 0) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-cms-text">No YouTube channels configured</p>
        <p className="mt-2 text-sm text-cms-text-muted">
          Add channels in{' '}
          <Link href="/cms/settings?section=youtube" className="text-cms-accent hover:underline">
            Settings → YouTube
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--cms-radius)] border border-amber-900/40 bg-amber-900/10 px-4 py-2.5">
          <span className="text-sm text-amber-400">
            {uncategorizedCount} video{uncategorizedCount !== 1 ? 's' : ''} with pending category suggestions
          </span>
          <Link
            href="/cms/youtube/videos"
            className="ml-auto text-xs font-medium text-cms-accent hover:underline"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Channel cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {channels.map(ch => (
          <ChannelCard key={ch.id} channel={ch} />
        ))}
      </div>
    </div>
  )
}
