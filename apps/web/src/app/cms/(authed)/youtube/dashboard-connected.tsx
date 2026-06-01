'use client'

import { useTransition, useState, useCallback, useEffect, useRef, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SyncScheduleEntry, SyncStatus } from '@/lib/youtube/types'
import { deriveScheduleLabel } from '@/lib/youtube/schedule-label'
import { groupSchedules, explodeGroups, type ScheduleGroup } from '@/lib/youtube/schedule-group'
import { triggerSync, unpinWeeklyPick, pinWeeklyPick } from './videos/actions'
import { updateYouTubeChannelSettings } from '../settings/actions'

export interface PinnedVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  pinnedUntil: string
}

export interface LastSyncInfo {
  status: SyncStatus
  videosFound: number
  videosInserted: number
  videosUpdated: number
  at: string
  errorMessage: string | null
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
  syncEnabled: boolean
  syncSchedules: SyncScheduleEntry[]
  rawScheduleLabel: string | null
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
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

export function bustCache(url: string | null, syncedAt: string | null): string | null {
  if (!url) return null
  if (!syncedAt) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}_v=${encodeURIComponent(syncedAt)}`
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

/* ------------------------------------------------------------------ */
/*  Schedule editor constants                                         */
/* ------------------------------------------------------------------ */

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const DAY_LABELS: Record<typeof DAYS[number], string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui',
  friday: 'Sex', saturday: 'Sab', sunday: 'Dom',
}

type ScheduleSaveState = 'idle' | 'saving' | 'success' | 'error'

function SyncStatusBadge({ channel }: { channel: ChannelDashboard }) {
  if (!channel.lastSync) {
    return (
      <span className="text-xs text-cms-text-dim">No sync data</span>
    )
  }
  const { status, videosFound, videosInserted, videosUpdated } = channel.lastSync
  if (status === 'failed') {
    return (
      <span className="line-clamp-1 text-xs text-red-400" title={channel.lastSync?.errorMessage ?? undefined}>
        Last sync failed{channel.lastSync?.errorMessage ? `: ${channel.lastSync.errorMessage}` : ''}
      </span>
    )
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

function ReconnectTokenButton() {
  const router = useRouter()
  const [isConnecting, startTransition] = useTransition()
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null)

  useEffect(() => {
    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
        messageListenerRef.current = null
      }
    }
  }, [])

  const handleReconnect = useCallback(() => {
    startTransition(() => {
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        '/api/social/oauth/google',
        'social-oauth',
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'social-oauth-result') {
          window.removeEventListener('message', onMessage)
          messageListenerRef.current = null
          popup?.close()
          if (event.data.success) {
            router.refresh()
          }
        }
      }
      messageListenerRef.current = onMessage
      window.addEventListener('message', onMessage)
    })
  }, [router])

  return (
    <button
      type="button"
      onClick={handleReconnect}
      disabled={isConnecting}
      className="rounded border border-cms-border px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-50"
    >
      {isConnecting ? 'Conectando…' : 'Reconectar Token'}
    </button>
  )
}

function ChannelCard({ channel }: { channel: ChannelDashboard }) {
  const [isPending, startTransition] = useTransition()
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const flag = channel.locale === 'pt' ? '🇧🇷' : '🇺🇸'
  const pinState = getPinState(channel.pinnedVideo)
  const neverSynced = !channel.lastSyncedAt

  const handleSync = () => {
    setSyncError(null)
    startTransition(async () => {
      const result = await triggerSync(channel.id)
      if (!result.ok) {
        setSyncError(result.error)
      }
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
            <span className="text-xs text-cms-text-dim">
              {channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${neverSynced ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className={`text-xs ${neverSynced ? 'text-amber-400' : 'text-cms-text-dim'}`}>
              {neverSynced ? 'Nunca' : timeAgo(channel.lastSyncedAt!)}
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

      {syncError && (
        <div role="alert" className="border-t border-red-900/30 bg-red-900/10 px-4 py-2">
          <span className="text-xs text-red-400">{syncError}</span>
        </div>
      )}

      {channel.videoCount === 0 && neverSynced ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-cms-text-dim">
            Canal sem vídeos — clique em &lsquo;First Sync&rsquo; para importar
          </p>
        </div>
      ) : (
        <>
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
                Mais recente: {timeAgo(channel.latestVideoAt)}
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
                    : `until ${new Date(channel.pinnedVideo.pinnedUntil).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} (${daysLeft(channel.pinnedVideo.pinnedUntil)}d left)`
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
        </>
      )}

      {/* Channel actions footer */}
      <div className="flex items-center gap-2 border-t border-cms-border px-4 py-2.5">
        <button
          type="button"
          onClick={() => setShowConfig(prev => !prev)}
          className="inline-flex items-center gap-1 rounded border border-cms-border px-2.5 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover"
        >
          {showConfig ? 'Fechar config' : 'Configurar'}
        </button>
        <ReconnectTokenButton />
      </div>

      {/* Inline schedule config */}
      {showConfig && (
        <ChannelScheduleEditor channel={channel} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Inline Channel Schedule Editor                                    */
/* ------------------------------------------------------------------ */

function ChannelScheduleEditor({ channel }: { channel: ChannelDashboard }) {
  const [, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<ScheduleSaveState>('idle')
  const [syncEnabled, setSyncEnabled] = useState(channel.syncEnabled)
  const nextIdRef = useRef(0)
  const nextId = () => ++nextIdRef.current
  const [groups, setGroups] = useState<ScheduleGroup[]>(() =>
    groupSchedules(channel.syncSchedules ?? [], nextId),
  )
  const [scheduleLabel, setScheduleLabel] = useState(channel.rawScheduleLabel ?? '')

  useEffect(() => {
    if (saveState === 'success' || saveState === 'error') {
      const t = setTimeout(() => setSaveState('idle'), saveState === 'success' ? 2000 : 3000)
      return () => clearTimeout(t)
    }
  }, [saveState])

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    setSaveState('saving')
    startTransition(async () => {
      try {
        const res = await updateYouTubeChannelSettings({
          channel_id: channel.id,
          sync_enabled: syncEnabled,
          sync_schedules: explodeGroups(groups),
          schedule_label: scheduleLabel.trim() || null,
        })
        setSaveState(res.ok ? 'success' : 'error')
      } catch {
        setSaveState('error')
      }
    })
  }

  const addGroup = () => {
    setGroups(prev => [...prev, { _id: nextId(), days: [], hour: 10, tz: 'America/Sao_Paulo', label: '' }])
  }

  const removeGroup = (groupId: number) => {
    setGroups(prev => prev.filter(g => g._id !== groupId))
  }

  const toggleDay = (groupId: number, day: SyncScheduleEntry['day']) => {
    setGroups(prev => prev.map(g =>
      g._id !== groupId ? g :
      { ...g, days: g.days.includes(day) ? g.days.filter(d => d !== day) : [...g.days, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)) }
    ))
  }

  const updateGroup = (groupId: number, patch: Partial<ScheduleGroup>) => {
    setGroups(prev => prev.map(g => g._id !== groupId ? g : { ...g, ...patch }))
  }

  return (
    <form onSubmit={handleSave} className="border-t border-cms-border px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">Schedule Config</span>
        <label className="flex items-center gap-2 text-xs text-cms-text-muted">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
            className="accent-indigo-500"
          />
          Sync enabled
        </label>
      </div>

      {syncEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cms-text-muted">Posting Schedule</span>
            <button
              type="button"
              onClick={addGroup}
              disabled={groups.length >= 3}
              title={groups.length >= 3 ? 'Max 3 groups' : undefined}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              + Add group
            </button>
          </div>

          {groups.length === 0 && (
            <p className="text-xs text-cms-text-dim">No schedule configured. Daily cron (07:00) still syncs.</p>
          )}

          {groups.map((group, groupIdx) => (
            <div key={group._id} className="flex flex-wrap items-center gap-2 rounded-md border border-cms-border bg-cms-surface p-2">
              <div role="group" aria-label="Days" className="flex items-center gap-1">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(group._id, day)}
                    aria-pressed={group.days.includes(day)}
                    className={`min-h-[32px] min-w-[32px] rounded-full px-1.5 text-[10px] font-medium ${group.days.includes(day) ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={23}
                value={group.hour}
                onChange={(e) => updateGroup(group._id, { hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                aria-label={`Hour group ${groupIdx + 1}`}
                className="w-12 rounded border border-cms-border bg-cms-surface px-1.5 py-0.5 text-xs text-cms-text focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs text-cms-text-dim">h</span>
              <input
                type="text"
                value={group.label}
                onChange={(e) => updateGroup(group._id, { label: e.target.value })}
                placeholder="Label"
                aria-label={`Label group ${groupIdx + 1}`}
                className="flex-1 min-w-[60px] rounded border border-cms-border bg-cms-surface px-1.5 py-0.5 text-xs text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => removeGroup(group._id)}
                aria-label={`Remove group ${groupIdx + 1}`}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center text-xs text-red-400 hover:text-red-300"
              >
                x
              </button>
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-xs font-medium text-cms-text-muted">Schedule Label (public site)</label>
            <input
              type="text"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              placeholder={deriveScheduleLabel(explodeGroups(groups), channel.locale) ?? 'Auto-derived from schedules'}
              className="w-full rounded border border-cms-border bg-cms-surface px-2 py-1 text-xs text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-cms-text-dim">Leave empty to auto-derive from posting schedule.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {saveState === 'success' && <span className="text-xs text-emerald-400">Saved</span>}
        {saveState === 'error' && <span className="text-xs text-red-400">Error saving</span>}
        <button
          type="submit"
          disabled={saveState === 'saving'}
          className="inline-flex items-center gap-1.5 rounded bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saveState === 'saving' && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          Save
        </button>
      </div>
    </form>
  )
}

export function DashboardConnected({ channels, uncategorizedCount }: Props) {
  if (channels.length === 0) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-cms-text">No YouTube channels configured</p>
        <p className="mt-2 text-sm text-cms-text-muted">
          Use the YouTube API lookup in the admin panel to add channels.
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
